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

import { Button } from 'primereact/button'
import { OverlayPanel } from 'primereact/overlaypanel'
import React, { Component } from 'react'
import { AVInterface } from './avinterface'
import { AVVideoRender } from './avvideorender.jsx'
import { Dropdown } from 'primereact/dropdown'
import { SelectButton } from 'primereact/selectbutton'
import { ColorPicker } from 'primereact/colorpicker'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTv,
  faMicrophoneAlt,
  faMicrophoneAltSlash,
  faVolumeXmark,
  faVolumeHigh,
  faVideo,
  faVideoSlash
} from '@fortawesome/free-solid-svg-icons'
import { fiScreenCast } from './icons/icons.jsx'
import Color from 'color'

export class SpeakerSet {
  constructor(args) {
    this.audioids = new Set()
    this.speakerStr = new Map()
    this.recycle = []
    this.mute = true
    this.audioidsmuted = new Set()
  }

  muted() {
    return this.mute
  }

  async muteOn() {
    if (!this.mute) {
      this.audioidsmuted = this.audioids // save old audio ids
    }

    this.mute = true
    try {
      await this.setAudioIds()
    } catch (error) {
      console.log('problem in mute On', error)
    }
  }

  async muteOff() {
    if (this.mute) {
      this.mute = false
      try {
        await this.setAudioIds(this.audioidsmuted)
      } catch (error) {
        console.log('problem in mute Off', error)
      }
      this.audioidsmuted = new Set()
    }
  }

  async setAudioIds(nids) {
    let newids = nids
    if (this.mute) {
      if (nids) this.audioidsmuted = nids
      newids = new Set()
    }
    // we need to hold a reference otherwise the garbage collector will clean it up
    const avinterf =
      this.avinterf || (this.avinterf = AVInterface.getInterface())
    // we have to figure out
    // (1) which ids are not speakerStr but in newids
    const newstreams = []
    // (2) which ids are in Map, and not anymore in newids
    for (const id of newids) {
      if (!this.speakerStr.has(id)) newstreams.push(id)
    }
    for (const sid of this.speakerStr.keys()) {
      if (!newids.has(sid)) {
        const ptotrash = this.speakerStr.get(sid)
        const totrash = await ptotrash
        console.log('totrash', totrash, sid)
        totrash.setSrcId(undefined) // clear the old stream
        this.recycle.push(ptotrash)
        this.speakerStr.delete(sid)
      }
    }
    // now we activate the missing ids
    for (const nid of newstreams) {
      let ns = this.recycle.pop()
      if (!ns) {
        try {
          console.log('Openaudio stream for', nid)
          const newspeaker = avinterf.openAudioOutput()
          this.speakerStr.set(nid, newspeaker)
          ns = await newspeaker
          ns.buildIncomingPipeline()
          ns.setSrcId(nid)
        } catch (error) {
          console.log('problem creating speaker, skip', error)
          continue
        }
      } else {
        ns.setSrcId(nid)
        this.speakerStr.set(nid, Promise.resolve(ns))
      }
    }
    this.audioids = newids
  }

  getListAudio() {
    return this.audioids
  }

  close() {
    this.speakerStr.forEach((speaker) => {
      speaker
        .then((spk) => spk.close())
        .catch((error) => {
          console.log('Problem closing speaker', error)
        })
    })
    this.speakerStr.clear()
    this.recycle.forEach((speaker) => {
      speaker
        .then((spk) => spk.close())
        .catch((error) => {
          console.log('Problem closing speaker', error)
        })
    })
    this.recycle = []
  }
}

export class FloatingVideo extends Component {
  constructor(args) {
    super(args)
    this.lastdrpx = 0
    this.lastdrpy = 0
    this.state = { videoposx: 0, videoposy: 0 }
  }

