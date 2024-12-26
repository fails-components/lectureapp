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
import { Sidebar } from 'primereact/sidebar'
import { Toast } from 'primereact/toast'
import React from 'react'
import { AVVideoRender, FloatingVideo, VideoControl } from '../avwidgets'
import { FailsBasis } from './failsbasis'
import { fiBroadcastStart } from './icons/icons'
import failsLogoLong from './logo/logo1.svg'
import failsLogoLongExp from './logo/logo1exp.svg'
import { NoteScreenBase } from './notepad/notepad'

export class FailsScreen extends FailsBasis {
  constructor(props) {
    super(props)
    // this.state = {} move to parent
    this.state.casttoscreens = false // may be move to base class
    this.state.showscreennumber = false
    this.state.blackbackground = true
    this.state.lectdetail = null
    this.state.lastpointermove = Date.now()

    this.notepaduuid = null

    // handles fade in and out of the fullscreen button
    setInterval(() => {
      if (Date.now() - this.state.lastpointermove > 5000) {
        this.setState({ lastpointermove: 0 })
      }
    }, 1000)
  }

  componentDidMount() {
    console.log('Component mount FailsScreen')
    this.socket.connectScreen()
    this.initializeScreenSocket(this.socket)

    this.commonMount()
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    this.commonDidUpdate(prevProps, prevState, snapshot)
  }

  componentWillUnmount() {
    console.log('Component unmount FailsScreen')

    this.socket.disconnect()
    this.commonUnmount()
  }

  initializeScreenSocket(screensocket) {
    this.initializeCommonSocket(screensocket)
    // TODO convert to react
    screensocket.on(
      'lecturedetail',
      function (data) {
        console.log('got lecture detail', data)
        this.setState({ lectdetail: data })
      }.bind(this)
    )

    /*
    screensocket.on('removeScreen',function(data) {
        
        this.setState((state)=> {let newld=state.lecturedetail;
          if (newld) newld.notepaduuid=null;
          return {casttoscreens: false,
                      screenmode:"removed",
                      lectdetail: newld
                        };});
        console.log("screen was removed from notepad ");
        
        this.setState({casttoscreens: false  } );
    }.bind(this)); */
    screensocket.on('connect', (data) => {
      this.setState({ id: this.socket.id })
      // todo imform size
      this.updateSizes()
      console.log('screensocket connect', data)
      this.setState((state) => {
        return {
          casttoscreens: false,
          showscreennumber: false,
          screenmode: 'connected'
        }
      })
    })

    screensocket.on(
      'disconnect',
      function (data) {
        this.setState((state) => {
          return {
            casttoscreens: false,
            showscreennumber: false,
            screenmode: 'disconnected',
            reloading: true
          }
        })

        console.log('screensocket disconnect')
      }.bind(this)
    )
  }

  renderScreenText() {
    const failslogo = (
      <div className='p-p-6'>
        <img
          src={this.experimental() ? failsLogoLongExp : failsLogoLong}
          style={{ width: '20vw' }}
          alt='FAILS logo long'
        />
      </div>
    )

    let lectinfo = null
    if (this.state.lectdetail) {
      lectinfo = (
        <div style={{ textAlign: 'center' }}>
          <h1>{this.state.lectdetail.coursetitle}</h1>
          <h4> {this.state.lectdetail.instructors.join(', ')} </h4>
          <h2>{this.state.lectdetail.title}</h2>
          {this.state.lectdetail.todaysinstructor && (
            <div>
              today held by <br></br>{' '}
              {this.state.lectdetail.todaysinstructor.join(', ')}
            </div>
          )}
          <h4> is coming up </h4>
          <br></br>
        </div>
      )
    }
    let screenunassigned = true
    if (this.state.lectdetail && this.state.lectdetail.notepaduuid)
      screenunassigned = false
    switch (this.state.screenmode) {
      case 'connected':
        return (
          <div style={{ textAlign: 'center', zIndex: 100, fontSize: '3vh' }}>
            {' '}
            {lectinfo && lectinfo}
            {screenunassigned && (
              <React.Fragment>
                <h2> Screen connected </h2> Start casting lecture!{' '}
              </React.Fragment>
            )}
            <br />
            {failslogo}
          </div>
        )

      case 'disconnected':
        return (
          <div style={{ textAlign: 'center', zIndex: 100, fontSize: '3vh' }}>
            {' '}
            {lectinfo && lectinfo}
            <h2> Screen disconnected </h2>
            {failslogo}
          </div>
        )

      case 'removed':
        return (
          <div style={{ textAlign: 'center', zIndex: 100, fontSize: '3vh' }}>
            {' '}
            {lectinfo && lectinfo}
            {screenunassigned && (
              <React.Fragment>
                {' '}
                <h2> Screen connected </h2>
                Screen was removed! <br></br>
                Start casting lecture!{' '}
              </React.Fragment>
            )}{' '}
            <br />
            {failslogo}
          </div>
        )

      /* case "lecture": {
        return <div  style={{ textAlign: "center"}} ><h1>{this.state.lectdetail.coursetitle}</h1>
        <h4> {this.state.lectdetail.instructors.join(", ")} </h4>
         <h2>{this.state.lectdetail.title}</h2>
        {this.state.lectdetail.todaysinstructor && <div>
            today held by <br></br> {this.state.lectdetail.todaysinstructor.join(", ")}</div>
              }
               <h4> is coming up </h4>
               <tiny> [{this.decoded_screentoken.screenuuid}]  </tiny>
             </div>
       
      }; */
      default: {
        return <div>Not activated!</div>
      }
    }
  }

