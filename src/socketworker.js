import { io } from 'socket.io-client'
// eslint-disable-next-line camelcase
import jwt_decode from 'jwt-decode'

class SocketWorker {
  constructor(args) {
    this.onMessage = this.onMessage.bind(this)
    this.objects = {}

    this.requestReauthor = this.requestReauthor.bind(this)
    this.getToken = this.getToken.bind(this)
    this.authCB = this.authCB.bind(this)
    this.reauthorizeTimeout = null

    this.handleBlackboard = this.handleBlackboard.bind(this)

    this.periodicStatusCheck = this.periodicStatusCheck.bind(this)
    // eslint-disable-next-line no-restricted-globals
    self.setInterval(this.periodicStatusCheck, 1000)
  }

  periodicStatusCheck() {
    const token = this.decodedToken()
    let expired = true
    if (token && token.exp && token.exp - Date.now() / 1000 > 0) expired = false

    if (this.tokenexpired !== expired) {
      this.setExpiredToken(expired)
      this.tokenexpired = expired
    }
  }

  netSendSocket(command, data) {
    if (this.socket) this.socket.emit(command, data)
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

  initializeSocketHandlersNotepads() {
    this.socket.removeAllListeners('connect')
    this.socket.on('connect', (data) => {
      setTimeout(() => {
        this.socket.emit('sendboards', {})
      }, 100)
      this.scheduleReauthor()
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
      this.scheduleReauthor()
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
      this.scheduleReauthor()
    })
  }

  disconnect() {
    console.log('socket disconnect')
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
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
