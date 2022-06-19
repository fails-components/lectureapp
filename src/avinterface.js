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

import React, { Component } from 'react'

// in this file we will provide the interface for the avworker

export class AVVideoRender extends Component {
  constructor(args) {
    super(args)
    this.videoref = React.createRef()
    this.webworkid = AVInterface.interf.getNewId()
    this.srcwebworkid = null
    this.lastcanvas = null
    this.state = { wwidth: 100 }
    AVInterface.interf.registerForFinal(this, this.webworkid)
    AVInterface.worker.postMessage({
      task: 'newAVVideoRender',
      webworkid: this.webworkid
    })

    this.resizeeventlistener = this.resizeeventlistener.bind(this)
  }

  componentDidMount() {
    window.addEventListener('resize', this.resizeeventlistener)
    this.updateOffscreen()
    this.resizeeventlistener()
    this.outputStart()
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeeventlistener)
    AVInterface.worker.postMessage({
      task: 'close',
      webworkid: this.webworkid
    })
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (prevProps.videoid !== this.props.videoid && this.state.output) {
      this.state.output.setSrcId(this.props.videoid)
    }
    if (!prevState || prevState.output !== this.state.output) {
      this.state.output.setOutputRender(this)
    }

    this.updateOffscreen()
  }

  resizeeventlistener(e) {
    if (
      this.state.wwidth !== window.innerWidth ||
      this.state.wheight !== window.innerHeight
    ) {
      this.setState({
        wwidth: window.innerWidth,
        wheight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1
      })
      const width = this.props.width || 10
      AVInterface.worker.postMessage({
        task: 'AVVideoRenderSize',
        webworkid: this.webworkid,
        width: (window.innerWidth * width) / 100,
        devicePixelRatio: window.devicePixelRatio || 1
      })
    }
  }

  async outputStart() {
    try {
      const avinterf = AVInterface.getInterface()
      const outputobj = avinterf.openVideoOutput()

      let output = outputobj
      output = await output
      output.buildIncomingPipeline()
      if (this.props.videoid) outputobj.setSrcId(this.props.videoid)
      output.setOutputRender(this)
      this.updateOffscreen()
      this.setState({ output })
    } catch (error) {
      console.log('outputStart failed', error)
    }
  }

  updateOffscreen() {
    if (this.videoref.current) {
      if (this.videoref.current !== this.lastcanvas) {
        this.lastcanvas = this.videoref.current
        this.offscreen = this.videoref.current.transferControlToOffscreen()
        this.updateOffScreenRender(this.offscreen)
      }
    }
  }

  updateOffScreenRender(offscreen) {
    AVInterface.worker.postMessage(
      {
        task: 'updateOffScreenRender',
        webworkid: this.webworkid,
        offscreen
      },
      [offscreen]
    )
  }

  render() {
    return (
      <canvas
        ref={this.videoref}
        style={{ display: 'block', background: 'black' }}
      ></canvas>
    )
  }
}

