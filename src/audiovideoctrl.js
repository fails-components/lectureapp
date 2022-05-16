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
import { Component } from 'react'
import { AVVideoRender, AVInterface } from './avinterface'
import { Dropdown } from 'primereact/dropdown'

export class VideoControl extends Component {
  constructor(args) {
    super(args)
    this.state = { camera: undefined }
    this.devicesChanged = this.devicesChanged.bind(this)
  }

  componentDidMount() {
    this.cameraStart()
    window.addEventListener('devicechange', this.devicesChanged)
  }

  componentWillUnmount() {
    window.removeEventListener('devicechange', this.devicesChanged)
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (prevProps.videoid !== this.props.videoid && this.state.camera) {
      this.state.camera.setSrcId(this.props.videoid)
    }
    if (prevProps.id !== this.props.id && this.state.camera) {
      this.state.camera.setDestId(this.props.id)
    }
  }

  async devicesChanged() {
    const avinterf = AVInterface.getInterface()
    try {
      const devices = await avinterf.getAVDevices()
      const ind = devices.findIndex((el) => this.state.videoid === el.deviceId)
      if (ind === -1) {
        const viddev = devices.filter((el) => el.kind === 'videoinput')
        if (viddev.length > 0) {
          this.setVideoSrc(viddev[0].deviceId, true)
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

      cam.setDestId(this.props.id)

      cam.buildIncomingPipeline() // move to somewhere else
      if (this.props.videoid) cam.setSrcId(this.props.videoid)
      this.setState({ camera: cam, videoid: cam.getDeviceId() })
      this.setState({ avdevices: await avinterf.getAVDevices() })
    } catch (error) {
      console.log('cameraStart failed', error)
    }
  }

  setVideoSrc(id, nosave) {
    console.log('setVideoSrc', id)
    if (this.op) this.op.hide()
    try {
      this.state.camera.switchCamera(id, nosave)
    } catch (error) {
      console.log('switchCamera failed', error)
    }
    this.setState({ videoid: id })
  }

  render() {
    const devices = this.state.avdevices || []
    const videosrc = devices
      .filter((el) => el.kind === 'videoinput')
      .map((el) => ({ label: el.label, deviceId: el.deviceId }))
    console.log('videosrc', videosrc)
    console.log('videoid', this.state.videoid)
    return (
      <div
        className='p-shadow-5 m-0 buttonbarparent'
        style={{
          position: 'absolute',
          top: '0vh',
          right: '0vw',
          zIndex: 210
        }}
      >
        {this.state.camera && (
          <AVVideoRender camera={this.state.camera} width={16}></AVVideoRender>
        )}
        <div className='buttonbar'>
          <Button
            icon='pi pi-video'
            id='bt-notepad'
            className='p-button-primary p-button-rounded p-m-2'
            onClick={(e) => this.op.toggle(e)}
          ></Button>
        </div>
        <OverlayPanel ref={(el) => (this.op = el)}>
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
      </div>
    )
  }
}
