/*
    Fails Components (Fancy Automated Internet Lecture System - Components)
    Copyright (C)  2015-2017 (original FAILS), 
                   2021- (FAILS Components)  Marten Richter <marten.richter@freenet.de>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { KeyStore } from '../misc/keystore'
export class SocketInterface {
  static worker = new Worker(new URL('./worker.js', import.meta.url), {
    type: 'module'
  })

  static interf = null

  constructor(
    args // do not call directly
  ) {
    this.onMessage = this.onMessage.bind(this)
    this.onError = this.onError.bind(this)
    this.onMessageError = this.onMessageError.bind(this)

    // this.finalizeCallback = this.finalizeCallback.bind(this)
    // this.finalization = new FinalizationRegistry(this.finalizeCallback)

    this.mediadevicesupported = false
    this.servererrorhandler = null
    this.informIdentshandler = null

    this.createScreenReq = []
    this.createNotepadReq = []
    this.getAvailablePictsReq = []
    this.getAvailableIpynbsReq = []
    this.uploadPictureReq = {}
    this.getPollsReq = []
    this.castVoteReq = []

    this.handlers = {}
  }

  setInitialDecodedToken(decodedToken) {
    this.decodedtoken = decodedToken
  }

  static createSocketInterface(args) {
    if (SocketInterface.interf !== null) return SocketInterface.interf
    const interf = (SocketInterface.interf = new SocketInterface(args))
    SocketInterface.worker.addEventListener('message', interf.onMessage)
    SocketInterface.worker.addEventListener('error', interf.onError)
    SocketInterface.worker.addEventListener(
      'messageerror',
      interf.onMessageError
    )
    return SocketInterface.interf
  }

  static getInterface() {
    return SocketInterface.interf
  }

  onMessage(event) {
    const task = event.data.task
    switch (task) {
      case 'on':
        {
          const command = event.data.command
          if (command in this.handlers) {
            this.handlers[command](event.data.data)
          } else throw new Error('Unknown Command: ' + command)
        }
        break
      case 'servererror':
        {
          const data = event.data
          console.log('servererror ', data.code, data.message, data.type)
          if (this.servererrorhandler)
            this.servererrorhandler(data.code, data.message, data.type)
        }
        break
      case 'setReloading':
        if (this.setReloading) this.setReloading(event.data.reloading)
        break
      case 'setExpiredToken':
        if (this.setExpiredToken) this.setExpiredToken(event.data.expiredToken)
        break
      case 'createScreen':
        if (this.createScreenReq.length === 0)
          throw new Error('createScreen without request')
        this.createScreenReq.shift().resolve(event.data.data)
        break
      case 'createNotepad':
        if (this.createNotepadReq.length === 0)
          throw new Error('createNotepad without request')
        this.createNotepadReq.shift().resolve(event.data.data)
        break
      case 'getAvailablePicts':
        if (this.getAvailablePictsReq.length === 0)
          throw new Error('getAvailablePicts without request')
        this.getAvailablePictsReq.shift().resolve(event.data.data)
        break
      case 'getAvailableIpynbs':
        if (this.getAvailableIpynbsReq.length === 0)
          throw new Error('getAvailableIpynbs without request')
        this.getAvailableIpynbsReq.shift().resolve(event.data.data)
        break
      case 'uploadPicture':
        if (
          !this.uploadPictureReq[event.data.data.name] ||
          this.uploadPictureReq[event.data.data.name].length === 0
        )
          throw new Error('uploadPicture without request')
        if (event.data.data.error) {
          this.uploadPictureReq[event.data.data.name]
            .shift()
            .reject(new Error(event.data.data.error))
        } else {
          this.uploadPictureReq[event.data.data.name]
            .shift()
            .resolve(event.data.data)
        }
        if (this.uploadPictureReq[event.data.data.name].length === 0)
          delete this.uploadPictureReq[event.data.data.name]

        break
      case 'getPolls':
        if (this.getPollsReq.length === 0)
          throw new Error('getPolls without request')
        this.getPollsReq.shift().resolve(event.data.data)
        break
      case 'castVote':
        if (this.castVoteReq.length === 0)
          throw new Error('castVote without request')
        this.castVoteReq.shift().resolve(event.data.data)
        break
      case 'setToken':
        if (event.data.token)
          sessionStorage.setItem('failstoken', event.data.token)
        this.decodedtoken = event.data.decodedToken
        this.updateUserHash()
        break
      case 'idinform':
        if (event.data.id) this.id = event.data.id
        break
      case 'informIdentities':
        if (event.data.idents && this.informIdentshandler)
          this.informIdentshandler(event.data)
        break
      case 'keychange':
        {
          const keyobj = event.data.keyobject
          KeyStore.getKeyStore().incomingKey(keyobj)
        }
        break
      default:
        console.log('unhandled onMessage', event)
        break
    }
  }

  decodedToken() {
    return this.decodedtoken
  }

  async updateUserHash() {
    try {
      const useruuid = this.decodedtoken?.user?.useruuid
      if (!useruuid) return // no user uuid
      // now we need unique identifier of the device
      let deviceuuid = localStorage.getItem('failsdeviceuuid')
      if (!deviceuuid) {
        deviceuuid = globalThis.crypto.randomUUID()
        localStorage.setItem('failsdeviceuuid', deviceuuid)
      }
      const data = new TextEncoder().encode(useruuid + ':' + deviceuuid)
      this.userhash = btoa(
        String.fromCharCode(
          ...new Uint8Array(await crypto.subtle.digest('SHA-256', data))
        )
      )
    } catch (error) {
      console.log('Problem updateUserHash', error)
    }
  }

  getUserHash() {
    return this.userhash
  }

  onMessageError(event) {}

  onError(event) {}

  on(command, handler) {
    this.handlers[command] = handler

    SocketInterface.worker.postMessage({
      task: 'on',
      command
    })
  }

  setServerErrorHandler(handler) {
    this.servererrorhandler = handler
  }

  setInformIdentsHandler(handler) {
    this.informIdentshandler = handler
  }

  setReloadingHandler(handler) {
    this.setReloading = handler
  }

  setExpiredTokenHandler(handler) {
    this.setExpiredToken = handler
  }

  setBoardChannel(bc) {
    SocketInterface.worker.postMessage(
      {
        task: 'boardchannel',
        pipe: bc
      },
      [bc]
    )
  }

  setAVChannel(av) {
    SocketInterface.worker.postMessage(
      {
        task: 'avchannel',
        pipe: av
      },
      [av]
    )
  }

  createScreen() {
    const promise = new Promise((resolve, reject) => {
      this.createScreenReq.push({ resolve, reject })
    })
    SocketInterface.worker.postMessage({
      task: 'createScreen'
    })
    return promise
  }

  createNotepad() {
    const promise = new Promise((resolve, reject) => {
      this.createNotepadReq.push({ resolve, reject })
    })
    SocketInterface.worker.postMessage({
      task: 'createNotepad'
    })
    return promise
  }

  getAvailablePicts() {
    const promise = new Promise((resolve, reject) => {
      this.getAvailablePictsReq.push({ resolve, reject })
    })
    SocketInterface.worker.postMessage({
      task: 'getAvailablePicts'
    })
    return promise
  }

  getAvailableIpynbs() {
    const promise = new Promise((resolve, reject) => {
      this.getAvailableIpynbsReq.push({ resolve, reject })
    })
    SocketInterface.worker.postMessage({
      task: 'getAvailableIpynbs'
    })
    return promise
  }

  async uploadPicture(name, picture, thumbnail) {
    if (!name) throw new Error('No name passed to upload picture')
    const promise = new Promise((resolve, reject) => {
      if (!this.uploadPictureReq[name]) this.uploadPictureReq[name] = []
      this.uploadPictureReq[name].push({ resolve, reject })
    })
    const pictbuffer = await picture.arrayBuffer()
    const thumbbuffer = await thumbnail.arrayBuffer()
    SocketInterface.worker.postMessage({
      task: 'uploadPicture',
      name,
      picture: pictbuffer,
      thumbnail: thumbbuffer,
      type: picture.type
    })
    return promise
  }

  getPolls() {
    const promise = new Promise((resolve, reject) => {
      this.getPollsReq.push({ resolve, reject })
    })
    SocketInterface.worker.postMessage({
      task: 'getPolls'
    })
    return promise
  }

  castVote(data) {
    const promise = new Promise((resolve, reject) => {
      this.castVoteReq.push({ resolve, reject })
    })
    SocketInterface.worker.postMessage({
      task: 'castVote',
      data
    })
    return promise
  }

  simpleEmit(command, data) {
    SocketInterface.worker.postMessage({
      task: 'simpleEmit',
      command,
      data
    })
  }

  connectNotepad() {
    this.sendToken()
    SocketInterface.worker.postMessage({
      task: 'connectNotepad'
    })
  }

  connectScreen() {
    this.sendToken()
    SocketInterface.worker.postMessage({
      task: 'connectScreen'
    })
  }

  connectNotes() {
    this.sendToken()
    SocketInterface.worker.postMessage({
      task: 'connectNotes'
    })
  }

  disconnect() {
    SocketInterface.worker.postMessage({
      task: 'disconnect'
    })
  }

  sendToken() {
    console.log('sendtoken', sessionStorage.getItem('failstoken'))
    SocketInterface.worker.postMessage({
      task: 'sendToken',
      token: sessionStorage.getItem('failstoken')
    })
  }
}