export class AVStream {
  constructor(args) {
    this.webworkid = args.webworkid
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

export class AVCameraStream extends AVDeviceInputStream {
  // eslint-disable-next-line no-useless-constructor
  constructor(args) {
    super(args)
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
    if (!nosave) localStorage.setItem('failsvideodeviceid', id)
    console.log('mstream object', mstream)

    const track = mstream.getTracks()[0]
    console.log('mtrackobject', track)
    console.log('track settings', track.getSettings())
    await track.applyConstraints({
      frameRate: 30.0
    })
    console.log('track settings after', track.getSettings())

    // eslint-disable-next-line no-undef
    const trackprocessor = new MediaStreamTrackProcessor({ track })
    if (!this.track) {
      // now we will drop the track to the worker
      AVInterface.worker.postMessage(
        {
          task: 'openVideoCamera',
          webworkid: this.webworkid,
          readable: trackprocessor.readable
        },
        [trackprocessor.readable]
      )
    } else {
      AVInterface.worker.postMessage(
        {
          task: 'switchVideoCamera',
          webworkid: this.webworkid,
          readable: trackprocessor.readable
        },
        [trackprocessor.readable]
      )
    }

    this.track = track
  }
}

export class AVMicrophoneStream extends AVDeviceInputStream {
  // eslint-disable-next-line no-useless-constructor
  constructor(args) {
    super(args)
    this.dbUpdate = this.dbUpdate.bind(this)
    this.dbupdate = setInterval(this.dbUpdate, 100)
    this.dbCbs = new Set()
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
    this.dbCbs.remove(cb)
  }

  dbUpdate() {
    const db = this.getDB()
    const now = Date.now()
    this.lastdbtime = now
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
    if (!nosave) localStorage.setItem('failsaudiodeviceid', id)
    console.log('audio mstream object', mstream)

    const track = mstream.getTracks()[0]
    console.log('audio mtrackobject', track)
    console.log('audio track settings', track.getSettings())
    await track.applyConstraints({
      sampleRate: 48000
    })
    console.log('audio track settings after', track.getSettings())

    // eslint-disable-next-line no-undef
    const trackprocessor = new MediaStreamTrackProcessor({ track })
    if (!this.track) {
      // now we will drop the track to the worker
      AVInterface.worker.postMessage(
        {
          task: 'openAudioMicrophone',
          webworkid: this.webworkid,
          readable: trackprocessor.readable
        },
        [trackprocessor.readable]
      )
    } else {
      AVInterface.worker.postMessage(
        {
          task: 'switchAudioMicrophone',
          webworkid: this.webworkid,
          readable: trackprocessor.readable
        },
        [trackprocessor.readable]
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
  }
}

export class AVInputStream extends AVStream {
  close() {
    AVInterface.worker.postMessage({
      task: 'close',
      webworkid: this.webworkid
    })
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
  constructor(args) {
    super(args)
    this.initalizeAudio()
  }

  close() {
    this.audiosrc.disconnect()
    super.close()
  }

  initalizeAudio() {
    const avinterf = AVInterface.getInterface()
    const ac = avinterf.getAudioContext()

    // eslint-disable-next-line no-undef
    this.track = new MediaStreamTrackGenerator({ kind: 'audio' })

    const mstream = new MediaStream([this.track])

    this.audiosrc = ac.createMediaStreamSource(mstream)

    this.audiosrc.connect(ac.destination)

    AVInterface.worker.postMessage(
      {
        task: 'openAudioSpeaker',
        webworkid: this.webworkid,
        writable: this.track.writable
      },
      [this.track.writable]
    )
  }
}

export class AVRenderStream extends AVInputStream {
  constructor(args) {
    super(args)

    AVInterface.worker.postMessage({
      task: 'openVideoDisplay',
      webworkid: this.webworkid
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
  static worker = new Worker(new URL('./avworker.js', import.meta.url))
  static interf = null

  constructor(
    args // do not call directly
  ) {
    this.onMessage = this.onMessage.bind(this)
    this.onError = this.onError.bind(this)
    this.onMessageError = this.onMessageError.bind(this)

    this.idCount = 1 // id assigned to objects, to identify them here and in the worker
    this.objects = {} // objects identifable by id, but can be garbage collected

    this.finalizeCallback = this.finalizeCallback.bind(this)
    this.finalization = new FinalizationRegistry(this.finalizeCallback)

    this.mediadevicesupported = false
  }

  static createAVInterface(args) {
    if (AVInterface.interf !== null)
      throw new Error('AV Interface already created')
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
    if (!this.audiocontext)
      this.audiocontext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      })
    return this.audiocontext
  }

  queryMediaSupported() {
    // here we check if media capabilites are here
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.log('enumerateDevices() not supported.')
      return false
    }
    if (!navigator.mediaDevices.getUserMedia) {
      console.log('getUserMedia() not supported.')
      return false
    }
    if (
      !('MediaStreamTrackProcessor' in window) ||
      !('MediaStreamTrackGenerator' in window)
    ) {
      console.log('MediaStreamTrackProcessor')
      return false
    }
    this.mediadevicesupported = true
    return true
  }

  onMessage(event) {
    const task = event.data.task
    switch (task) {
      case 'getDb':
        {
          const id = event.data.webworkid
          if (!id) {
            console.log('getDb', event.data)
            throw new Error('getDb, no id passed')
          }
          const obj = this.objects[event.data.webworkid].deref()
          let ret
          if (obj) {
            ret = obj.getDB()
          } else {
            ret = -100
          }
          AVInterface.worker.postMessage({
            task: 'getDb',
            webworkid: id,
            db: ret
          })
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

  async finalizeCallback(webworkid) {
    AVInterface.worker.postMessage({
      task: 'cleanUpObject',
      webworkid
    })
    delete this.objects[webworkid]
    if (this.audiocontext) {
      this.audiocontext.close()
      await delete this.audiocontext
    }
  }

  registerForFinal(obj, webworkid) {
    this.objects[webworkid] = new WeakRef(obj)
    this.finalization.register(obj, webworkid)
  }

  async getAVDevices() {
    if (!this.mediadevicesupported) return null
    if (!this.devices) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      } catch (error) {
        console.log('getAVDevices, getUserMedia...', error)
      }
    }
    this.devices = await navigator.mediaDevices.enumerateDevices()
    return this.devices
  }

  async openVideoCamera(args) {
    if (!this.mediadevicesupported) return
    try {
      if (!this.devices) await this.getAVDevices()
      const oldid = localStorage.getItem('failsvideodeviceid')
      let devices = this.devices.filter((el) => el.kind === 'videoinput')
      if (devices.length < 1) throw new Error('no Video devices available')
      const olddevice = devices.filter((el) => el.deviceId === oldid)
      if (olddevice.length > 0) devices = olddevice
      const device = devices[0]
      // ok now we have one we can finally open the video stuff
      console.log('video device', device)
      const webworkid = this.getNewId()

      const avobj = new AVCameraStream({
        webworkid
      })
      this.registerForFinal(avobj, webworkid)

      await avobj.switchCamera(device.deviceId)

      return avobj
    } catch (error) {
      console.log('error opening video device', error)
    }
  }

  async openAudioMicrophone(args) {
    if (!this.mediadevicesupported) return
    try {
      if (!this.devices) await this.getAVDevices()
      const oldid = localStorage.getItem('failsaduiodeviceid')
      let devices = this.devices.filter((el) => el.kind === 'audioinput')
      if (devices.length < 1) throw new Error('no Audio devices available')
      const olddevice = devices.filter((el) => el.deviceId === oldid)
      if (olddevice.length > 0) devices = olddevice
      const device = devices[0]
      // ok now we have one we can finally open the video stuff
      console.log('audio device', device)
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
        webworkid
      })
      this.registerForFinal(avobj, webworkid)

      return avobj
    } catch (error) {
      console.log('error opening video device', error)
    }
  }

  async openAudioOutput(args) {
    // if (!this.mediadevicesupported) return
    try {
      const webworkid = this.getNewId()

      const avobj = new AVSpeakerStream({
        webworkid
      })
      this.registerForFinal(avobj, webworkid)

      return avobj
    } catch (error) {
      console.log('error opening audio device', error)
    }
  }
}