  render() {
    const pointermove = () => {
      this.setState({
        lastpointermove: Date.now()
      })
    }
    const buttonstyle = {
      position: 'absolute',
      bottom: '2vh',
      right: '2vw',
      zIndex: 101
    }
    const ttopts = {
      className: 'teal-tooltip',
      position: 'top',
      showDelay: 1000
    }
    return (
      <div onPointerMove={pointermove}>
        <Toast ref={(el) => (this.toast = el)} position='top-left' />
        {this.screenOverlay()}
        {this.expiredTokenDialog()}
        <OverlayPanel
          className='tbChild'
          ref={(el) => {
            this.keyinfo = el
          }}
          style={{ maxWidth: '40vw', maxHeight: '50vh' }}
          showCloseIcon
        >
          {this.state.identobj?.masterdigest && (
            <React.Fragment>
              <h4> Masterkey:</h4>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontVariantNumeric: 'slashed-zero'
                }}
              >
                {this.state.identobj?.masterdigest}
              </span>
              <br></br>
              <br></br>
              Compare the Masterkey to verify E2E encryption.
            </React.Fragment>
          )}
        </OverlayPanel>
        <NoteScreenBase
          isnotepad={false}
          showscreennumber={this.state.showscreennumber}
          screennumber={this.state.notescreenid}
          bbchannel={this.bbchannel}
          backgroundcolor={
            this.state.bgpdf
              ? '#FFFFFF'
              : this.state.blackbackground
              ? '#505050'
              : '#efefef'
          }
          backclass={
            this.state.bgpdf
              ? ''
              : this.state.blackbackground
              ? 'blackboardBlack'
              : 'blackboardWhite'
          }
          hidden={this.state.channeltype !== 'notebooks'}
          screennumbercolor={
            this.state.blackbackground && this.state.casttoscreens
              ? '#FFFFFF'
              : '#000000'
          }
          width={this.props.width}
          height={this.props.height}
          noteref={this.getNoteRef}
          updateSizes={this.updateSizes}
          experimental={this.experimental()}
          features={this.features()}
        ></NoteScreenBase>
        <div
          style={{
            display: this.state.channeltype !== 'screenshare' ? 'none' : 'grid',
            placeItems: 'center',
            backgroundColor: 'black',
            height: '100vh'
          }}
        >
          {(!this.state.supportedMedia.videoin ||
            !this.state.avinterfaceStarted) && (
            <h3>
              Your browser does not support receiving screencasts! <br />
              Here should appear a screencast {
                this.state.screenshareSourceAVId
              }{' '}
              for channel {this.state.screenshareSourceId}.
            </h3>
          )}
          {this.state.supportedMedia.videoin &&
            this.state.avinterfaceStarted && (
              <AVVideoRender
                screenshareid={this.state.screenshareSourceAVId}
                screenshare={true}
                width={100}
              ></AVVideoRender>
            )}
        </div>
        <Sidebar
          visible={!this.state.casttoscreens}
          position='top'
          style={{ width: '100%', height: '98%', zIndex: 100 }}
          showCloseIcon={false}
          onHide={() => {}}
        >
          {this.state.screenmode && this.renderScreenText()}
        </Sidebar>
        {this.state.avinterfaceStarted && !this.state.avinterfaceHidden && (
          <FloatingVideo ref={this.floatvideo}>
            <VideoControl
              videoid={this.state.dispvideo}
              id={this.state.id}
              speakerset={this.speakerset}
              receiveOnly={true}
              avStateHook={(navstate) => {
                const avstate = { ...this.state.avstate }
                avstate.playback = navstate.playback
                this.setState({ avstate })
              }}
            ></VideoControl>
          </FloatingVideo>
        )}
        {this.state.lastpointermove !== 0 && (
          <div style={buttonstyle}>
            {!(
              this.state.avinterfaceStarted && !this.state.avinterfaceHidden
            ) && (
              <Button
                icon={fiBroadcastStart}
                tooltip='Startup audio/video broadcast'
                key={17}
                tooltipOptions={ttopts}
                onClick={(e) => {
                  this.startUpAVinterface()
                }}
                className='p-button-primary p-button-raised p-button-rounded fadeMenu p-m-2'
              />
            )}

            <Button
              icon='pi pi-key'
              tooltip='Encryption key'
              tooltipOptions={ttopts}
              onClick={(e) => {
                if (this.keyinfo) this.keyinfo.toggle(e)
              }}
              className='p-button-primary p-button-raised p-button-rounded fadeMenu p-m-2'
            ></Button>

            <Button
              icon='pi pi-window-maximize'
              key={1}
              tooltip='Toggle fullscreen'
              tooltipOptions={ttopts}
              onClick={this.toggleFullscreen}
              className='p-button-primary p-button-raised p-button-rounded fadeMenu p-m-2'
            />
          </div>
        )}
      </div>
    )
  }
}