  reportDrawPos(x, y) {
    // y should be already corrected by scrollheight!

    if (x > 0.4 && x < 0.6) return // do nothing we are far away from the corner
    if (y > 0.3 && y < 0.4) return // the same as for x

    // figure out if we are near

    if (y < 0.3 && this.state.videoposy === 0) {
      if (x < 0.3 && this.state.videoposx === 1)
        this.setState({ videoposx: 0, videoposy: 1 })
      else if (x > 0.7 && this.state.videoposx === 0)
        this.setState({ videoposx: 0, videoposy: 1 })
    }

    if (y > 0.4 && this.state.videoposy === 1) {
      // videoposy 0 is the default
      this.setState({ videoposx: 0, videoposy: 0 })
    }
  }

  render() {
    const style = {}
    if (this.state.videoposx) style.left = '0vw'
    else style.right = '0vw'

    if (this.state.videoposy) style.bottom = '0vh'
    else style.top = '0vh'

    style.zIndex = 199
    style.position = 'absolute'
    style.overflow = 'hidden'
    return (
      <div className='p-shadow-5 m-0 buttonbarparent' style={style}>
        {this.props.children}
      </div>
    )
  }
}

class DbMeter extends Component {
  constructor(args) {
    super(args)
    this.state = {}
    this.dbUpdate = this.dbUpdate.bind(this)
  }

  componentDidMount() {
    if (this.props.microphone) this.props.microphone.registerDB(this.dbUpdate)
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.props.microphone !== prevProps.microphone) {
      if (prevProps.microphone) prevProps.microphone.unregisterDB(this.dbUpdate)
      if (this.props.microphone) this.props.microphone.registerDB(this.dbUpdate)
    }
  }

  componentWillUnmount() {
    if (this.props.microphone) this.props.microphone.unregisterDB(this.dbUpdate)
  }

  dbUpdate(db) {
    if (this.state.db !== db) this.setState({ db })
  }

  render() {
    let height = Math.max(Math.min(((this.state.db - -70) / 40) * 100, 100), 0)
    height = height + '%'
    return (
      <div
        style={{
          width: '4px',
          height: '100%',
          background: 'black',
          display: 'inline-block',
          position: 'relative'
        }}
      >
        <div
          style={{
            width: '100%',
            height,
            background: 'green',
            position: 'absolute',
            left: 0,
            bottom: 0
          }}
        ></div>
      </div>
    )
  }
}

export class VideoControl extends Component {
  constructor(args) {
    super(args)
    this.state = {
      camera: undefined,
      microphone: undefined,
      spkmuted: false,
      micmuted: true,
      cameramuted: true,
      camBackgroundRemOff: true,
      camBackgroundRemColor: '#caf0f8',
      camBackgroundRemType: 'blur', // can be 'blur' or color
      tvoff: true,
      screencastMute: true,
      supportedMedia: {
        videoin: false,
        videoout: false,
        audioin: false,
        audioout: false,
        screencastout: false,
        screencastin: false
      }
    }

    const bgPropsStr = localStorage.getItem('failsbackgroundremoveprops')
    if (bgPropsStr) {
      try {
        const {
          off = true,
          color = '#caf0f8',
          type = 'blur'
        } = JSON.parse(bgPropsStr)

        this.state.camBackgroundRemOff = off
        this.state.camBackgroundRemColor = color
        this.state.camBackgroundRemType = type
      } catch (error) {
        console.log(
          'localStorage failsbackgroundremoveprops broken:',
          bgPropsStr
        )
      }
    }

    this.devicesChanged = this.devicesChanged.bind(this)
    this.transportStateUpdate = this.transportStateUpdate.bind(this)
    this.vophid = true
    this.aophid = true
    this.aopohid = true
    this.scophid = true
  }

  transportStateUpdate(state) {
    this.setState({ transportstate: state })
  }

  syncSpkMuted() {
    if (this.props.speakerset) {
      const spkmuted = this.props.speakerset.muted()
      if (spkmuted !== this.state.spkmuted) this.setState({ spkmuted })
    }
  }

  syncMicMuted() {
    if (this.state.microphone) {
      const micmuted = this.state.microphone.muted()
      if (micmuted !== this.state.micmuted) this.setState({ micmuted })
    }
  }

