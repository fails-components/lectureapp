/*
    Fails Components (Fancy Automated Internet Lecture System - Components)
    Copyright (C)  2022- (FAILS Components)  Marten Richter <marten.richter@freenet.de>

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

import { MediaStreamTrackProcessor as MediaStreamTrackProcessorPolyfill } from './webcodecs-ponyfills.js'
import { transferReadableStream } from './transferable-stream-of-transferables'
import Color from 'color'

// install polyfills, if required
let MediaStreamTrackProcessor
// eslint-disable-next-line no-constant-condition
if (!('MediaStreamTrackProcessor' in globalThis)) {
  MediaStreamTrackProcessor = MediaStreamTrackProcessorPolyfill
} else {
  MediaStreamTrackProcessor = globalThis.MediaStreamTrackProcessor
}

// storage options

export function getSetting(key) {
  if (AVInterface.userhash) {
    // get user value
    const ret = localStorage.getItem(key + ':' + AVInterface.userhash)
    if (!ret) return ret
  } // if it does not exist fall through to default
  return localStorage.getItem(key)
}

export function setSetting(key, value) {
  if (AVInterface.userhash) {
    localStorage.setItem(key + ':' + AVInterface.userhash, value)
  }
  return localStorage.setItem(key, value)
}

export class AVStream {
  constructor(args) {
    this.webworkid = args.webworkid
    this.avinterf = AVInterface.interf // hold interface
  }
}

export class AVDeviceInputStream extends AVStream {
  constructor(args) {
    super(args)
    this.track = args.track
    this.deviceId = args.deviceId
  }

  getDeviceId() {
    return this.deviceId
  }

  close() {
    AVInterface.worker.postMessage({
      task: 'close',
      webworkid: this.webworkid
    })
  }

  setDestId(id) {
    // TODO move AVTransport into worker
    AVInterface.worker.postMessage({
      task: 'setDestId',
      webworkid: this.webworkid,
      id
    })
  }

  buildOutgoingPipeline() {
    AVInterface.worker.postMessage(
      {
        task: 'buildOutgoingPipeline',
        webworkid: this.webworkid
      },
      []
    )
  }
}

export class AVVideoInputStream extends AVDeviceInputStream {
  // eslint-disable-next-line no-useless-constructor
  constructor(args) {
    super(args)
    this.off = true
  }

  changeBackgroundRemover({ off, color, type }) {
    AVInterface.worker.postMessage({
      task: 'changeBackgroundRemover',
      webworkid: this.webworkid,
      off,
      color: Color(color).object(),
      type
    })
  }

  videoOff() {
    if (this.track && !this.off) {
      this.track.enabled = false
      this.off = true
      AVInterface.worker.postMessage({
        task: 'offChange',
        webworkid: this.webworkid,
        off: this.off
      })
    }
  }

  videoOn() {
    if (this.track && this.off) {
      this.track.enabled = true
      this.off = false
      AVInterface.worker.postMessage({
        task: 'offChange',
        webworkid: this.webworkid,
        off: this.off
      })
    }
  }

  off() {
    return this.off
  }

  async switchCamera(id, nosave) {
    if (this.track) this.track.stop()
    const mstream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: id },
        width: 1280,
        height: 720,
        aspectRatio: { ideal: 16 / 9 }
      }
    })
    this.deviceId = id
    if (!nosave) setSetting('failsvideodeviceid', id)
    console.log('mstream object', mstream)

    const track = mstream.getTracks()[0]
    console.log('mtrackobject', track)
    console.log('track settings', track.getSettings())
    await track.applyConstraints({
      frameRate: 30.0
    })
    console.log('track settings after', track.getSettings())

    this.switchTrack({ track, screenshare: false })
  }

  async switchScreencast({ desktopElement, videoDevice }) {
    if (this.track) this.track.stop()

    let mstream
    if (videoDevice) {
      mstream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: videoDevice.deviceId },
          width: 1280,
          height: 720,
          aspectRatio: { ideal: 16 / 9 }
        }
      })
      this.deviceId = videoDevice
    } else if (desktopElement) {
      mstream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        monitorTypeSurfaces: 'include',
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'exclude',
        systemAudio: 'exclude'
      })
    } else {
      throw new Error('Screencast is neither video nor desktop element')
    }
    console.log('mstream object', mstream)

    const track = mstream.getTracks()[0]
    console.log('mtrackobject', track)
    console.log('track settings', track.getSettings())
    await track.applyConstraints({
      frameRate: 15.0,
      cursor: 'motion'
    })
    console.log('track settings after', track.getSettings())
    this.switchTrack({ track, screenshare: true })
  }

  switchTrack({ track, screenshare }) {
    // eslint-disable-next-line no-undef
    const trackprocessor = new MediaStreamTrackProcessor({
      track,
      maxBufferSize: 10
    })
    if (!this.track) {
      // now we will drop the track to the worker
      AVInterface.worker.postMessage(
        {
          task: 'openVideoInput',
          webworkid: this.webworkid,
          screenshare,
          readable: transferReadableStream(
            trackprocessor.readable,
            trackprocessor.isPolyfill
          )
        },
        [
          transferReadableStream(
            trackprocessor.readable,
            trackprocessor.isPolyfill
          )
        ]
      )
    } else {
      AVInterface.worker.postMessage(
        {
          task: 'switchVideoInput',
          screenshare,
          webworkid: this.webworkid,
          readable: transferReadableStream(
            trackprocessor.readable,
            trackprocessor.isPolyfill
          )
        },
        [
          transferReadableStream(
            trackprocessor.readable,
            trackprocessor.isPolyfill
          )
        ]
      )
    }

    this.track = track
    if (this.off) this.track.enabled = false
  }
}

export class AVMicrophoneStream extends AVDeviceInputStream {
  // eslint-disable-next-line no-useless-constructor
  constructor(args) {
    super(args)
    this.dbUpdate = this.dbUpdate.bind(this)
    this.dbupdate = setInterval(this.dbUpdate, 100)
    this.dbCbs = new Set()
    this.mute = true
    this.dbHistory = Array(50).fill(-10000)
  }

  close() {
    clearInterval(this.dbupdate)
    if (this.analyser) this.analyser.disconnect()
    super.close()
  }

  registerDB(cb) {
    this.dbCbs.add(cb)
  }

  unregisterDB(cb) {
    this.dbCbs.delete(cb)
  }

  dbUpdate() {
    const db = this.getDB()
    const now = Date.now()
    this.lastdbtime = now
    this.dbHistory.push(db)
    this.dbHistory.shift()
    this.dbCbs.forEach((el) => el(db))
  }

  getDB() {
    if (this.analyser) {
      this.analyser.getFloatFrequencyData(this.dbdata)
      let dbout = -1000000
      for (let i = 0; i < this.dbdata.length; i++) {
        if (this.dbdata[i] > dbout) {
          dbout = this.dbdata[i]
        }
      }
      return dbout
    } else return -10000
  }

  getDBMax() {
    return Math.max(...this.dbHistory)
  }

  muteOn() {
    if (this.track && !this.mute) {
      this.track.enabled = false
      this.mute = true
      AVInterface.worker.postMessage({
        task: 'muteChangeMic',
        webworkid: this.webworkid,
        muted: this.mute
      })
    }
  }

  muteOff() {
    if (this.track && this.mute) {
      this.track.enabled = true
      this.mute = false
      AVInterface.worker.postMessage({
        task: 'muteChangeMic',
        webworkid: this.webworkid,
        muted: this.mute
      })
    }
  }

  muted() {
    return this.mute
  }

  async switchMicrophone(id, nosave) {
    if (this.track) this.track.stop()
    const mstream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: id },
        sampleRate: 48000,
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true,
        latency: 0.0, // as fast as possible
        channelCount: 1 // mono is enough
      }
    })
    this.deviceId = id
    if (!nosave) setSetting('failsaudiodeviceid', id)
    console.log('audio mstream object', mstream)

    const track = mstream.getTracks()[0]
    console.log('audio mtrackobject', track)
    console.log('audio track settings', track.getSettings())
    await track.applyConstraints({
      sampleRate: 48000
    })
    console.log('audio track settings after', track.getSettings())

    // eslint-disable-next-line no-undef
    const trackprocessor = new MediaStreamTrackProcessor({
      track,
      maxBufferSize: 10
    })
    if (!this.track) {
      // now we will drop the track to the worker
      AVInterface.worker.postMessage(
        {
          task: 'openAudioMicrophone',
          webworkid: this.webworkid,
          readable: transferReadableStream(
            trackprocessor.readable,
            trackprocessor.isPolyfill
          )
        },
        [
          transferReadableStream(
            trackprocessor.readable,
            trackprocessor.isPolyfill
          )
        ]
      )
    } else {
      AVInterface.worker.postMessage(
        {
          task: 'switchAudioMicrophone',
          webworkid: this.webworkid,
          readable: transferReadableStream(
            trackprocessor.readable,
            trackprocessor.isPolyfill
          )
        },
        [
          transferReadableStream(
            trackprocessor.readable,
            trackprocessor.isPolyfill
          )
        ]
      )
    }
    const ac = AVInterface.getInterface().getAudioContext()
    const tracksource = ac.createMediaStreamSource(mstream)
    if (this.tracksource) {
      this.tracksource.disconnect()
      delete this.tracksource
    }
    if (!this.analyser) {
      this.analyser = ac.createAnalyser()
      this.analyser.fftSize = 32
      this.analyser.smoothingTimeConstant = 0.7
      const bufferLength = this.analyser.frequencyBinCount
      this.dbdata = new Float32Array(bufferLength)
    }

    tracksource.connect(this.analyser)

    this.tracksource = tracksource

    this.track = track
    if (this.mute) this.track.enabled = false
  }
}

export class AVInputStream extends AVStream {
  constructor(args) {
    super(args)
    this.wasclosed = false
  }

  close() {
    if (!this.wasclosed) {
      AVInterface.worker.postMessage({
        task: 'close',
        webworkid: this.webworkid
      })
      this.wasclosed = true
    }
  }

  setSrcId(id) {
    // TODO move AVTransport into worker
    AVInterface.worker.postMessage({
      task: 'setSrcId',
      webworkid: this.webworkid,
      id
    })
  }

  buildIncomingPipeline() {
    AVInterface.worker.postMessage(
      {
        task: 'buildIncomingPipeline',
        webworkid: this.webworkid
      },
      []
    )
  }
}

export class AVSpeakerStream extends AVInputStream {
  close() {
    console.log('Audio AVSpeakerstream close called')
    this.audiosrc.disconnect()
    super.close()
  }

  async initalizeAudio() {
    const avinterf = AVInterface.getInterface()
    const ac = avinterf.getAudioContext()
    try {
      await avinterf.audioOutputLoaded
      this.audiosrc = new AudioWorkletNode(ac, 'AVAudioOutput', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        processorOptions: {
          /* pass this to the worklet */
        }
      })

      this.audiosrc.connect(ac.destination)

      AVInterface.worker.postMessage(
        {
          task: 'openAudioSpeaker',
          webworkid: this.webworkid,
          port: this.audiosrc.port
        },
        [this.audiosrc.port]
      )
    } catch (error) {
      console.log('Initialize audio', error)
    }
  }
}

