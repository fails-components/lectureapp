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
import { AVVideoRender, AVInterface } from './avinterface'
import { Dropdown } from 'primereact/dropdown'

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
    const avinterf = AVInterface.getInterface()
    // we have to figure out
    // (1) which ids are not speakerStr but in newids
    const newstreams = []
    // (2) which ids are in Map, and not anymore in newids
    for (const id of newids) {
      if (!this.speakerStr.has(id)) newstreams.push(id)
    }
    for (const sid of this.speakerStr.keys()) {
      if (!newids.has(sid)) {
        const totrash = this.speakerStr.get(sid)
        console.log('totrash', totrash, sid)
        totrash.setSrcId(undefined) // clear the old stream
        this.recycle.push(totrash)
        this.speakerStr.delete(sid)
      }
    }
    // now we activate the missing ids
    for (const nid of newstreams) {
      let newspeaker = this.recycle.pop()
      if (!newspeaker) {
        try {
          newspeaker = await avinterf.openAudioOutput()
          newspeaker.buildIncomingPipeline()
        } catch (error) {
          console.log('problem creating speaker, skip', error)
          continue
        }
      }
      newspeaker.setSrcId(nid)
      this.speakerStr.set(nid, newspeaker)
    }
    this.audioids = newids
  }

  getListAudio() {
    return this.audioids
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
      videomuted: true,
      cameramuted: true
    }
    this.devicesChanged = this.devicesChanged.bind(this)
    this.vophid = true
    this.aophid = true
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

  speakerToggle() {
    if (this.props.speakerset) {
      const spkmuted = this.state.spkmuted
      if (spkmuted) this.props.speakerset.muteOff()
      else this.props.speakerset.muteOn()
      this.setState({ spkmuted: !spkmuted })
    }
  }

  micToggle() {
    if (this.state.microphone) {
      const micmuted = this.state.micmuted
      if (micmuted) this.state.microphone.muteOff()
      else this.state.microphone.muteOn()
      this.setState({ micmuted: !micmuted })
    }
  }

  camToggle() {
    if (this.state.camera) {
      const cammuted = this.state.cameramuted
      if (cammuted) this.state.camera.camOff()
      else this.state.camera.camOn()
      this.setState({ cameramuted: !cammuted })
    }
  }

  componentDidMount() {
    this.cameraStart()
    this.microphoneStart()
    navigator.mediaDevices.ondevicechange = this.devicesChanged
    this.syncSpkMuted()
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
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (prevProps.id !== this.props.id && this.state.camera) {
      if (this.props.id) this.state.camera.setDestId(this.props.id)
    }
    if (prevProps.id !== this.props.id && this.state.microphone) {
      if (this.props.id) this.state.microphone.setDestId(this.props.id)
    }
    this.syncSpkMuted()
  }

  async devicesChanged(event) {
    const avinterf = AVInterface.getInterface()
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
    } catch (error) {
      console.log('devices change error', error)
    }
  }

  async cameraStart() {
    try {
      const avinterf = AVInterface.getInterface()
      console.log('before openVideoCamera')
      avinterf.queryMediaSupported()
      const cameraobj = avinterf.openVideoCamera()

      let cam = cameraobj
      cam = await cam
      cam.buildOutgoingPipeline()

      if (this.props.id) cam.setDestId(this.props.id)

      // if (this.props.videoid) cam.setSrcId(this.props.videoid)
      this.setState({ camera: cam, videoid: cam.getDeviceId() })
      this.setState({ avdevices: await avinterf.getAVDevices() })
    } catch (error) {
      console.log('cameraStart failed', error)
    }
  }

  async microphoneStart() {
    try {
      const avinterf = AVInterface.getInterface()
      console.log('before openAudioMicrophone')
      avinterf.queryMediaSupported()
      const microphoneobj = avinterf.openAudioMicrophone()

      let mic = microphoneobj
      mic = await mic
      mic.buildOutgoingPipeline()

      if (this.props.id) mic.setDestId(this.props.id)

      // if (this.props.videoid) mic.setSrcId(this.props.videoid)
      this.setState({ microphone: mic, audioid: mic.getDeviceId() })
      this.setState({ avdevices: await avinterf.getAVDevices() })
    } catch (error) {
      console.log('microphoneStart failed', error)
    }
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

    const selbuttonCls = 'p-button-primary p-button-rounded p-m-2'
    const deselbuttonCls = 'p-button-secondary p-button-rounded p-m-2'
    return (
      <React.Fragment>
        <div className='p-d-flex'>
          <div className='p-mr-0'>
            <DbMeter microphone={this.state.microphone} />
          </div>
          <div className='p-mr-0'>
            <AVVideoRender
              videoid={this.props.videoid}
              width={16}
            ></AVVideoRender>
          </div>
        </div>
        <div className='buttonbar'>
          <Button
            icon='pi pi-video'
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
          <Button
            icon='pi pi-phone'
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
          <Button
            icon='pi pi-volume-off'
            id='bt-audio'
            className={this.state.spkmuted ? deselbuttonCls : selbuttonCls}
            onClick={(e) => this.speakerToggle()}
          ></Button>
        </div>
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
          />
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
          />
        </OverlayPanel>
      </React.Fragment>
    )
  }
}