  backgroundRemSync() {
    if (this.state.camera) {
      const off = this.state.camBackgroundRemOff
      const color = this.state.camBackgroundRemColor
      const type = this.state.camBackgroundRemType
      this.state.camera.changeBackgroundRemover({ off, color, type }) // TODO maybe convert color
      localStorage.setItem(
        'failsbackgroundremoveprops',
        JSON.stringify({ off, color, type })
      )
    }
    // do nothing otherwise
  }

  speakerToggle() {
    if (this.props.speakerset) {
      const spkmuted = this.state.spkmuted
      if (spkmuted) this.props.speakerset.muteOff()
      else this.props.speakerset.muteOn()
      const avinterf =
        this.avinterf || (this.avinterf = AVInterface.getInterface())
      avinterf
        .getAVDevices()
        .then((avdevices) => this.setState({ avdevices }))
        .catch((error) => {
          console.log('Avdevices error:', error)
        })

      this.setState({
        spkmuted: !spkmuted,
        audiooutid: avinterf.getSpeakerDeviceId()
      })
    }
  }

  micToggle() {
    if (this.state.microphone) {
      const micmuted = this.state.micmuted
      if (micmuted) this.state.microphone.muteOff()
      else this.state.microphone.muteOn()
      this.setState({ micmuted: !micmuted })
    } else if (this.state.micmuted) {
      if (!this.props.receiveOnly) {
        this.microphoneStart()
          .then((mic) => {
            mic.muteOff()
            this.setState({ micmuted: false })
          })
          .catch((error) => console.log('Problem with microphone start', error))
      } else {
        // no settings in receive only mode
        this.setState({ micmuted: false })
      }
    }
  }

  camToggle() {
    if (this.state.camera) {
      const cammuted = this.state.cameramuted
      if (cammuted) this.state.camera.videoOn()
      else this.state.camera.videoOff()
      this.setState({ cameramuted: !cammuted })
    } else if (this.state.cameramuted) {
      if (!this.props.receiveOnly) {
        this.cameraStart()
          .then((camera) => {
            camera.videoOn()
            this.setState({ cameramuted: false })
          })
          .catch((error) => console.log('Problem with camera start', error))
      } else {
        // no settings in receive only mode
        this.setState({ cameramuted: false })
      }
    }
  }

  tvToggle() {
    const tvoff = this.state.tvoff
    this.setState({ tvoff: !tvoff })
  }

  componentDidMount() {
    navigator.mediaDevices.ondevicechange = this.devicesChanged
    this.syncSpkMuted()
    if (this.props.avstate) {
      if (
        this.props.avstate?.playback?.audio !== undefined &&
        !this.props.avstate?.playback?.audio !== this.state.spkmuted
      ) {
        this.speakerToggle()
      }
      if (
        this.props.avstate?.playback?.video !== undefined &&
        !this.props.avstate?.playback?.video !== this.state.tvoff
      ) {
        this.tvToggle()
      }
      if (
        this.props.avstate?.recording?.video !== undefined &&
        !this.props.avstate?.recording?.video !== this.state.cameramuted
      ) {
        this.camToggle()
      }
      if (
        this.props.avstate?.recording?.audio !== undefined &&
        !this.props.avstate?.recording?.audio !== this.state.micmuted
      ) {
        this.micToggle()
      }
    }
    this.setState({ supportedMedia: AVInterface.queryMediaSupported() })
    AVInterface.getInterface().addTransportStateListener(
      this.transportStateUpdate
    )
  }

