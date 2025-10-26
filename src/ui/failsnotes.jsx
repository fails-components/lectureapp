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

import { faFilePen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from 'primereact/button'
import { Chart } from 'primereact/chart'
import { Checkbox } from 'primereact/checkbox'
import { confirmDialog } from 'primereact/confirmdialog'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { OverlayPanel } from 'primereact/overlaypanel'
import { Toast } from 'primereact/toast'
import React from 'react'
import { FloatingVideo, AVVideoRender, VideoControl } from '../avwidgets'
import { FailsBasis } from './failsbasis'
import {
  fiScreenCast,
  fiNotes,
  fiReceiveStart,
  fiFailsLogo,
  fiVideoQuestionOn,
  fiVideoQuestionOff
} from './icons/icons'
import failsLogo from './logo/logo2.svg'
import failsLogoExp from './logo/logo2exp.svg'
import { NoteScreenBase } from './notepad/notepad'
import { NoteTools } from './toolbox'
import { VideoChatSender } from './widgets/videochat'

export class FailsNotes extends FailsBasis {
  constructor(props) {
    super(props)
    // this.state = {} move to parent
    this.state.casttoscreens = false // may be move to base class
    this.state.blackbackground = true
    this.state.lectdetail = null

    this.state.pageoffset = 0
    this.state.scrollunlock = false

    this.state.notesmode = false

    this.state.chattext = ''
    this.state.videoquestion = false

    this.state.presActivity = 'draw'

    this.notepaduuid = null
    this.notetools = React.createRef()

    this.toggleScrollUnlock = this.toggleScrollUnlock.bind(this)
    this.sendChatMessage = this.sendChatMessage.bind(this)
    this.onVoteSel = this.onVoteSel.bind(this)
    this.onCastvote = this.onCastvote.bind(this)
    this.informDraw = this.informDraw.bind(this)

    this.drawActivityMonitor = this.drawActivityMonitor.bind(this)
    this.screenShareActivity = this.screenShareActivity.bind(this)
  }

  componentDidMount() {
    console.log('Component mount FailsNotes')
    this.socket.connectNotes()
    this.initializeNotesSocket(this.socket)
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

  initializeNotesSocket(notessocket) {
    this.initializeCommonSocket(notessocket)
    // TODO convert to react
    notessocket.on('lecturedetail', (data) => {
      console.log('got lecture detail', data)
      this.setState({
        lectdetail: { ...data, uuid: this.decodedToken()?.lectureuuid }
      })
    })

    notessocket.on('connect', (data) => {
      // todo imform size
      this.setState({ id: this.socket.id })
      console.log('notessocket connect', data)
    })

    notessocket.on('disconnect', (data) => {
      console.log('notessocket disconnect')
      // clear polling
      this.setState({
        polltask: undefined,
        curpoll: undefined,
        votesel: [],
        pollvotes: {},
        polldata: undefined,
        pollballotid: undefined
      })
      if (this.activeVideoQuestion) {
        this.activeVideoQuestion.closeChat()
        delete this.activeVideoQuestion
      }
    })

    notessocket.on('startPoll', (data) => {
      console.log('startpoll incoming', data)

      this.setState({
        polltask: 1,
        curpoll: data,
        votesel: [],
        pollvotes: {},
        polldata: undefined,
        pollballotid: undefined
      })
    })

    notessocket.on('finishPoll', (data) => {
      console.log('finishpoll incoming', data)

      this.setState({
        polltask: 2,
        pollsel: undefined,
        polldata: data.result
      })
    })
  }

  informDraw() {
    if (!this.state.scrollunlock) {
      const curoffset = this.noteref.calcCurpos()
      this.setState((state) => {
        if (!state.scrollunlock) {
          return {
            scrollunlock: !state.scrollunlock,
            pageoffset: curoffset,
            unlockPresActivity: state.presActivity
          }
        }
      })
    }
  }

  drawActivityMonitor() {
    if (this.state.presActivity !== 'draw') {
      this.setState({ presActivity: 'draw' })
    }
  }

  screenShareActivity(sid) {
    if (!this.state.avinterfaceStarted || !this.state.supportedMedia.videoin)
      return
    // screen should only work, if audio/video screen sharing is activated
    if (this.state.presActivity !== 'screen') {
      this.setState({ presActivity: 'screen', screenshareScreenAVId: sid })
    } else {
      if (this.state.screenshareScreenAVId !== sid)
        this.setState({ screenshareScreenAVId: sid })
    }
  }

  toggleScrollUnlock() {
    const curoffset = this.noteref.calcCurpos()

    this.setState((state) => {
      if (state.scrollunlock) {
        return { scrollunlock: !state.scrollunlock, pageoffset: 0 }
      } else {
        return {
          scrollunlock: !state.scrollunlock,
          pageoffset: curoffset,
          unlockPresActivity: state.presActivity
        }
      }
    })
  }

  startVideoQuestion() {
    // First we should not do this several times
    if (!this.activeVideoQuestion) {
      const retobj = (args) => {
        return (
          <VideoChatSender
            ref={(el2) => (this.activeVideoQuestion = el2)}
            onClose={args.onClose}
            id={this.state.id}
            closeHook={() => {
              if (this.activeVideoQuestion) {
                this.activeVideoQuestion.closeChat()
                delete this.activeVideoQuestion
              }
              if (this.sendCloseVideoQuestionSender)
                this.sendCloseVideoQuestionSender({ id: this.state.id })
            }}
          />
        )
      }

      this.toast.show({
        severity: 'info',
        content: retobj,
        sticky: true,
        closable: false
      })
    }
  }

  sendCloseVideoQuestionSender(data) {
    this.netSendSocket('closevideoquestion') // no data the handler know me
  }

  sendChatMessage() {
    const chattext = this.state.chattext
    const videoquestion = this.state.videoquestion ? true : undefined
    const encoder = new TextEncoder()
    const afunc = async () => {
      console.log(
        'Send chat message',
        chattext,
        this.state.videoquestion,
        videoquestion
      )
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
      console.log('Send chat message 1')
      const keyindex = await this.keystore.getCurKeyId()
      console.log('Send chat message 2')
      const key = await this.keystore.getKey(keyindex)
      console.log('Send chat message 3')
      const encData = await globalThis.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key.e2e,
        encoder.encode(chattext)
      )
      console.log('Send chat message 4')
      this.netSendSocket('chatquestion', {
        text: 'Encrypted',
        encData,
        keyindex,
        iv,
        videoquestion
      })
    }
    afunc().catch((error) => {
      console.log('Problem in sendChatMessage', error)
    })

    this.setState({ chattext: '' })
    this.chatop.hide()
  }

  onVoteSel(e) {
    console.log('onVoteSel', e, this.state.votesel)
    if (this.state.curpoll.multi) {
      if (e.checked) {
        this.setState((state) => {
          const temp = state.votesel
          temp.push(e.value)
          return { votesel: temp }
        })
      } else
        this.setState((state) => {
          const temp = state.votesel
          temp.splice(temp.indexOf(e.value), 1)
          return { votesel: temp }
        })
    } else {
      if (e.checked) this.setState({ votesel: e.value })
    }
  }

  async onCastvote() {
    this.setState({ polltask: 2, votesel: undefined })
    const ret = await this.socket.castVote({
      selection: this.state.votesel,
      pollid: this.state.curpoll.id
    })

    console.log('cast vote incl ballot id', ret)
    this.setState({ pollballotid: ret.ballot })
  }

  onNotesmodeEnterDialog({ persist, tryPersist, persistGranted }) {
    if (this.state.notesmodeEDiaShown) {
      if (persist) this.setState({ notesmode: true })
      return
    }

    if (tryPersist || persistGranted) {
      confirmDialog({
        message:
          "Fails stores student notes in your device's browser and not in the Cloud.\n" +
          (!persistGranted
            ? 'Fails will ask the browser to allow data persistance, please confirm, if the browsers asks.'
            : ''),
        header: 'Ask browser for data persistance',
        icon: 'pi pi-question-circle',
        accept: () => {
          navigator.storage
            .persist()
            .then((persisted) => {
              if (persisted) {
                this.setState({ notesmode: true, notesmodeEDiaShown: true })
              } else {
                this.onNotesmodeEnterDialog({ persist: false })
              }
            })
            .catch((error) => {
              console.log('Error on persistance', error)
            })
        },
        acceptLabel: 'Ok',
        rejectClassName: 'hiddenButton'
      })
    } else {
      if (persist) {
        confirmDialog({
          message:
            "Fails stores student's notes in your device's browser and not in the Cloud.\n The browser confirmed, that data is marked persistent,\n i.e it will not be deleted randomly by the browser.",
          header: 'Storage information',
          icon: 'pi pi-info-circle',
          acceptLabel: 'Ok',
          rejectClassName: 'hiddenButton'
        })
        this.setState({ notesmode: true, notesmodeEDiaShown: true })
      } else {
        confirmDialog({
          message:
            "Fails stores student's notes in your device's browser and not in the Cloud.\n The browser denied data persistence, the browser can delete your notes anytime. \n Try to install Fails as a browser app or bookmark this page and reload!",
          header: 'Storage information',
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: 'Ok',
          rejectClassName: 'hiddenButton'
        })
        this.setState({ notesmode: true, notesmodeEDiaShown: true })
      }
    }
  }

  onNotesmodeToggle() {
    if (this.state.notesmode) {
      this.setState({ notesmode: false })
    } else {
      // First we need to figure out, if we have permissions for persistance
      if (navigator.storage?.persisted) {
        navigator.storage
          .persisted()
          .then((isPersisted) => {
            console.log('ispersisted', isPersisted)
            if (isPersisted) {
              this.onNotesmodeEnterDialog({ persist: true })
            } else {
              if (navigator.permissions)
                navigator.permissions
                  .query({ name: 'persistent-storage' })
                  .then((result) => {
                    console.log('perm query result', result)
                    if (result.state === 'granted')
                      this.onNotesmodeEnterDialog({ persistGranted: true })
                    else if (result.state === 'prompt') {
                      this.onNotesmodeEnterDialog({ tryPersist: true })
                    } else this.onNotesmodeEnterDialog({ persist: false })
                  })
                  .catch((error) => {
                    console.log(
                      'Problem in persistent check or unsupported permissions:',
                      error
                    )
                    this.onNotesmodeEnterDialog({ tryPersist: true })
                  })
              else this.onNotesmodeEnterDialog({ tryPersist: true })
            }
          })
          .catch((error) => {
            console.log('Problem in persitentcheck', error)
          })
      } else {
        this.onNotesmodeEnterDialog({ persist: false })
      }
    }
  }

  getButtons() {
    const ttopts = {
      className: 'teal-tooltip',
      position: 'top',
      showDelay: 1000
    }
    const drawmode =
      (!this.state.scrollunlock && this.state.presActivity === 'draw') ||
      (this.state.scrollunlock && this.state.unlockPresActivity === 'draw')

    const notesmode =
      this.state.notesmode && drawmode && this.state.casttoscreens
    return (
      <div>
        <Button
          icon={this.state.scrollunlock ? 'pi pi-lock-open' : 'pi pi-lock'}
          className='p-button-raised p-button-rounded p-m-2'
          tooltip='Lock/unlock scrolling screencast switching to follow lecturer'
          tooltipOptions={ttopts}
          onClick={this.toggleScrollUnlock}
        />
        {drawmode && (
          <React.Fragment>
            <Button
              icon='pi pi-arrow-up'
              className='p-button-raised p-button-rounded p-m-2'
              tooltip='Scroll up'
              tooltipOptions={ttopts}
              onClick={() =>
                this.setState((state) => ({
                  pageoffset: state.scrollunlock
                    ? Math.max(0, state.pageoffset - 0.5)
                    : state.pageoffset - 0.5
                }))
              }
            />
            <InputText
              value={this.state.pageoffset}
              disabled
              style={{ width: '40px' }}
              className='p-inputtext-sm p-m-2'
            />

            <Button
              icon='pi pi-arrow-down'
              className='p-button-raised p-button-rounded p-m-2'
              tooltip='Scroll down'
              tooltipOptions={ttopts}
              onClick={() =>
                this.setState((state) => ({
                  pageoffset: state.pageoffset + 0.5
                }))
              }
            />
          </React.Fragment>
        )}
        {this.state.scrollunlock &&
          (this.state.unlockPresActivity !== 'draw' ||
            this.state.screenshareScreenAVId) && (
            <Button
              icon={
                this.state.unlockPresActivity !== 'screen'
                  ? fiScreenCast
                  : fiNotes
              }
              className='p-button-raised p-button-rounded p-m-2'
              tooltip='Switch between notes and screenshare'
              tooltipOptions={ttopts}
              key={18}
              onClick={() => {
                this.setState({
                  unlockPresActivity:
                    this.state.unlockPresActivity === 'screen'
                      ? 'draw'
                      : 'screen'
                })
              }}
            />
          )}
        <Button
          icon='pi pi-comment'
          className='p-button-raised p-button-rounded p-m-2'
          onClick={(e) => this.chatop.toggle(e)}
          tooltip='Send comment to lecturer'
          tooltipOptions={ttopts}
          aria-haspopup
          aria-controls='overlay_panel'
        />
        {!(this.state.avinterfaceStarted && !this.state.avinterfaceHidden) &&
          this.state.gotavstuff &&
          this.state.casttoscreens && (
            <Button
              icon={fiReceiveStart}
              tooltip='Startup audio/video receiving'
              key={17}
              tooltipOptions={ttopts}
              onClick={(e) => {
                this.startUpAVinterface()
              }}
              className='p-button-raised p-button-rounded p-m-2'
            />
          )}
        {drawmode && (
          <Button
            icon={<FontAwesomeIcon icon={faFilePen} />}
            className={
              this.state.notesmode
                ? 'p-button-raised p-button-rounded p-m-2'
                : 'p-button-secondary p-button-raised p-button-rounded p-m-2'
            }
            tooltip='Annotate the lecture'
            tooltipOptions={ttopts}
            key={5}
            onClick={() => this.onNotesmodeToggle()}
          />
        )}
        <Button
          icon={fiFailsLogo}
          key={4}
          tooltip='Info about Fails'
          tooltipOptions={ttopts}
          onClick={(e) => {
            if (this.ossinfo) this.ossinfo.toggle(e)
          }}
          className='p-button-raised p-button-rounded p-m-2'
        />
        {notesmode && (
          <NoteTools
            ref={this.notetools}
            getnotepad={() => this.noteref}
            addclass='p-m-2 fadeMenu'
            bbwidth={window.innerWidth}
            devicePixelRatio={window.devicePixelRatio}
            updateSizes={this.updateSizes}
          />
        )}

        <OverlayPanel ref={(el) => (this.chatop = el)}>
          <div className='p-grid p-align-end'>
            <div className='p-col'>
              {this.detectLatex(this.state.chattext) && (
                <React.Fragment>
                  <h4>Preview: </h4>
                  {this.convertToLatex(this.state.chattext)}
                  <br></br>
                </React.Fragment>
              )}
              <h4>Question ($...$ for math):</h4>
              <InputTextarea
                rows={5}
                cols={30}
                value={this.state.chattext}
                onChange={(e) => this.setState({ chattext: e.target.value })}
                autoResize
              />
              {this.state.videoquestion && (
                <div>Request Audio/Video question.</div>
              )}
            </div>
            <div className='p-col'>
              <div className='p-d-flex p-flex-column p-jc-center'>
                {this.state.avinterfaceStarted &&
                  !this.state.avinterfaceHidden && (
                    <div className='p-m-1' key='audiovideo'>
                      <Button
                        icon={
                          this.state.videoquestion
                            ? fiVideoQuestionOn
                            : fiVideoQuestionOff
                        }
                        id='bt-broadcast'
                        className={
                          this.state.videoquestion
                            ? 'p-button-raised p-button-rounded p-m-2'
                            : 'p-button-secondary p-button-raised p-button-rounded p-m-2'
                        }
                        onClick={(event) => {
                          this.setState({
                            videoquestion: !this.state.videoquestion
                          })
                        }}
                      ></Button>
                    </div>
                  )}
                <div className='p-m-1' key='sendmessage'>
                  <Button
                    icon={'pi pi-send'}
                    className={
                      this.state.chattext !== ''
                        ? 'p-button-raised p-button-rounded p-m-2'
                        : 'p-button-raised p-button-rounded p-m-2 hiddenElement'
                    }
                    onClick={this.sendChatMessage}
                  />
                </div>
              </div>
            </div>
          </div>
        </OverlayPanel>
      </div>
    )
  }

  render() {
    // console.log("current states", this.state);
    let pollsels = []

    let polldata = null
    let pollanswers = null

    if (this.state.polltask === 2 && this.state.polldata) {
      const pd = this.state.polldata

      polldata = {
        labels: pd.map((el, ind) => 'A ' + (ind + 1)),
        datasets: [
          {
            data: pd.map((el) => el.data),
            label: 'number of votes',
            type: 'bar',
            backgroundColor: '#CAFEB8',
            borderColor: '#D3D3D3',
            borderDash: [5, 5],
            fill: true
          }
        ]
      }
      pollanswers = pd.map((el, ind) => (
        <div key={ind + 'anw'}>
          {' '}
          <b>{'A ' + (ind + 1) + ': '} </b> {this.maybeUseLatex(el.name)}{' '}
        </div>
      ))
    }

    if (this.state.polltask === 1 && this.state.curpoll) {
      pollsels = this.state.curpoll.children.map((el) => (
        <div className='p-col-12'>
          <Checkbox
            inputId='cb2'
            value={el.id}
            onChange={this.onVoteSel}
            checked={
              this.state.curpoll.multi
                ? this.state.votesel.includes(el.id)
                : this.state.votesel === el.id
            }
          ></Checkbox>
          <label htmlFor='cb2' className='p-checkbox-label p-m-2'>
            {this.maybeUseLatex(el.name)}
          </label>
        </div>
      ))
    }

    const screenmode =
      (!this.state.scrollunlock && this.state.presActivity === 'screen') ||
      (this.state.scrollunlock && this.state.unlockPresActivity === 'screen')

    const drawmode =
      (!this.state.scrollunlock && this.state.presActivity === 'draw') ||
      (this.state.scrollunlock && this.state.unlockPresActivity === 'draw') ||
      !screenmode

    return (
      <div>
        <Toast ref={(el) => (this.toast = el)} position='top-left' />
        {!this.state.tokenexpired && this.loadDataDialog()}
        {this.expiredTokenDialog()}
        <OverlayPanel
          ref={(el) => {
            this.ossinfo = el
          }}
          showCloseIcon
        >
          <div className='p-grid'>
            <div className='p-col-3'>
              <img
                src={this.experimental() ? failsLogoExp : failsLogo}
                alt='FAILS logo'
              />
            </div>
            <div className='p-col-9'>
              <h4>
                <b>FAILS</b> - components <br />
                (Fancy automated internet lecture system)
              </h4>
              Copyright (C) 2015-2017 (original FAILS), <br />
              2021- (FAILS Components) Marten Richter
            </div>
          </div>
          Lectureapp version {import.meta.env.REACT_APP_VERSION} <br /> <br />
          FAILS logo by chadkills <br />
          Custom icons by icon_xpert786 and petedesignworks
          <br /> <br />
          Released under GNU Affero General Public License Version 3. <br />{' '}
          <br />
          Download the source code from{' '}
          <a href='https://github.com/fails-components'>
            https://github.com/fails-components
          </a>{' '}
          <br /> <br />
          Build upon the shoulders of giants, see{' '}
          <a href='/static/oss'> OSS attribution and licensing.</a> <br />
          {this.state.identobj?.masterdigest && (
            <React.Fragment>
              <h4> Masterkey for E2E encryption:</h4>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontVariantNumeric: 'slashed-zero',

                  maxWidth: '20vw',
                  display: 'block'
                }}
              >
                {this.state.identobj?.masterdigest}
              </span>
              <br />
              Compare the Masterkey to verify E2E encryption.
            </React.Fragment>
          )}
        </OverlayPanel>
        {this.state.avinterfaceStarted && !this.state.avinterfaceHidden && (
          <FloatingVideo ref={this.floatvideo}>
            <VideoControl
              videoid={this.state.dispvideo}
              id={this.state.id}
              speakerset={this.speakerset}
              receiveOnly={true}
              avStateHook={(navstate) => {
                const avstate = { ...this.avstate }
                avstate.playback = navstate.playback
                this.setState({ avstate })
              }}
            ></VideoControl>
          </FloatingVideo>
        )}
        <NoteScreenBase
          isnotepad={false}
          notesmode={this.state.notesmode}
          notetools={this.notetools}
          pageoffset={this.state.pageoffset}
          pageoffsetabsolute={this.state.scrollunlock}
          bbchannel={this.bbchannel}
          lectdetail={this.state.lectdetail}
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
          screennumbercolor={
            this.state.blackbackground && this.state.casttoscreens
              ? '#FFFFFF'
              : '#000000'
          }
          width={this.props.width}
          height={this.props.height}
          noteref={this.getNoteRef}
          updateSizes={this.updateSizes}
          hidden={!this.state.casttoscreens || !drawmode}
          informDraw={this.informDraw}
          experimental={this.experimental()}
          features={this.features()}
          drawActivityMonitor={this.drawActivityMonitor}
          reportScroll={(change) => {
            this.setState((state) => ({
              pageoffset: state.scrollunlock
                ? Math.max(0, state.pageoffset + change)
                : state.pageoffset + change
            }))
          }}
        ></NoteScreenBase>
        <div
          style={{
            display: !this.state.casttoscreens || !screenmode ? 'none' : 'grid',
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
                this.state.screenshareScreenAVId
              }{' '}
              .
            </h3>
          )}
          {this.state.supportedMedia.videoin &&
            this.state.avinterfaceStarted && (
              <AVVideoRender
                screenshareid={
                  screenmode ? this.state.screenshareScreenAVId : undefined
                }
                screenshare={true}
                width={100}
              ></AVVideoRender>
            )}
        </div>
        {!this.state.casttoscreens && (
          <div
            className='p-d-flex p-jc-center p-ai-center'
            style={{ height: '100vh', width: '100vw' }}
          >
            <div className='p-mr-2'>
              {this.state.reloading && <h1>Loading...</h1>}
              {!this.state.reloading && (
                <React.Fragment>
                  <h1>The screencast is currently deactivated!</h1>
                  <h2>Ask the docent for activation, when ready!</h2>
                </React.Fragment>
              )}
            </div>
          </div>
        )}
        <div
          style={{ position: 'absolute', top: '2vh', left: '1vw', zIndex: 150 }}
        >
          {this.getButtons()}
        </div>
        <Dialog
          header='Poll'
          visible={typeof this.state.polltask !== 'undefined'}
          closable={this.state.polltask === 2}
          style={{ maxWidth: '80vw', maxHeight: '80vh' }}
          onHide={() => {
            this.setState({
              polltask: undefined,
              pollsel: undefined,
              polldata: undefined
            })
          }}
        >
          {this.state.polltask === 1 && (
            <React.Fragment>
              <h3>
                {' '}
                {this.state.curpoll
                  ? this.maybeUseLatex(
                      this.state.curpoll.name +
                        (this.state.curpoll.multi ? ' (multi)' : ' (single)')
                    )
                  : 'Current poll'}
              </h3>
              {pollsels}
              {this.state.curpoll &&
                (this.state.curpoll.multi
                  ? this.state.votesel.length > 0
                  : this.state.votesel) && (
                  <Button
                    label='Cast vote'
                    icon='pi pi-chart-bar'
                    className='p-m-2'
                    onClick={this.onCastvote}
                  />
                )}
            </React.Fragment>
          )}
          {this.state.polltask === 2 && (
            <React.Fragment>
              <h3>
                {' '}
                {this.state.curpoll
                  ? this.maybeUseLatex(
                      this.state.curpoll.name +
                        (this.state.curpoll.multi ? ' (multi)' : ' (single)')
                    )
                  : 'Current poll'}
              </h3>
              {polldata && (
                <React.Fragment>
                  <Chart
                    type='bar'
                    data={polldata}
                    options={{
                      indexAxis: 'x',
                      responsive: true,
                      maintainAspectRation: false
                    }}
                  />
                  {pollanswers}
                  <h4> Voting is over!</h4>
                </React.Fragment>
              )}
              {!polldata && <h4> Votes are still casted! </h4>}
              {this.state.pollballotid && (
                <h4>My ballot id: {this.state.pollballotid}</h4>
              )}
            </React.Fragment>
          )}
        </Dialog>
      </div>
    )
  }
}