export class AVRenderStream extends AVInputStream {
  constructor(args) {
    super(args)

    AVInterface.worker.postMessage({
      task: 'openVideoDisplay',
      webworkid: this.webworkid,
      screenshare: args.screenshare
    })
  }

  setOutputRender(render) {
    render.srcwebworkid = this.webworkid
    AVInterface.worker.postMessage({
      task: 'setOutputRender',
      webworkid: this.webworkid,
      webworkidrender: render.webworkid
    })
  }
}

export class AVInterface {
  static worker = new Worker(new URL('./avworker.js', import.meta.url), {
    type: 'module'
  })

  static interf = null
  static mediadevicesupported = false
  static userhash // unique hash, should be set, so that we can distinguish users, but should be a hash, so that we can not identify!

  constructor(
    args // do not call directly
  ) {
    this.onMessage = this.onMessage.bind(this)
    this.onError = this.onError.bind(this)
    this.onMessageError = this.onMessageError.bind(this)

    this.idCount = 1 // id assigned to objects, to identify them here and in the worker
    this.objects = {} // objects identifable by id, but can be garbage collected

    this.avstatuscbs = new Set()

    this.finalizeCallback = this.finalizeCallback.bind(this)
    this.finalization = new FinalizationRegistry(this.finalizeCallback)

    this.audioOutputLoaded = new Promise((resolve, reject) => {
      this.audioOutputLoadedRes = resolve
      this.audioOutputLoadedRej = reject
    })
  }

