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
import { faTv, faVolumeXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from 'primereact/button'
import { confirmPopup } from 'primereact/confirmpopup'
import React from 'react'
import { VideoControl } from '../../avwidgets'

export class VideoChat extends React.Component {
  constructor(args) {
    super(args)
    this.state = {
      avstate: args.initialAvstate,
      videoid: undefined,
      audioid: undefined
    }
  }

  closeChat() {
    this.props.onClose()
  }

  informAvstate(avstate) {
    this.setState({ avstate })
  }

  turnVideoOn(on) {
    if (on && this.state.videoid !== this.props.id)
      this.setState({
        videoid: this.props.id
      })
  }

  turnAudioOn(on) {
    if (on && this.state.audioids?.length !== 1)
      this.setState({
        audioids: [this.props.id]
      })
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (
      !prevState.audioids ||
      !this.state.audioids ||
      prevState.audioids.some((ele, ind) => ele !== this.state.audioids[ind])
    ) {
      if (this.props.processAV) this.props.processAV()
    }
  }

  getListAudio() {
    return this.state.audioids
  }

  render() {
    const ttopts = {
      className: 'teal-tooltip',
      position: 'top'
    }
    const style = {
      left: '0vw',
      top: '0vh',
      position: 'relative'
    }

    const retobj = (
      <React.Fragment>
        <span className='p-toast-message-icon pi pi-info-circle'></span>
        <div className='p-toast-message-text'>
          <div className='buttonheadinggroup' key='buttonheading'>
            <h3>{'A/V from ' + this.props.displayName} </h3>
          </div>
          <div className='m-0 buttonbarparent' style={style}>
            <VideoControl
              id={this.props.id}
              videoid={this.state.videoid}
              receiveOnly={true}
              nobuttonbar={true}
              speakerset={this.props.speakerset}
              avstate={this.state?.avstate}
            ></VideoControl>
          </div>

          <div className='p-grid p-align-center'>
            <div className='p-col-7'>
              {this.props.closeHook && (
                <Button
                  icon='pi pi-times'
                  key='closevideoquestion'
                  className='p-button-danger p-button-outlined p-button-rounded p-m-2'
                  tooltip='Close Videoquestion for all users'
                  tooltipOptions={ttopts}
                  onClick={this.props.closeHook}
                />
              )}
              <Button
                icon='pi pi-ban'
                key='blockchat'
                className='p-button-danger p-button-outlined p-button-rounded p-m-2'
                tooltip='Block user from future messages'
                tooltipOptions={ttopts}
                onClick={(event) => {
                  confirmPopup({
                    target: event.currentTarget,
                    message:
                      'Do you want to block ' +
                      this.props.displayName +
                      ' from sending messages for the remaining session!',
                    icon: 'pi pi-exclamation-triangle',
                    accept: this.props.blockChat()
                  })
                }}
              />
              <Button
                icon='pi pi-info-circle'
                className='p-button-danger p-button-outlined p-button-rounded p-m-2'
                tooltip='Forensic report about user'
                key='forensic'
                tooltipOptions={ttopts}
                onClick={(event) => {
                  confirmPopup({
                    target: event.currentTarget,
                    message: (
                      <div style={{ width: '30vw' }}>
                        {'Forensic report: userhash: ' +
                          this.props.userhash +
                          ' Displayname: ' +
                          this.props.displayName +
                          '" You can copy and paste this and send it to your admin as evidence!'}
                      </div>
                    ),
                    acceptLabel: 'Ok',
                    rejectClassName: 'hiddenButton',
                    icon: 'pi pi-exclamation-triangle'
                  })
                }}
              />
            </div>
            <div className='p-col'>
              {!this.state?.avstate?.playback?.video && (
                <React.Fragment>
                  {' '}
                  <FontAwesomeIcon icon={faTv} /> off.
                </React.Fragment>
              )}
              {!this.state?.avstate?.playback?.audio && (
                <React.Fragment>
                  {' '}
                  <FontAwesomeIcon icon={faVolumeXmark} /> off.
                </React.Fragment>
              )}
            </div>
          </div>
        </div>
      </React.Fragment>
    )
    return retobj
  }
}
export class VideoChatSender extends React.Component {
  constructor(args) {
    super(args)
    this.state = {}
  }

  closeChat() {
    this.props.onClose()
  }

  render() {
    const ttopts = {
      className: 'teal-tooltip',
      position: 'top'
    }
    const style = {
      left: '0vw',
      top: '0vh',
      position: 'relative'
    }
    // props.id is for sending stuff
    const retobj = (
      <React.Fragment>
        <span className='p-toast-message-icon pi pi-info-circle'></span>
        <div className='p-toast-message-text'>
          <div className='buttonheadinggroup' key='buttonheading'>
            <h3> A/V Question</h3>
          </div>
          <br></br>
          <div className='m-0 buttonbarparent' style={style}>
            <VideoControl
              id={this.props.id}
              videoid={this.props.id}
              sendOnly={true}
              noScreencast={true}
            ></VideoControl>
          </div>
          <div className='p-grid p-align-center'>
            <div className='p-col-7'>
              {this.props.closeHook && (
                <Button
                  icon='pi pi-times'
                  key='closevideoquestion'
                  className='p-button-danger p-button-outlined p-button-rounded p-m-2'
                  tooltip='Close Videoquestion'
                  tooltipOptions={ttopts}
                  onClick={this.props.closeHook}
                />
              )}
            </div>
          </div>
        </div>
      </React.Fragment>
    )
    return retobj
  }
}