  componentWillUnmount() {
    delete navigator.mediaDevices.ondevicechange
    if (this.state.camera) {
      this.state.camera.close()
      this.setState({ camera: undefined })
    }
    if (this.state.microphone) {
      this.state.microphone.close()
      this.setState({ microphone: undefined })
    }
    AVInterface.getInterface().removeTransportStateListener(
      this.transportStateUpdate
    )
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (prevProps.id !== this.props.id && this.state.camera) {
      if (this.props.id) this.state.camera.setDestId(this.props.id)
    }
    if (prevProps.id !== this.props.id && this.state.microphone) {
      if (this.props.id) this.state.microphone.setDestId(this.props.id)
    }
    this.syncSpkMuted()
    if (
      this.props.avstate?.playback?.audio !==
        prevProps.avstate?.playback?.audio ||
      this.props.avstate?.playback?.video !==
        prevProps.avstate?.playback?.video ||
      this.props.avstate?.recording?.audio !==
        prevProps.avstate?.recording?.audio ||
      this.props.avstate?.recording?.video !==
        prevProps.avstate?.recording?.video
    ) {
      console.log('AV state change')
      if (
        this.props.avstate?.playback?.audio !== undefined &&
        !this.props.avstate?.playback?.audio !== this.state.spkmuted
      ) {
        console.log(
          'AV state change speaker toggle',
          !this.props.avstate?.playback?.audio,
          this.state.spkmuted
        )
        this.speakerToggle()
      }
      if (
        this.props.avstate?.playback?.video !== undefined &&
        !this.props.avstate?.playback?.video !== this.state.tvoff
      ) {
        console.log(
          'AV state change tv toggle',
          !this.props.avstate?.playback?.video,
          this.state.tvoff
        )
        this.tvToggle()
      }
      if (
        this.props.avstate?.recording?.video !== undefined &&
        !this.props.avstate?.recording?.video !== this.state.cameramuted
      ) {
        console.log('AV state change cam toggle')
        this.camToggle()
      }
      if (
        this.props.avstate?.recording?.audio !== undefined &&
        !this.props.avstate?.recording?.audio !== this.state.micmuted
      ) {
        console.log('AV state change mic toggle')
        this.micToggle()
      }
    }
    if (
      prevState.micmuted !== this.state.micmuted ||
      prevState.cameramuted !== this.state.cameramuted ||
      prevState.tvoff !== this.state.tvoff ||
      prevState.spkmuted !== this.state.spkmuted
    ) {
      if (this.props.avStateHook) {
        this.avstate = {
          playback: { audio: !this.state.spkmuted, video: !this.state.tvoff },
          recording: {
            audio: !this.state.micmuted,
            video: !this.state.cameramuted
          }
        }
        if (this.props.avStateHook) this.props.avStateHook(this.avstate)
      }
    }
    if (
      prevState.camBackgroundRemColor !== this.state.camBackgroundRemColor ||
      prevState.camBackgroundRemOff !== this.state.camBackgroundRemOff ||
      prevState.camBackgroundRemType !== this.state.camBackgroundRemType
    )
      this.backgroundRemSync()
  }

  async devicesChanged(event) {
    const avinterf =
      this.avinterf || (this.avinterf = AVInterface.getInterface())
    console.log('devicechanged')
    try {
      const devices = await avinterf.getAVDevices()
      this.setState({ avdevices: devices })
      // video
      const vidind = devices.findIndex(
        (el) => this.state.videoid === el.deviceId
      )
      if (vidind === -1) {
        const viddev = devices.filter((el) => el.kind === 'videoinput')
        if (viddev.length > 0) {
          this.setVideoSrc(viddev[0].deviceId, true)
        }
      }
      // screenshare
      const scind = devices.findIndex(
        (el) => this.state.screencastid === el.deviceId
      )
      if (scind === -1) {
        this.setState({ screencastid: undefined })
      }
      // audio
      const audind = devices.findIndex(
        (el) => this.state.audioid === el.deviceId
      )
      if (audind === -1) {
        const auddev = devices.filter((el) => el.kind === 'audioinput')
        if (auddev.length > 0) {
          this.setAudioSrc(auddev[0].deviceId, true)
        }
      }
      const audindout = devices.findIndex(
        (el) => this.state.audiooutid === el.deviceId
      )
      if (audindout === -1) {
        const auddev = devices.filter((el) => el.kind === 'audiooutput')
        if (auddev.length > 0) {
          this.setAudioOut(auddev[0].deviceId, true)
        }
      }
    } catch (error) {
      console.log('devices change error', error)
    }
  }

