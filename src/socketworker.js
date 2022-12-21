import { io } from 'socket.io-client'
// eslint-disable-next-line camelcase
import jwt_decode from 'jwt-decode'
import {
  serialize as BSONserialize,
  deserialize as BSONdeserialize
} from 'bson'

class SocketWorker {
  constructor(args) {
    this.onMessage = this.onMessage.bind(this)
    this.objects = {}

    this.requestReauthor = this.requestReauthor.bind(this)
    this.getToken = this.getToken.bind(this)
    this.authCB = this.authCB.bind(this)
    this.reauthorizeTimeout = null

    this.handleBlackboard = this.handleBlackboard.bind(this)
    this.handleAV = this.handleAV.bind(this)

    this.periodicStatusCheck = this.periodicStatusCheck.bind(this)

    // key generation
    // eslint-disable-next-line no-restricted-globals
    this.cryptKeyPair = crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    )

    // eslint-disable-next-line no-restricted-globals
    this.signKeyPair = crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-384'
      },
      true,
      ['sign', 'verify']
    )

    this.idents = {}

    this.keyobject = { exptime: Date.now() / 1000 + 7.5 + 5 * Math.random() } // we have 20 seconds for a new key

    const bidarray = new Uint32Array(2)
    crypto.getRandomValues(bidarray)
    this.keymasterBidding = Math.abs(
      ((0xfffff & bidarray[0]) << 32) | bidarray[1]
    )
    setInterval(this.periodicStatusCheck, 1000)
  }

  async periodicStatusCheck() {
    const token = this.decodedToken()
    const now = Date.now() / 1000
    let expired = true
    if (token && token.exp && token.exp - now > 0) expired = false

    if (this.tokenexpired !== expired) {
      this.setExpiredToken(expired)
      this.tokenexpired = expired
    }

    const keyobject = this.keyobject
    if (!keyobject || (keyobject.exptime && keyobject.exptime - now < 0)) {
      // keys are not present or expired
      if (
        this.socket &&
        (!this.keymasterQueryTime || this.keymasterQueryTime - now < 0)
      ) {
        this.socket.emit('keymasterQuery') // tells the handlers, to query the keymaster
        this.keymasterQueryTime = now + 20 + 10 * Math.random() // give them 20 seconds to fix this
        this.keymaster = false
      }
    } else if (
      this.socket &&
      this.keymaster &&
      (!keyobject.exptime || keyobject.exptime - now - 60 < 0)
    ) {
      /* console.log(
        'keymasterGenerate',
        !keyobject.exptime,
        keyobject.exptime - now - 60
      ) */
      // I am the keymaster and I should regenerate keys
      if (!this.keymasterGeneratingKeys) {
        this.keymasterGeneratingKeys = true
        try {
          await this.generateKeysAndSend()
        } catch (error) {
          console.log('generateKeys failed', error)
        }
        this.keymasterGeneratingKeys = false
      }
    }
  }

  netSendSocket(command, data) {
    if (this.socket) this.socket.emit(command, data)
  }

  informUpdatedKeys() {
    console.log(
      'new keypair',
      this.keyobject.keynum,
      'master digest',
      Array.from(new Uint16Array(this.keyobject.digest))
        .map((el) => String(el).padStart(6, '0'))
        .join(' ')
    )
    this.av.postMessage({
      task: 'keychange',
      keyobject: this.keyobject
    })
    this.informIdentities()
  }

  informIdentities() {
    const nowborder = Date.now() - 60 * 1000
    const idents = Object.entries(this.idents)
      .map(([key, obj]) => ({ id: key, ...obj }))
      .filter((el) => nowborder - Number(el.lastaccess) < 0)
      .map((el) => ({
        displayname: el.displayname,
        userhash: el.userhash,
        purpose: el.purpose,
        lastaccess: Number(el.lastaccess)
      }))
    let masterdigest = null
    if (this.keyobject.digest)
      masterdigest = Array.from(new Uint16Array(this.keyobject.digest))
        .map((el) => String(el).padStart(6, '0'))
        .join(' ')

    // eslint-disable-next-line no-restricted-globals
    self.postMessage({
      task: 'informIdentities',
      idents,
      masterdigest
    })
  }

  async sendAndEncrypt(el) {
    try {
      let tosend = { ...this.keyobject.sendKOforRec }
      if (
        el.purpose === 'notes' ||
        el.purpose === 'notepad' ||
        el.purpose === 'lecture' ||
        el.purpose === 'screen'
      )
        tosend = { ...this.keyobject.sendKO }

      if (tosend.keyRec) {
        // eslint-disable-next-line no-restricted-globals
        tosend.keyRec = self.crypto.subtle.encrypt(
          {
            name: 'RSA-OAEP'
          },
          el.cryptKey,
          tosend.keyRec
        )
      }
      if (tosend.keyE2E) {
        // eslint-disable-next-line no-restricted-globals
        tosend.keyE2E = self.crypto.subtle.encrypt(
          {
            name: 'RSA-OAEP'
          },
          el.cryptKey,
          tosend.keyE2E
        )
      }
      tosend.dest = el.id
      tosend.verifyKey = crypto.subtle.exportKey(
        'jwk',
        this.signKeyPair.publicKey
      )
      await Promise.all([tosend.keyRec, tosend.keyE2E, tosend.verifyKey])

      if (tosend.keyRec) tosend.keyRec = new Uint8Array(await tosend.keyRec)
      if (tosend.keyE2E) tosend.keyE2E = new Uint8Array(await tosend.keyE2E)
      tosend.verifyKey = await tosend.verifyKey

      tosend = BSONserialize(tosend)

      const cryptMess = {
        message: tosend,
        signature: await crypto.subtle.sign(
          {
            name: 'ECDSA',
            hash: { name: 'SHA-384' }
          },
          this.signKeyPair.privateKey,
          tosend
        ),
        dest: el.id,
        purpose: el.purpose
      }
      this.socket.emit('sendKey', cryptMess)
    } catch (error) {
      console.log('error in send and encrypt')
    }
  }

  async generateSendKeyObjs() {
    const exptime = this.keyobject.exptime
    const keyRec = this.keyobject.keyRec
    const keyE2E = this.keyobject.keyE2E
    const keynum = this.keyobject.keynum

    const sendKO = {
      exptime,
      keyRec: crypto.subtle.exportKey('raw', keyRec),
      keyE2E: crypto.subtle.exportKey('raw', keyE2E),
      keynum
    }
    await Promise.all([sendKO.keyRec, sendKO.keyE2E])
    sendKO.keyRec = await sendKO.keyRec
    sendKO.keyE2E = await sendKO.keyE2E

    const sendKOforRec = {
      exptime,
      keyRec: sendKO.keyRec,
      id: this.socket.id,
      keynum
    }

    this.keyobject.sendKO = sendKO
    this.keyobject.sendKOforRec = sendKOforRec
  }

  async generateKeysAndSend() {
    try {
      if (!this.keymaster && !this.socket) return // safety sanity
      let keyE2E = crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      )

      let keyRec = crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      )

      const exptime = Date.now() / 1000 + 60 * 5

      let keynum = new Promise((resolve, reject) => {
        this.socket.emit('getKeyNum', (data) => {
          if (data.keynum && Number.isInteger(data.keynum)) {
            resolve(data.keynum)
          } else reject(new Error('getKeyNum failed'))
        })
      })

      const pubkey = crypto.subtle.exportKey('raw', this.signKeyPair.publicKey)

      await Promise.all([keyE2E, keyRec, keynum, pubkey])

      keyE2E = await keyE2E
      keyRec = await keyRec
      keynum = await keynum

      this.keyobject = {
        exptime,
        keyRec,
        keyE2E,
        digest: crypto.subtle.digest('SHA-256', await pubkey),
        id: this.socket.id,
        keynum
      }

      await this.generateSendKeyObjs()

      // ok, now we iterate over all identies and send out the stuff
      const nowborder = Date.now() - 60 * 5 * 1000
      const allprom = Object.keys(this.idents)
        .map((id) => ({ id, ...this.idents[id] }))
        .filter((el) => el.id !== this.socket.id)
        .filter((el) => nowborder - Number(el.lastaccess) < 0)
        .map(this.sendAndEncrypt.bind(this))

      this.keyobject.digest = await this.keyobject.digest

      await Promise.all(allprom)
      this.informUpdatedKeys()
    } catch (error) {
      console.log('generateKeysAndSend failed', error)
    }
  }

  async connectCrypto() {
    // setup crypto stuff
    this.cryptKeyPair = await this.cryptKeyPair
    this.signKeyPair = await this.signKeyPair
    // ok we have the keys, now send the public part to the handler
    const keyinfo = {
      cryptKey: await crypto.subtle.exportKey(
        'jwk',
        this.cryptKeyPair.publicKey
      ),
      signKey: await crypto.subtle.exportKey('jwk', this.signKeyPair.publicKey)
    }
    this.socket.emit('keyInfo', keyinfo)
  }

  connectNotepad() {
    console.log('socket connect notepad')
    if (this.decodedToken().notepadhandler) {
      let notepadhandler = this.decodedToken().notepadhandler
      // eslint-disable-next-line no-restricted-globals
      const myself = self
      if (notepadhandler === '/')
        notepadhandler =
          myself.location.protocol +
          '//' +
          myself.location.hostname +
          (myself.location.port !== '' ? ':' + myself.location.port : '')

      this.socket = io(notepadhandler + '/notepads', {
        auth: this.authCB /* + sessionStorage.getItem("FailsAuthtoken") */,
        path: '/notepad.io',
        multiplex: false
      })
      this.initializeSocketHandlersNotepads()
      this.initializeSocketHandlers()
      console.log('socket connect notepad ready')
    }
  }

  connectScreen() {
    console.log('socket connect screen')
    if (this.decodedToken().notepadhandler) {
      let notepadhandler = this.decodedToken().notepadhandler
      // eslint-disable-next-line no-restricted-globals
      const myself = self
      if (notepadhandler === '/')
        notepadhandler =
          myself.location.protocol +
          '//' +
          myself.location.hostname +
          (myself.location.port !== '' ? ':' + myself.location.port : '')

      this.socket = io(notepadhandler + '/screens', {
        auth: this.authCB /* + sessionStorage.getItem("FailsAuthtoken") */,
        path: '/notepad.io',
        multiplex: false
      })
      this.initializeSocketHandlersScreens()
      this.initializeSocketHandlers()
      console.log('socket connect screen ready')
    }
  }

  connectNotes() {
    console.log('socket connect notes')
    if (this.decodedToken().noteshandler) {
      let noteshandler = this.decodedToken().noteshandler
      // eslint-disable-next-line no-restricted-globals
      const myself = self
      if (noteshandler === '/')
        noteshandler =
          myself.location.protocol +
          '//' +
          myself.location.hostname +
          (myself.location.port !== '' ? ':' + myself.location.port : '')

      this.socket = io(noteshandler + '/notes', {
        auth: this.authCB /* + sessionStorage.getItem("FailsAuthtoken") */,
        path: '/notes.io',
        multiplex: false
      })

      this.initializeSocketHandlersNotes()
      this.initializeSocketHandlers()
      console.log('socket connect notes ready')
    }
  }

  initializeSocketHandlers() {
    this.socket.removeAllListeners('authtoken')
    this.socket.on('authtoken', (data) => {
      // console.log('authtoken renewed', data)
      // console.log('oldauthtoken' /* , this.myauthtoken */)
      this.myauthtoken = data.token
      // eslint-disable-next-line no-restricted-globals
      self.postMessage({
        task: 'setToken',
        token: data.token,
        decodedToken: this.decodedToken()
      })
      // console.log('newauthtoken' /* , this.myauthtoken */)
      console.log('authtoken renewed')
      this.scheduleReauthor() // request renewal
    })

    const toIden = async (iden, id) => ({
      signKey: await crypto.subtle.importKey(
        'jwk',
        iden.signKey,
        {
          name: 'ECDSA',
          namedCurve: 'P-384'
        },
        true,
        ['verify']
      ),
      cryptKey: await crypto.subtle.importKey(
        'jwk',
        iden.cryptKey,
        {
          name: 'RSA-OAEP',
          modulusLength: 4096,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        true,
        ['encrypt']
      ),
      purpose: iden.purpose,
      lastaccess: Number(iden.lastaccess),
      displayname: iden.displayname,
      userhash: iden.userhash,
      myself: id === this.socket.id
    })

    this.socket.removeAllListeners('identUpdate')
    this.socket.on('identUpdate', async (data) => {
      if (data.id && data.identity) {
        const iden = data.identity
        // console.log('identUpdate', iden, iden.signKey, iden.cryptKey, data.id)
        try {
          const el = await toIden(iden, data.id)
          this.idents[data.id] = el

          if (this.keymaster && data.id !== this.socket.id) {
            await this.generateSendKeyObjs()
            await this.sendAndEncrypt({ ...el, id: data.id })
          }
          this.informIdentities()
        } catch (error) {
          console.log('error identUpdate', error)
        }
      }
    })

    this.socket.removeAllListeners('identValidity')
    this.socket.on('identValidity', (data) => {
      console.log('identValidity', data)
      if (data.id && data.lastaccess) {
        this.idents[data.id].lastaccess = Number(data.lastaccess)
        this.informIdentities()
      }
    })

    this.socket.removeAllListeners('identDelete')
    this.socket.on('identDelete', (data) => {
      if (data.id) {
        console.log('identDelete2', this.idents[data.id])
        if (this.idents[data.id]) delete this.idents[data.id].lastaccess
        this.informIdentities()
      }
    })

    this.socket.removeAllListeners('identList')
    this.socket.on('identList', async (data) => {
      const now = Date.now()
      for (const id in data) {
        /*  console.log(
          'identList',
          this.socket.id,
          id,
          data[id],
          data[id].signKey,
          data[id].cryptKey,
          now - 60 * 5 * 1000 - Number(data[id].lastaccess),
          now - 60 * 5 * 1000,
          Number(data[id].lastaccess),
          now - 60 * 5 * 1000 - Number(data[id].lastaccess) < 0
        ) */
        if (
          data[id].signKey &&
          data[id].cryptKey &&
          now - 60 * 5 * 1000 - Number(data[id].lastaccess) < 0
        ) {
          const newid = toIden(data[id], id)
          this.idents[id] = await newid
          // console.log('identList added', id)
        } else {
          delete this.idents[id]
        }
        this.informIdentities()
      }
    })

    this.socket.removeAllListeners('keymasterQuery')
    this.socket.on('keymasterQuery', async () => {
      // ok folks
      console.log('keymasterQuery')
      this.socket.emit('keymasterQueryResponse', {
        keyMaster: !!this.keymaster, // tell them, that I feel, that I am the keyMaster
        bidding: this.keymasterBidding
      })
      this.keymaster = false // if someone queries the keyMaster property is reset
    })

    this.socket.removeAllListeners('keymasterQueryResponse')
    this.socket.on('keymasterQueryResponse', async (data) => {
      console.log('keymasterQueryResponse', data)
      if (data.keymaster) {
        console.log('New keymaster!')
        this.keymaster = true
        delete this.keyobject.exptime // trigger key regeneration asap
      } else {
        console.log('Not keymaster!')
        this.keymaster = false
      }
    })

    this.socket.removeAllListeners('receiveKey')
    this.socket.on('receiveKey', async (data) => {
      if (!data.message) return
      try {
        const message = BSONdeserialize(data.message)
        if (message.id === this.socket.id) {
          console.log('Receiving own key, bad things happening')
          return
        }

        if (message.keyRec) {
          // console.log('message inspect', message)
          message.keyRec = await crypto.subtle.decrypt(
            {
              name: 'RSA-OAEP'
            },
            this.cryptKeyPair.privateKey,
            message.keyRec.buffer
          )
        }
        if (message.keyE2E) {
          message.keyE2E = await crypto.subtle.decrypt(
            {
              name: 'RSA-OAEP'
            },
            this.cryptKeyPair.privateKey,
            message.keyE2E.buffer
          )
        }
        // console.log('data stuff', data)
        let verikey = null

        if (data.id && this.idents[data.id]) {
          verikey = this.idents[data.id].signKey
        }
        if (!verikey) {
          // console.log('key info', message, message.id, this.idents)
          if (message.verifyKey && this.decodedToken().purpose !== 'lecture') {
            verikey = await crypto.subtle.importKey(
              'jwk',
              message.verifyKey,
              {
                name: 'ECDSA',
                namedCurve: 'P-384'
              },
              true,
              ['verify']
            )
          } else throw new Error('no key for verifing')
        }
        // now we have to verify
        const verified = await crypto.subtle.verify(
          {
            name: 'ECDSA',
            hash: { name: 'SHA-384' }
          },
          verikey,
          data.signature,
          data.message
        )
        if (!verified) throw new Error('verification of keymaster failed')
        // console.log('destination check', data.dest, message.dest)
        if (this.socket.id !== message.dest)
          throw new Error('destination forged')

        this.keyobject = {
          keynum: message.keynum,
          exptime: message.exptime,
          keyRec: await crypto.subtle.importKey(
            'raw',
            message.keyRec,
            'AES-GCM',
            true,
            ['encrypt', 'decrypt']
          ),
          keyE2E: await crypto.subtle.importKey(
            'raw',
            message.keyE2E,
            'AES-GCM',
            true,
            ['encrypt', 'decrypt']
          ),
          digest: await crypto.subtle.digest(
            'SHA-256',
            await crypto.subtle.exportKey('raw', verikey)
          )
        }
        this.informUpdatedKeys()
      } catch (error) {
        console.log('receiveKey error', error)
      }
    })

    // TODO
    this.socket.removeAllListeners('reloadBoard')
    this.socket.on('reloadBoard', (data) => {
      // console.log('reloadboard', data, this.noteref)
      this.setReloading(!data.last)
      this.blackboard.postMessage({ type: 'replaceData', data }, [data.data])
    })
    this.socket.removeAllListeners('drawcommand')
    this.socket.on('drawcommand', (data) => {
      this.blackboard.postMessage({ type: 'receiveData', data }) // we might get here time codes
    })

    this.socket.removeAllListeners('pictureinfo')
    this.socket.on('pictureinfo', (data) => {
      if (this.blackboard) {
        data.forEach((el) => {
          this.blackboard.postMessage({
            type: 'receivePictInfo',
            data: {
              uuid: el.sha,
              url: el.url,
              mimetype: el.mimetype
            }
          })
        })
      }
    })

    this.socket.on('FoG', (data) => {
      this.blackboard.postMessage({ type: 'receiveFoG', data })
    })

    this.socket.removeAllListeners('error')
    this.socket.on('error', (data) => {
      console.log('Socketio error', data)
      this.servererrorhandler(data.code, data.message, data.type)
      this.setReloading(true)
      // this.setState({ reloading: true })
      if (this.socket) {
        this.socket.disconnect()
      }
    })

    this.socket.on('unauthorized', (error) => {
      console.log('unauthorized', error)
      if (
        error.data.type === 'UnauthorizedError' ||
        error.data.code === 'invalid_token'
      ) {
        this.servererrorhandler(null, 'unauthorized', null)
        // redirect user to login page perhaps?
        console.log('User token has expired')
      }
    })

    this.socket.on('connect_error', (err) => {
      console.log('connect error', err.message)
      this.servererrorhandler(null, 'connect error: ' + err.message, null)
      this.setReloading(true)
    })

    // may be also bgpdf info
  }

  scheduleReauthor() {
    if (this.reauthorizeTimeout) {
      clearTimeout(this.reauthorizeTimeout)
      this.reauthorizeTime = null
    }
    this.reauthorizeTimeout = setTimeout(this.requestReauthor, 5 * 60 * 1000) // renew every 5 Minutes, a token last 10 minutes
  }

  requestReauthor() {
    if (this.socket) this.socket.emit('reauthor', {})
  }

  authCB(cb) {
    const token = this.getToken()
    // console.log("authCB",cb);
    // eslint-disable-next-line n/no-callback-literal
    cb({ token })
  }

  decodedToken() {
    const curtoken = this.getToken()
    // console.log("tokens internal",curtoken,this.decoded_token_int, window.failstoken, this.lastdectoken);
    if (curtoken !== this.lastdectoken && curtoken !== undefined) {
      try {
        this.decoded_token_int = jwt_decode(curtoken)
        this.lastdectoken = curtoken
      } catch (error) {
        console.log('curtoken', curtoken)
        console.log('token error', error)
      }
    }
    // console.log("tokens",curtoken,this.decoded_token_int);

    return this.decoded_token_int
  }

  sendId() {
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ task: 'idinform', id: this.socket.id })
    this.av.postMessage({
      task: 'idchange'
    })
  }

  initializeSocketHandlersNotepads() {
    this.socket.removeAllListeners('connect')
    this.socket.on('connect', (data) => {
      setTimeout(() => {
        this.socket.emit('sendboards', {})
      }, 100)
      this.connectCrypto()
      this.scheduleReauthor()
      this.sendId()
    })
  }

  initializeSocketHandlersScreens() {
    this.socket.removeAllListeners('connect')
    this.socket.on('connect', (data) => {
      // if (this.noteref) this.noteref.setHasControl(false) // do not emit while reloading!
      /* setTimeout(() => {
          if (this.sshh.shhh) console.log('do error')
          notepadsocket.emit('sendboards', {})
        }, 500) */
      // this.updateSizes() // inform sizes
      this.connectCrypto()
      this.scheduleReauthor()
      this.sendId()
    })
  }

  initializeSocketHandlersNotes() {
    this.socket.removeAllListeners('connect')
    this.socket.on('connect', (data) => {
      // if (this.noteref) this.noteref.setHasControl(false) // do not emit while reloading!
      /* setTimeout(() => {
          if (this.sshh.shhh) console.log('do error')
          notepadsocket.emit('sendboards', {})
        }, 500) */
      // this.updateSizes() // inform sizes
      this.connectCrypto()
      this.scheduleReauthor()
      this.sendId()
    })
  }

  disconnect() {
    console.log('socket disconnect')
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.idents = {}
    this.keyobject = { exptime: Date.now() / 1000 + 10 } // we have 10 seconds for a new key
    this.keymaster = false
  }

  servererrorhandler(code, message, type) {
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ task: 'servererror', code, message, type })
  }

  setReloading(reloading) {
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ task: 'setReloading', reloading })
  }

  setExpiredToken(expiredToken) {
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ task: 'setExpiredToken', expiredToken })
  }

  getToken() {
    // console.log("gettoken",this.myauthtoken);
    if (this.myauthtoken) return this.myauthtoken
  }

  handleBlackboard(event) {
    if (event.data.command && this.socket) {
      this.socket.emit(event.data.command, event.data.data)
    }
  }

  handleAV(event) {
    if (event.data.command && this.socket) {
      this.socket.emit(event.data.command, event.data.data, (data) => {
        switch (event.data.command) {
          case 'gettransportinfo':
            if (data.error) {
              this.av.postMessage({
                task: 'transportinfo',
                error: data.error
              })
              this.servererrorhandler(
                -1,
                'AVS: ' + data.error,
                'AVS Transport error'
              )
            } else {
              this.av.postMessage({
                task: 'transportinfo',
                data: {
                  url: data.url,
                  wsurl: data.wsurl,
                  spki: data.spki,
                  token: data.token
                }
              })
            }
            break
          case 'getrouting':
            console.log('getrouting', data)
            if (data.error) {
              this.av.postMessage({
                task: 'tickets',
                error: data.error,
                webworkid: event.data.webworkid,
                queryid: event.data.queryid
              })
              this.servererrorhandler(
                -1,
                'AVS: ' + data.error,
                'AVS ticket error'
              )
            } else if (data.notfound) {
              console.log('client not found in network', data.notfound)
              this.av.postMessage({
                task: 'tickets',
                error: 'Client not found in network',
                webworkid: event.data.webworkid,
                queryid: event.data.queryid
              })
            } else {
              this.av.postMessage({
                task: 'tickets',
                data: {
                  tickets: data.tickets
                },
                webworkid: event.data.webworkid,
                queryid: event.data.queryid
              })
            }
            break

          default:
          // do nothing
        }
      })
    }
  }

  onMessage(event) {
    // console.log('SocketWorker onMessage', event.data, this, this.socket)
    const task = event.data.task
    // console.log('got event with task', task)
    switch (task) {
      case 'on':
        {
          const prot = ['connect', 'disconnect']
          if (!prot.includes(event.data.command))
            this.socket.removeAllListeners(event.data.command)
          this.socket.on(event.data.command, (data) => {
            // eslint-disable-next-line no-restricted-globals
            self.postMessage({ task: 'on', command: event.data.command, data })
          })
        }
        break
      case 'sendToken':
        this.myauthtoken = event.data.token
        break
      case 'boardchannel':
        if (event.data.pipe) {
          this.blackboard = event.data.pipe
          this.blackboard.onmessage = this.handleBlackboard
        } else throw new Error('boardchannel without pipe')
        break
      case 'avchannel':
        if (event.data.pipe) {
          this.av = event.data.pipe
          this.av.onmessage = this.handleAV
        } else throw new Error('avchannel without pipe')
        break
      case 'connectNotepad':
        this.connectNotepad()
        console.log('connect notepad ready', this, this.socket)
        break
      case 'connectScreen':
        this.connectScreen()
        break
      case 'connectNotes':
        this.connectNotes()
        break
      case 'disconnect':
        this.disconnect()
        break
      case 'createScreen':
        this.socket.emit('createscreen', (ret) => {
          // eslint-disable-next-line no-restricted-globals
          self.postMessage({ task: 'createScreen', data: ret })
        })
        break
      case 'createNotepad':
        this.socket.emit('createnotepad', (ret) => {
          // eslint-disable-next-line no-restricted-globals
          self.postMessage({ task: 'createNotepad', data: ret })
        })
        break
      case 'getAvailablePicts':
        this.socket.emit('getAvailablePicts', (ret) => {
          // eslint-disable-next-line no-restricted-globals
          self.postMessage({ task: 'getAvailablePicts', data: ret })
        })
        break
      case 'getPolls':
        this.socket.emit('getPolls', (ret) => {
          // eslint-disable-next-line no-restricted-globals
          self.postMessage({ task: 'getPolls', data: ret })
        })
        break
      case 'castVote':
        this.socket.emit('castvote', event.data.data, (ret) => {
          // eslint-disable-next-line no-restricted-globals
          self.postMessage({ task: 'castVote', data: ret })
        })
        break
      case 'simpleEmit':
        console.log(
          'simpleEmit',
          this,
          event.data,
          event.data.command,
          event.data.data
        )
        this.socket.emit(event.data.command, event.data.data)
        break

      default:
        console.log('Unhandled message task (AVWorker):', task)
    }
  }
}

const socketworker = new SocketWorker()
console.log('SocketWorker addEventListener')
// eslint-disable-next-line no-restricted-globals
self.addEventListener('message', socketworker.onMessage)
console.log('SocketWorker started')