  static createAVInterface(args) {
    if (AVInterface.interf !== null)
      throw new Error('AV Interface already created')
    if (args.userhash) AVInterface.userhash = args.userhash
    const interf = (AVInterface.interf = new AVInterface(args))
    AVInterface.worker.addEventListener('message', interf.onMessage)
    AVInterface.worker.addEventListener('error', interf.onError)
    AVInterface.worker.addEventListener('messageerror', interf.onMessageError)
    return AVInterface.interf
  }

  static getInterface() {
    return AVInterface.interf
  }

  static setNetworkControl(pipe) {
    if (AVInterface.interf === null) throw new Error('AV Interface not created')
    AVInterface.worker.postMessage(
      {
        task: 'networkControl',
        pipe
      },
      [pipe]
    )
  }

  getAudioContext() {
    if (!this.audiocontext) {
      this.audiocontext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      })
      this.audiocontext.audioWorklet
        .addModule(new URL('./avaudiooutput-worklet.js', import.meta.url))
        .then(() => {
          console.log('AVAudioOutputWorklet loaded')
          this.audioOutputLoadedRes()
        })
        .catch((error) => {
          this.audioOutputLoadedRej(error)
          console.log('Problem loading audio output', error)
        })
    }
    return this.audiocontext
  }

  static queryMediaSupported() {
    const supported = {
      videoin: true,
      videoout: true,
      audioin: true,
      audioout: true,
      screencastout: true,
      screencastin: true
    }
    AVInterface.mediadevicesupported = true
    // here we check if media capabilites are here
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.log('enumerateDevices() not supported.')
      supported.audioin = false
      supported.videoin = false
      AVInterface.mediadevicesupported = false
    }
    if (!navigator.mediaDevices.getUserMedia) {
      console.log('getUserMedia() not supported.')
      supported.audioin = false
      supported.videoin = false
      AVInterface.mediadevicesupported = false
    }
    if (!navigator.mediaDevices.getDisplayMedia) {
      supported.screencastin = false
    }
    if (!('AudioDecoder' in globalThis)) {
      console.log('AudioDecoder unsupported! We will failback to polyfill!')
    }
    if (!('VideoDecoder' in globalThis)) {
      console.log('VideoDecoder unsupported!')
      supported.videoout = false
      supported.screencastout = false
    }
    if (!('AudioEncoder' in globalThis)) {
      console.log('AudioEncoder unsupported! We will failback to polyfill!')
    }
    if (!('VideoEncoder' in globalThis)) {
      console.log('VideoEncoder unsupported!')
      supported.videoin = false
      supported.screencastin = false
    }
    if (
      navigator.userAgent.includes('Firefox') &&
      !window.location.pathname.includes('experimental') // support it on the experimental branch
    ) {
      console.log(
        'VideoEncoder is broken on Firefox at least on windows! Deactivate!'
      )
      supported.videoin = false
      supported.screencastin = false
    }
    return supported
  }

  addTransportStateListener(cb) {
    this.avstatuscbs.add(cb)
  }

  removeTransportStateListener(cb) {
    this.avstatuscbs.delete(cb)
  }

  onMessage(event) {
    const task = event.data.task
    switch (task) {
      case 'avtransportstate':
        this.avstatuscbs.forEach((cb) => cb(event.data.state))
        break
      case 'getDb':
        {
          const id = event.data.webworkid
          if (!id) {
            console.log('getDb', event.data)
            throw new Error('getDb, no id passed')
          }
          let ret = 'failed'
          if (this.objects[event.data.webworkid]) {
            const obj = this.objects[event.data.webworkid].deref()
            if (obj) {
              ret = obj.getDB()
            } else {
              ret = -100
            }
          }
          AVInterface.worker.postMessage({
            task: 'getDb',
            webworkid: id,
            db: ret
          })
        }
        break
      // getDBMax()
      case 'getDbMax':
        {
          const id = event.data.webworkid
          if (!id) {
            console.log('getDbMax', event.data)
            throw new Error('getDb, no id passed')
          }
          const obj = this.objects[event.data.webworkid].deref()
          let ret
          if (obj) {
            ret = obj.getDBMax()
          } else {
            ret = -100
          }
          AVInterface.worker.postMessage({
            task: 'getDbMax',
            webworkid: id,
            db: ret
          })
        }
        break
      case 'readableCancel':
        {
          const id = event.data.webworkid
          if (!id) {
            console.log('readableCancel', event.data)
            throw new Error('readableCancel, no id passed')
          }
          const obj = this.objects[event.data.webworkid].deref()
          obj.extCancel({ reason: event.data.reason })
        }
        break
      case 'readableBlock':
        {
          const id = event.data.webworkid
          if (!id) {
            console.log('readableBlock', event.data)
            throw new Error('readableBlock, no id passed')
          }
          const obj = this.objects[event.data.webworkid].deref()
          obj.extBlocked({ reason: event.data.block })
        }
        break
      default:
        console.log('unhandled onMessage', event)
        break
    }
  }

  onMessageError(event) {}

  onError(event) {}

  getNewId() {
    const newid = this.idCount
    this.idCount++
    return newid
  }

  finalizeCallback(webworkid) {
    console.log('AVInterface finalize')
    console.trace()
    AVInterface.worker.postMessage({
      task: 'cleanUpObject',
      webworkid
    })
    delete this.objects[webworkid]
    if (this.audiocontext) {
      this.audiocontext
        .close()
        .catch((error) => console.log('error close audiocontext', error))
      delete this.audiocontext
    }
  }

  registerForFinal(obj, webworkid) {
    this.objects[webworkid] = new WeakRef(obj)
    this.finalization.register(obj, webworkid)
  }

  async getAVDevices() {
    if (!AVInterface.mediadevicesupported) return null
    if (!this.devices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        })
        stream.getTracks().forEach((track) => track.stop())
      } catch (error) {
        console.log('getAVDevices, getUserMedia...', error)
      }
    }
    this.devices = await navigator.mediaDevices.enumerateDevices()
    return this.devices
  }

  async openVideoCamera(args) {
    if (!AVInterface.mediadevicesupported) return
    try {
      if (!this.devices) await this.getAVDevices()
      const oldid = getSetting('failsvideodeviceid')
      let devices = this.devices.filter((el) => el.kind === 'videoinput')
      if (devices.length < 1) throw new Error('no Video devices available')
      const olddevice = devices.filter((el) => el.deviceId === oldid)
      if (olddevice.length > 0) devices = olddevice
      const device = devices[0]
      // ok now we have one we can finally open the video stuff
      console.log('video device', device)
      const webworkid = this.getNewId()

      const avobj = new AVVideoInputStream({
        webworkid
      })
      this.registerForFinal(avobj, webworkid)

      await avobj.switchCamera(device.deviceId)

      return avobj
    } catch (error) {
      console.log('error opening video device', error)
    }
  }

  async openScreenCast({ desktopElement, videoDevice }) {
    // TODO rewrite
    if (!AVInterface.mediadevicesupported) return
    try {
      let device
      if (videoDevice) {
        if (!this.devices) await this.getAVDevices()
        const devices = this.devices.filter((el) => el.kind === 'videoinput')
        if (devices.length < 1) throw new Error('no Video devices available')
        const seldevices = devices.filter((el) => el.deviceId === videoDevice)

        if (seldevices.length > 0) device = seldevices[0]
        if (!seldevices) device = devices[0]
        // ok now we have one we can finally open the video stuff
        console.log('screen share video device', device)
      }
      const webworkid = this.getNewId()

      // TODO change obj?
      const avobj = new AVVideoInputStream({
        webworkid,
        screenshare: true
      })
      this.registerForFinal(avobj, webworkid)

      await avobj.switchScreencast({ desktopElement, videoDevice: device })

      return avobj
    } catch (error) {
      console.log('error opening video device', error)
    }
  }

  async openAudioMicrophone(args) {
    if (!AVInterface.mediadevicesupported) return
    try {
      if (!this.devices) await this.getAVDevices()
      const oldid = getSetting('failsaudiodeviceid')
      console.log('audiodebug oldid', oldid)
      let devices = this.devices.filter((el) => el.kind === 'audioinput')
      console.log('audiodebug old devices', devices)
      if (devices.length < 1) throw new Error('no Audio devices available')
      const olddevice = devices.filter((el) => el.deviceId === oldid)
      console.log('audiodebug old device', olddevice)
      if (olddevice.length > 0) devices = olddevice
      const device = devices[0]
      // ok now we have one we can finally open the video stuff
      console.log('audio input device', device)
      const webworkid = this.getNewId()

      const avobj = new AVMicrophoneStream({
        webworkid
      })
      this.registerForFinal(avobj, webworkid)

      await avobj.switchMicrophone(device.deviceId)

      return avobj
    } catch (error) {
      console.log('error opening audio device', error)
    }
  }

  async openVideoOutput(args) {
    // if (!this.mediadevicesupported) return
    try {
      const webworkid = this.getNewId()

      const avobj = new AVRenderStream({
        webworkid,
        screenshare: args.screenshare
      })
      this.registerForFinal(avobj, webworkid)

      return avobj
    } catch (error) {
      console.log('error opening video device', error)
    }
  }

  static canSwitchSpeaker() {
    return 'setSinkId' in AudioContext.prototype
  }

  switchSpeaker(deviceId, nosave) {
    this.speakerDeviceId = deviceId
    if (AVInterface.canSwitchSpeaker()) {
      if (!nosave) setSetting('failsaudiooutdeviceid', deviceId)
      const ac = this.getAudioContext()
      ac.setSinkId(deviceId)
    }
  }

  getSpeakerDeviceId() {
    return this.speakerDeviceId
  }

  async getSpeakerDevice() {
    if (!this.devices) await this.getAVDevices()
    const oldid = getSetting('failsaudiooutdeviceid')
    let devices = this.devices.filter((el) => el.kind === 'audiooutput')
    // does not work on firefox
    /* if (devices.length < 1)
      throw new Error('no Audio output devices available') */
    const olddevice = devices.filter((el) => el.deviceId === oldid)
    if (olddevice.length > 0) devices = olddevice
    const device = devices.length > 0 ? devices[0] : undefined
    // ok now we have one we can finally open the video stuff
    console.log('audio output device', device)
    if (device) this.switchSpeaker(device.deviceId)
  }

  async openAudioOutput(args) {
    // if (!this.mediadevicesupported) return
    try {
      await this.getSpeakerDevice()

      const webworkid = this.getNewId()

      const avobj = new AVSpeakerStream({
        webworkid
      })
      await avobj.initalizeAudio()
      this.registerForFinal(avobj, webworkid)

      return avobj
    } catch (error) {
      console.log('error opening audio device', error)
    }
  }
}
