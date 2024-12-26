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
import { faBars } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from 'primereact/button'
import React from 'react'
import {
  fiFailsLogo,
  fiAddScreen,
  fiAddNotepad,
  fiBroadcastStart,
  fiWristBottomRight,
  fiWristMiddleRight,
  fiWristTopRight,
  fiWristTopLeft,
  fiWristMiddleLeft,
  fiWristBottomLeft
} from '../icons/icons'

export class ShortcutsMessage extends React.Component {
  constructor(args) {
    super(args)
    this.state = { avinterfaceStarted: false }
  }

  render() {
    return (
      <React.Fragment>
        <span className='p-toast-message-icon pi pi-info-circle'></span>
        <div className='p-toast-message-text'>
          <h2>
            <div className='p-d-flex'>
              <div className='p-mr-2'>{fiFailsLogo} </div>
              <div className='p-mr-2'>Welcome!</div>
            </div>
          </h2>
          <h3> Common initial tasks</h3>
          <div className='p-grid p-align-center'>
            <div className='p-col-9'>Toggle fullscreen:</div>
            <div className='p-col-3'>
              <Button
                icon='pi pi-window-maximize'
                id='bt-fullscreen'
                className='p-button-primary p-button-outlined p-button-rounded p-m-2'
                onClick={this.props.parent.toggleFullscreen}
              ></Button>
            </div>
          </div>
          <div className='p-grid p-align-center'>
            <div className='p-col-9'>Open screen (for showing):</div>
            <div className='p-col-3'>
              <Button
                icon={fiAddScreen}
                id='bt-screen'
                className='p-button-primary p-button-outlined p-button-rounded p-m-2'
                onClick={this.props.parent.onOpenNewScreen}
              ></Button>
            </div>
          </div>
          <div className='p-grid p-align-center'>
            <div className='p-col-9'>Open notepad (for writing):</div>
            <div className='p-col-3'>
              <Button
                icon={fiAddNotepad}
                id='bt-notepad'
                className='p-button-primary p-button-outlined p-button-rounded p-m-2'
                onClick={this.props.parent.onOpenNewNotepad}
              ></Button>
            </div>
          </div>
          {!(
            (this.props.parent?.state?.avinterfaceStarted &&
              !this.props.parent?.state?.avinterfaceHidden) ||
            this.state.avinterfaceStarted
          ) &&
            this.props.hasMedia && (
              <div className='p-grid p-align-center'>
                <div className='p-col-9'>Start up Audio/Video broadcast:</div>
                <div className='p-col-3'>
                  <Button
                    icon={fiBroadcastStart}
                    id='bt-broadcast'
                    className='p-button-primary p-button-outlined p-button-rounded p-m-2'
                    onClick={(event) => {
                      this.props.parent.startUpAVinterface()
                      this.setState({ avinterfaceStarted: true })
                    }}
                  ></Button>
                </div>
              </div>
            )}
          <div className='p-grid p-align-center'>
            <div className='p-col-12'>Select your wrist position:</div>
            <div className='p-col-2'>
              <Button
                icon={fiWristBottomRight}
                id='bt-notepad'
                className='p-button-primary p-button-outlined p-button-rounded p-m-2'
                onClick={(event) => {
                  this.props.parent.selectWrist(0)
                }}
              ></Button>
            </div>
            <div className='p-col-2'>
              <Button
                icon={fiWristMiddleRight}
                id='bt-notepad'
                className='p-button-primary p-button-outlined p-button-rounded p-m-2'
                onClick={(event) => {
                  this.props.parent.selectWrist(1)
                }}
              ></Button>
            </div>
            <div className='p-col-2'>
              <Button
                icon={fiWristTopRight}
                id='bt-notepad'
                className='p-button-primary p-button-outlined p-button-rounded p-m-2'
                onClick={(event) => {
                  this.props.parent.selectWrist(2)
                }}
              ></Button>
            </div>
            <div className='p-col-2'>
              <Button
                icon={fiWristTopLeft}
                id='bt-notepad'
                className='p-button-primary p-button-outlined p-button-rounded p-m-2'
                onClick={(event) => {
                  this.props.parent.selectWrist(3)
                }}
              ></Button>
            </div>
            <div className='p-col-2'>
              <Button
                icon={fiWristMiddleLeft}
                id='bt-notepad'
                className='p-button-primary p-button-outlined p-button-rounded p-m-2'
                onClick={(event) => {
                  this.props.parent.selectWrist(4)
                }}
              ></Button>
            </div>
            <div className='p-col-2'>
              <Button
                icon={fiWristBottomLeft}
                id='bt-notepad'
                className='p-button-primary p-button-outlined p-button-rounded p-m-2'
                onClick={(event) => {
                  this.props.parent.selectWrist(5)
                }}
              ></Button>
            </div>
          </div>
          see <FontAwesomeIcon icon={faBars} /> for more.
        </div>
      </React.Fragment>
    )
  }
}