  async cameraStart() {
    let cam
    try {
      const avinterf =
        this.avinterf || (this.avinterf = AVInterface.getInterface())
      console.log('before openVideoCamera')
      const supported = AVInterface.queryMediaSupported()
      if (!supported.videoin) {
        return null
      }
      const cameraobj = avinterf.openVideoCamera()

      cam = cameraobj
      cam = await cam
      cam.buildOutgoingPipeline()

      if (this.props.id) cam.setDestId(this.props.id)

      // if (this.props.videoid) cam.setSrcId(this.props.videoid)
      this.setState({ camera: cam, videoid: cam.getDeviceId() })
      this.setState({ avdevices: await avinterf.getAVDevices() })
      this.backgroundRemSync()
    } catch (error) {
      console.log('cameraStart failed', error)
    }
    return cam
  }

  startScreencast({ desktopElement, videoDevice }) {
    try {
      const avinterf =
        this.avinterf || (this.avinterf = AVInterface.getInterface())
      const supported = AVInterface.queryMediaSupported()
      if (!supported.screencastin) {
        return null
      }
      if (!this.state.screencast) {
        avinterf
          .openScreenCast({ desktopElement, videoDevice })
          .then((screencastobj) => {
            screencastobj.buildOutgoingPipeline()
            screencastobj.videoOn()
            if (this.props.id) screencastobj.setDestId(this.props.id)
            this.setState({ screencast: screencastobj, screencastMute: false })
          })
          .catch((error) => {
            console.log('Problem opening screencast', error)
          })
      } else {
        this.state.screencast.switchScreencast({ desktopElement, videoDevice })
        this.state.screencast.videoOn()
        this.setState({ screencastMute: false })
      }
    } catch (error) {
      console.log('startScreencast failed', error)
    }
  }

  stopScreencast() {
    try {
      if (this.state.screencast) {
        this.state.screencast.videoOff()
        this.setState({ screencastMute: true })
      }
    } catch (error) {
      console.log('stopScreencast failed', error)
    }
  }

  async microphoneStart() {
    let mic
    try {
      const avinterf =
        this.avinterf || (this.avinterf = AVInterface.getInterface())
      console.log('before openAudioMicrophone')
      const supported = AVInterface.queryMediaSupported()
      if (!supported.audioin) {
        return null
      }
      const microphoneobj = avinterf.openAudioMicrophone()

      mic = microphoneobj
      mic = await mic
      mic.buildOutgoingPipeline()

      if (this.props.id) mic.setDestId(this.props.id)

      // if (this.props.videoid) mic.setSrcId(this.props.videoid)
      this.setState({ microphone: mic, audioid: mic.getDeviceId() })
      this.setState({ avdevices: await avinterf.getAVDevices() })
    } catch (error) {
      console.log('microphoneStart failed', error)
    }
    return mic
  }

  setVideoSrc(id, nosave) {
    console.log('setVideoSrc', id)
    if (this.videoop) this.videoop.hide()
    try {
      if (this.state.camera) this.state.camera.switchCamera(id, nosave)
    } catch (error) {
      console.log('switchCamera failed', error)
    }
    this.setState({ videoid: id })
  }

  setAudioSrc(id, nosave) {
    console.log('setAudioSrc', id)
    if (this.audioop) this.audioop.hide()
    try {
      if (this.state.microphone)
        this.state.microphone.switchMicrophone(id, nosave)
    } catch (error) {
      console.log('switchMicrophone failed', error)
    }
    this.setState({ audioid: id })
  }

  setAudioOut(id, nosave) {
    console.log('setAudioOut', id)
    if (this.audiooutop) this.audiooutop.hide()
    try {
      const avinterf =
        this.avinterf || (this.avinterf = AVInterface.getInterface())
      avinterf.switchSpeaker(id, nosave)
    } catch (error) {
      console.log('setAudioOut failed', error)
    }
    this.setState({ audiooutid: id })
  }

