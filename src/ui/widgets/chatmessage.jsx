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
import { faLock, faRetweet } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from 'primereact/button'
import { confirmPopup } from 'primereact/confirmpopup'
import React from 'react'
import { fiEyeOn, fiEyeOff, fiVideoQuestionPermit } from '../icons/icons'

export class ChatMessage extends React.Component {
  constructor(args) {
    super(args)
    this.state = {
      hideName: true,
      videoQuestionSend: false,
      messageResend: false
    }
  }

  render() {
    let displayname
    const data = this.props.data
    if (data.displayname) {
      if (this.state.hideName && !this.props.noHideName) {
        displayname = data.displayname.replace(/[a-z]/g, '*')
      } else {
        displayname = data.displayname
      }
    }
    const isEncrypted = this.props.isEncrypted
    const ttopts = {
      className: 'teal-tooltip',
      position: 'top'
    }
    let topline = displayname + ':'
    if (this.props.resend) {
      let toadd = 'Shared by ' + displayname
      if (this.props.senderName && this.props.showSendername) {
        toadd += ' from ' + this.props.senderName
      }
      toadd += ':'
      topline = toadd
    }

    const retobj = (
      <React.Fragment>
        <span
          className='p-toast-message-icon pi pi-info-circle'
          key='messicon'
        ></span>
        <div className='p-toast-message-text' key='messkey'>
          {displayname && (
            <div className='buttonheadinggroup'>
              <h3>{topline} </h3>
              {!this.props.noHideName && (
                <Button
                  icon={!this.state.hideName ? fiEyeOn : fiEyeOff}
                  className='p-button-primary p-button-text p-button-rounded p-m-2'
                  onClick={() =>
                    this.setState({ hideName: !this.state.hideName })
                  }
                />
              )}
            </div>
          )}
          {this.props.latex}
          <br></br>
          {this.props.videoQuestion && !this.state.videoQuestionSend && (
            <Button
              icon={fiVideoQuestionPermit}
              key='broadcast'
              className='p-button-success p-button-outlined p-button-rounded p-m-2'
              tooltip='Allow audio/video transmission.'
              tooltipOptions={ttopts}
              onClick={(event) => {
                this.props.allowVideoquestion({
                  id: data?.videoquestion?.id,
                  displayname,
                  userhash: data.userhash
                })
                this.setState({ videoQuestionSend: true })
              }}
            />
          )}
          {!this.props.noBlockUser && (
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
                    data.displayname +
                    ' from sending messages for the remaining session!',
                  icon: 'pi pi-exclamation-triangle',
                  accept: this.props.blockChat()
                })
              }}
            />
          )}
          {!this.props.noForensicReport && (
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
                        data.userhash +
                        ' Displayname: ' +
                        data.displayname +
                        ' Message: "' +
                        data.text +
                        '" You can copy and paste this and send it to your admin as evidence!'}
                    </div>
                  ),
                  acceptLabel: 'Ok',
                  rejectClassName: 'hiddenButton',
                  icon: 'pi pi-exclamation-triangle'
                })
              }}
            />
          )}
          {this.props.sendMessageHandler && !this.state.messageResend && (
            <Button
              icon={<FontAwesomeIcon icon={faRetweet} />}
              key='resend'
              className='p-button-message p-button-outlined p-button-rounded p-m-2'
              tooltip='Resend message to all notes'
              onClick={(event) => {
                this.props.sendMessageHandler({
                  resend: true,
                  sender: displayname,
                  text: this.props.text
                })
                this.setState({ messageResend: true })
              }}
              tooltipOptions={ttopts}
            />
          )}
          {isEncrypted && (
            <Button
              icon={<FontAwesomeIcon icon={faLock} />}
              key='e2e'
              className='p-button-message p-button-outlined p-button-rounded p-m-2'
              tooltip='Message was E2E encrypted!'
              tooltipOptions={ttopts}
            />
          )}
        </div>
      </React.Fragment>
    )
    return retobj
  }
}