  render() {
    const devices = this.state.avdevices || []
    const videosrc = devices
      .filter((el) => el.kind === 'videoinput')
      .map((el) => ({ label: el.label, deviceId: el.deviceId }))
    console.log('videosrc', videosrc)
    console.log('videoid', this.state.videoid)
    const audiosrc = devices
      .filter((el) => el.kind === 'audioinput')
      .map((el) => ({ label: el.label, deviceId: el.deviceId }))
    console.log('audiosrc', audiosrc)
    console.log('audioid', this.state.audioid)
    const audioout = devices
      .filter((el) => el.kind === 'audiooutput')
      .map((el) => ({ label: el.label, deviceId: el.deviceId }))
    console.log('audioout', audioout, devices)
    console.log('audiooutid', this.state.audiooutid)

    const backgroundRemove = this.state.camBackgroundRemOff
      ? 'off'
      : this.state.camBackgroundRemType
    const backRemOptions = [
      { label: 'Off', value: 'off' },
      { label: 'Blur', value: 'blur' },
      { label: 'Color', value: 'color' }
    ]

    const backgroundRemoveTemplate = (option) => {
      if (option.value === 'color')
        return (
          <ColorPicker
            className='p-m-r-2 bgColorPicker'
            value={Color(this.state.camBackgroundRemColor).object()}
            format='rgb'
            onChange={(e) =>
              this.setState({
                camBackgroundRemColor: Color(e.value).string()
              })
            }
          />
        )
      return <span className='p-button-label p-c'>{option.label} </span>
    }

    const removeBackgroundActivated = false // deactivate as long as upstrean MediaPipe is broken

    let coninfo
    if (this.state.transportstate || this.props.numUsers) {
      const ts = this.state.transportstate
      coninfo = (
        <React.Fragment>
          {this.props.numUsers > 1 && (
            <React.Fragment>
              <i className='coninfoicon pi pi-user'></i> {this.props.numUsers}{' '}
            </React.Fragment>
          )}
          {ts?.status === 'connecting' && (
            <i className='coninfoicon pi pi-spin pi-cog'></i>
          )}
          {ts?.status === 'authenticating' && (
            <i className='coninfoicon pi pi-key'></i>
          )}
          {ts?.status === 'failed' && (
            <i className='coninfoicon pi pi-exclamation-triangle'></i>
          )}
          {ts?.status === 'connected' && (
            <i className='coninfoicon pi pi-check'></i>
          )}
          {ts?.type === 'reliable-only' && (
            <React.Fragment> RO </React.Fragment>
          )}
          {ts?.type === 'supports-unreliable' && (
            <React.Fragment> SU </React.Fragment>
          )}
          {ts && ts.type === undefined && <React.Fragment> NO </React.Fragment>}
        </React.Fragment>
      )
    }

    const selbuttonCls = 'p-button-primary p-button-rounded p-m-2'
    const deselbuttonCls = 'p-button-secondary p-button-rounded p-m-2'
    const suppMedia = this.state.supportedMedia
    const buttonbar = (
      <React.Fragment>
        {suppMedia.videoin && !this.props.receiveOnly && (
          <Button
            icon={
              <FontAwesomeIcon
                icon={this.state.cameramuted ? faVideoSlash : faVideo}
              />
            }
            id='bt-video'
            className={this.state.cameramuted ? deselbuttonCls : selbuttonCls}
            onClick={(e) => {
              if (this.vophid) {
                this.videoop.show(e)
                if (this.videoopclean) clearTimeout(this.videoopclean)
                this.videoopclean = setTimeout(() => {
                  clearTimeout(this.videoopclean)
                  if (!this.vophid) this.videoop.hide(e)
                }, 5000)
              }
              if (!this.vophid || this.state.cameramuted) this.camToggle()
            }}
          ></Button>
        )}
        {suppMedia.videoout && (
          <Button
            icon={<FontAwesomeIcon icon={faTv} />}
            id='bt-tv'
            className={this.state.tvoff ? deselbuttonCls : selbuttonCls}
            onClick={(e) => {
              this.tvToggle()
            }}
          ></Button>
        )}
        {suppMedia.audioin && !this.props.receiveOnly && (
          <Button
            icon={
              <FontAwesomeIcon
                icon={
                  this.state.micmuted ? faMicrophoneAltSlash : faMicrophoneAlt
                }
              />
            }
            id='bt-audio'
            className={this.state.micmuted ? deselbuttonCls : selbuttonCls}
            onClick={(e) => {
              if (this.aophid) {
                this.audioop.show(e)
                if (this.audioopclean) clearTimeout(this.audioopclean)
                this.audioopclean = setTimeout(() => {
                  clearTimeout(this.audioopclean)
                  if (!this.aophid) this.audioop.hide(e)
                }, 5000)
              }
              if (!this.aophid || this.state.micmuted) this.micToggle()
            }}
          ></Button>
        )}
        {suppMedia.audioout && !this.props.sendOnly && (
          <Button
            icon={
              <FontAwesomeIcon
                icon={this.state.spkmuted ? faVolumeXmark : faVolumeHigh}
              />
            }
            id='bt-audioout'
            className={this.state.spkmuted ? deselbuttonCls : selbuttonCls}
            onClick={(e) => {
              if (this.aopohid && AVInterface.canSwitchSpeaker()) {
                this.audiooutop.show(e)
                if (this.audiooutopclean) clearTimeout(this.audiooutopclean)
                this.audiooutopclean = setTimeout(() => {
                  clearTimeout(this.audiooutopclean)
                  if (!this.aopohid) this.audiooutop.hide(e)
                }, 5000)
              }
              if (
                !this.aopohid ||
                this.state.spkmuted ||
                !AVInterface.canSwitchSpeaker()
              )
                this.speakerToggle()
            }}
          ></Button>
        )}
        {suppMedia.screencastin &&
          !this.props.noScreencast &&
          !this.props.receiveOnly && (
            <Button
              icon={fiScreenCast}
              id='bt-screencast'
              className={
                !this.state.screencast || this.state.screencastMute
                  ? deselbuttonCls
                  : selbuttonCls
              }
              onClick={(e) => {
                if (this.scophid) {
                  this.screencastop.show(e)
                  if (this.screencastopclean)
                    clearTimeout(this.screencastopclean)
                  this.screencastopclean = setTimeout(() => {
                    clearTimeout(this.screencastopclean)
                    if (!this.scophid) this.screencastop.hide(e)
                  }, 10000)
                  const avinterf =
                    this.avinterf ||
                    (this.avinterf = AVInterface.getInterface())
                  avinterf
                    .getAVDevices()
                    .then((avdevices) => this.setState({ avdevices }))
                    .catch((error) =>
                      console.log('Problem getavdevices', error)
                    )
                }
                // TODO if (!this.scophid || this.state.cameramuted?) this.camToggle()
              }}
            ></Button>
          )}
      </React.Fragment>
    )
    return (
      <React.Fragment>
        <div className='p-d-flex'>
          {!this.props.receiveOnly && (
            <div className='p-mr-0'>
              <DbMeter microphone={this.state.microphone} />
            </div>
          )}
          <div className='p-mr-0'>
            {(!this.state.tvoff && (
              <AVVideoRender
                videoid={this.props.videoid}
                width={16}
              ></AVVideoRender>
            )) ||
              ((suppMedia.videoout ||
                suppMedia.videoin ||
                suppMedia.audioin ||
                suppMedia.audioout) &&
                !this.props.nobuttonbar && (
                  <div className='p-d-flex p-ai-center'>
                    <div className='p-mr-2'>{buttonbar} </div>
                    <div className='p-mr-2'>
                      {coninfo && (
                        <div className='coninfoinline'> {coninfo} </div>
                      )}
                    </div>
                  </div>
                )) ||
              (!this.props.nobuttonbar && (
                <React.Fragment> Unsupported Browser! </React.Fragment>
              ))}
          </div>
        </div>
        {!this.state.tvoff &&
          (suppMedia.videoout ||
            suppMedia.videoin ||
            suppMedia.audioin ||
            suppMedia.audioout) &&
          !this.props.nobuttonbar && (
            <React.Fragment>
              <div className='buttonbar'>{buttonbar}</div>
              <div className='coninfo'>{coninfo}</div>
            </React.Fragment>
          )}
        <OverlayPanel
          ref={(el) => (this.videoop = el)}
          onShow={() => (this.vophid = false)}
          onHide={() => {
            if (this.videoopclean) clearTimeout(this.videoopclean)
            this.vophid = true
          }}
        >
          Select videosource: <br />
          <Dropdown
            optionLabel='label'
            optionValue='deviceId'
            value={this.state.videoid}
            options={videosrc}
            onChange={(e) => this.setVideoSrc(e.value)}
            placeholder='Select a video source'
            style={{ maxWidth: '10vw' }}
          />{' '}
          <br />
          {removeBackgroundActivated && (
            <React.Fragment>
              Remove background:
              <SelectButton
                value={backgroundRemove}
                itemTemplate={backgroundRemoveTemplate}
                onChange={(e) => {
                  if (e.value === 'off')
                    this.setState({ camBackgroundRemOff: true })
                  else if (e.value === 'color')
                    this.setState({
                      camBackgroundRemOff: false,
                      camBackgroundRemType: 'color'
                    })
                  else if (e.value === 'blur')
                    this.setState({
                      camBackgroundRemOff: false,
                      camBackgroundRemType: 'blur'
                    })
                }}
                options={backRemOptions}
              />
            </React.Fragment>
          )}
        </OverlayPanel>
        <OverlayPanel
          ref={(el) => (this.audioop = el)}
          onShow={() => (this.aophid = false)}
          onHide={() => {
            this.aophid = true
            if (this.audioopclean) clearTimeout(this.audioopclean)
          }}
        >
          Select audiosource: <br />
          <Dropdown
            optionLabel='label'
            optionValue='deviceId'
            value={this.state.audioid}
            options={audiosrc}
            onChange={(e) => this.setAudioSrc(e.value)}
            placeholder='Select an audio source'
            style={{ maxWidth: '10vw' }}
          />
        </OverlayPanel>
        <OverlayPanel
          ref={(el) => (this.audiooutop = el)}
          onShow={() => (this.aopohid = false)}
          onHide={() => {
            this.aopohid = true
            if (this.audiooutopclean) clearTimeout(this.audiooutopclean)
          }}
        >
          Select audiooutput: <br />
          <Dropdown
            optionLabel='label'
            optionValue='deviceId'
            value={this.state.audiooutid}
            options={audioout}
            onChange={(e) => this.setAudioOut(e.value)}
            placeholder='Select an audio output'
            style={{ maxWidth: '10vw' }}
          />
        </OverlayPanel>
        <OverlayPanel
          ref={(el) => (this.screencastop = el)}
          onShow={() => (this.scophid = false)}
          onHide={() => {
            if (this.screencastopclean) clearTimeout(this.screencastopclean)
            this.scophid = true
          }}
        >
          {this.state.screencastMute && (
            <React.Fragment>
              <div className='p-d-flex p-jc-center p-ai-center'>
                <span style={{ marginRight: '5px' }}>Share your screen:</span>
                <Button
                  className='p-button-primary p-button-rounded p-m-2'
                  key='bt-screen-share'
                  icon={fiScreenCast}
                  label='Select source'
                  onClick={(event) => {
                    this.screencastop.hide()
                    this.startScreencast({ desktopElement: true })
                  }}
                />
              </div>
              <br />
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Dropdown
                  optionLabel='label'
                  optionValue='deviceId'
                  value={this.state.screencastid}
                  options={videosrc}
                  onChange={(e) => this.setState({ screencastid: e.value })}
                  placeholder='Select a video source'
                  style={{ maxWidth: '10vw' }}
                />
                <Button
                  className='p-button-primary p-button-rounded p-m-2'
                  key='bt-camera-share'
                  icon={<FontAwesomeIcon icon={faVideo} />}
                  label='Cast video'
                  onClick={(event) => {
                    this.screencastop.hide()
                    this.startScreencast({
                      videoDevice: this.state.screencastid
                    })
                  }}
                  disabled={!this.state.screencastid}
                />{' '}
              </div>
            </React.Fragment>
          )}
          {!this.state.screencastMute && (
            <Button
              className='p-button-primary p-button-rounded p-m-2'
              key='bt-screen-share'
              icon={fiScreenCast}
              label='Stop casting'
              onClick={(event) => {
                this.screencastop.hide()
                this.stopScreencast()
              }}
            />
          )}
        </OverlayPanel>
      </React.Fragment>
    )
  }
}
