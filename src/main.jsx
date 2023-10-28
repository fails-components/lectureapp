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

import React, { Component } from 'react'
import { Dialog } from 'primereact/dialog'
import { Checkbox } from 'primereact/checkbox'
import { Button } from 'primereact/button'
import { Galleria } from 'primereact/galleria'
import { Menu } from 'primereact/menu'
import { Sidebar } from 'primereact/sidebar'
import { InputText } from 'primereact/inputtext'
import { OverlayPanel } from 'primereact/overlaypanel'
import { InputTextarea } from 'primereact/inputtextarea'
import { Toast } from 'primereact/toast'
import { confirmPopup } from 'primereact/confirmpopup'
import { confirmDialog } from 'primereact/confirmdialog'
import { Steps } from 'primereact/steps'
import { ListBox } from 'primereact/listbox'
import { ProgressBar } from 'primereact/progressbar'
import { Chart } from 'primereact/chart'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import './primereactpatch.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faDesktop,
  faBars,
  faFilePen,
  faLock,
  faTv,
  faVolumeXmark
} from '@fortawesome/free-solid-svg-icons'
import failsLogo from './logo/logo2.svg'
import failsLogoLong from './logo/logo1.svg'
import failsLogoExp from './logo/logo2exp.svg'
import failsLogoLongExp from './logo/logo1exp.svg'
import {
  fiAddNotepad,
  fiAddScreen,
  fiEyeOn,
  fiEyeOff,
  fiFailsLogo,
  fiMoveToTop,
  fiScreenNumberOff,
  fiScreenNumberOn,
  fiWristBottomLeft,
  fiWristBottomRight,
  fiWristMiddleLeft,
  fiWristMiddleRight,
  fiWristTopLeft,
  fiWristTopRight,
  fiBroadcastStart,
  fiReceiveStart,
  fiVideoQuestionPermit,
  fiVideoQuestionOn,
  fiVideoQuestionOff
} from './icons/icons.jsx'
import { NoteScreenBase } from './notepad.jsx'
import { NoteTools } from './toolbox'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { v4 as uuidv4 } from 'uuid'
import { UAParser } from 'ua-parser-js'
import { ScreenManager } from './screenmanager'
import { VideoControl, FloatingVideo, SpeakerSet } from './audiovideoctrl'
import { SocketInterface } from './socketinterface'
import { AVInterface } from './avinterface'
import { KeyStore } from './keystore'

class ChannelEdit extends Component {
  constructor(props) {
    super(props)
    this.availscreensmenu = React.createRef()
  }

  render() {
    // ok this is easy, we get two properties availscreens for selection, and channelinfo for the channels

    const availscreensitems = [
      {
        label: 'Move/add to top',
        items: this.props.availscreens.map((el, ind) => {
          let purpose = 'Unknown'
          if (el.purpose === 'notepad') purpose = 'Notepad'
          else if (el.purpose === 'screen') purpose = 'Screen'
          console.log('channel uuid', el.channel, el.uuid)
          return {
            label: ind + 1 + '. ' + purpose,
            command: () =>
              this.props.app.addNotescreenToChannel(this.selchannel, el.uuid)
          }
        })
      }
    ]

    /* <Button label="Open new screen" onClick={this.onOpenNewScreen} />
        
        {(this.state.availscreens.length>0) &&
        <div className="p-col-4">
        
        <Button label="Add screen" onClick={(event) => this.availscreensmenu.current.toggle(event)} aria-controls="availscreen_menu" aria-haspopup />
        </div>}
        {((!this.state.noscreen) && this.state.selscreen) && <div className="p-col-4">
        <Button label="Remove screen" onClick={this.onRemoveScreen} />
        </div>} */

    if (!this.props.channelinfo)
      return <React.Fragment>Waiting for data...</React.Fragment>
    const channels = this.props.channelinfo.map((el, ind) => {
      let type = 'Unknown'
      if (el.type === 'notebooks') type = 'Room'
      const notescreens = el.notescreens.map((el2) => {
        const index = this.props.availscreens.findIndex(
          (el3) => el3.uuid === el2.uuid
        )
        let purpose = 'Unknown'
        if (el2.purpose === 'notepad') purpose = 'Notepad'
        else if (el2.purpose === 'screen') purpose = 'Screen'

        return (
          <div className='p-m-2 p-shadow-1 p-p-2' key={el2.uuid}>
            {' '}
            {index + 1 + '. ' + purpose}{' '}
          </div>
        )
      })
      console.log('notescreen', el)
      console.log('avail screens', this.props.availscreens)
      notescreens.reverse()

      return (
        <div className='p-mr-2 p-shadow-1'>
          <div className='p-d-flex p-flex-column p-jc-center'>
            <div className='p-m-2 p-p-1' key='haeding'>
              <h3>
                {ind + 1 + '. ' + type}
                {ind !== 0 && el.notescreens.length === 0 && (
                  <Button
                    icon='pi pi-trash'
                    className='p-button-rounded p-button-text p-button-sm'
                    onClick={() =>
                      this.props.app.onRemoveChannel(el.channeluuid)
                    }
                  ></Button>
                )}
              </h3>
            </div>
            <div className='p-m-2 p-p-2' key='header'>
              <div className='p-d-flex'>
                <div className='p-mr-2'>
                  <Button
                    icon={fiMoveToTop}
                    label={'Move to top'}
                    className='p-button-rounded p-button-text p-button-sm'
                    onClick={(event) => {
                      this.selchannel = el.channeluuid
                      this.availscreensmenu.current.hide(event)
                      this.availscreensmenu.current.show(event)
                    }}
                    aria-controls='availscreen_menu'
                    aria-haspopup
                  ></Button>
                </div>
              </div>
            </div>
            {notescreens}
          </div>
        </div>
      )
    })

    channels.push(
      <div className='p-mr-2 p-shadow-1' key='newwriting'>
        <div
          className='p-d-flex p-flex-column p-jc-center p-ai-center'
          style={{ height: '100%' }}
        >
          <div className='p-mr-2'>
            <Button
              icon='pi pi-plus'
              className='p-button-rounded p-button-text p-button-sm'
              iconPos='right'
              onClick={(event) => {
                this.props.app.onNewWriting()
              }}
            ></Button>
          </div>
        </div>
      </div>
    )

    return (
      <div className='p-d-flex p-flex-column'>
        <div className='p-mb-2' key='channels'>
          <div className='p-d-flex'>
            <Menu
              model={availscreensitems}
              popup
              baseZIndex={3000}
              ref={this.availscreensmenu}
              id='availscreen_menu'
            />
            {channels}
          </div>
        </div>
        <div className='p-mb-2' key='buttons'>
          <div className='p-d-flex'>
            <div className='p-mr-2' key='newnotepad'>
              <Button
                label='Notepad'
                icon={fiAddNotepad}
                className='p-button-rounded p-button-text p-button-sm'
                onClick={() => {
                  this.props.app.onOpenNewNotepad()
                }}
              ></Button>
            </div>
            <div className='p-mr-2' key='newscreen'>
              <Button
                label='Screen'
                icon={fiAddScreen}
                className='p-button-rounded p-button-text p-button-sm'
                onClick={() => {
                  this.props.app.onOpenNewScreen()
                }}
              ></Button>
            </div>
            <div className='p-mr-2 p-ml-auto' key='showscreen'>
              <Button
                label='Numbers'
                icon={
                  this.props.app.state.showscreennumber
                    ? fiScreenNumberOn
                    : fiScreenNumberOff
                }
                className='p-button-rounded p-button-text p-button-sm'
                onClick={() => {
                  this.props.app.updateSizes({
                    showscreennumber: !this.props.app.state.showscreennumber
                  })
                }}
              ></Button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export class FailsBasis extends Component {
  constructor(props) {
    super(props)

    this.noteref = null
    this.getNoteRef = this.getNoteRef.bind(this)
    this.updateSizes = this.updateSizes.bind(this)

    this.toggleFullscreen = this.toggleFullscreen.bind(this)
    this.servererrorhandler = this.servererrorhandler.bind(this)
    this.setReloading = this.setReloading.bind(this)
    this.setExpiredToken = this.setExpiredToken.bind(this)
    this.setIdentities = this.setIdentities.bind(this)
    this.processAVoffers = this.processAVoffers.bind(this)

    this.state = {}
    this.state.screensToSel = []
    this.state.reloading = true
    this.state.identobj = { idents: [], masterdigest: 'no masterdigest' }
    this.state.avinterfaceStarted = false
    this.state.supportedMedia = {}
    this.state.gotavstuff = false

    this.screenm = new ScreenManager()

    this.floatvideo = React.createRef()
    this.speakerset = new SpeakerSet()

    this.socket = SocketInterface.getInterface()
    this.socket.setServerErrorHandler(this.servererrorhandler)
    this.socket.setReloadingHandler(this.setReloading)
    this.socket.setExpiredTokenHandler(this.setExpiredToken)
    this.socket.setInformIdentsHandler(this.setIdentities)

    const bbchannel = new MessageChannel()
    this.socket.setBoardChannel(bbchannel.port1)
    this.bbchannel = bbchannel.port2

    const avchannel = new MessageChannel()
    this.socket.setAVChannel(avchannel.port1)
    this.avchannel = avchannel.port2

    this.avoffers = {
      video: {},
      audio: {},
      screen: {}
    }
    this.videoquestions = {
      authorized: {},
      closed: {},
      panels: {}
    }

    this.avstate = {
      playback: { audio: false, video: false },
      recording: {
        audio: false,
        video: false
      }
    }

    this.keystore = KeyStore.getKeyStore()

    // TODO add purpose stuff
  }

  startUpAVinterface() {
    if (!AVInterface.getInterface()) {
      AVInterface.createAVInterface()
      this.avinterf = AVInterface.getInterface() // please hold a reference for the gargabe collector
      AVInterface.setNetworkControl(this.avchannel)
      this.setState({ avinterfaceStarted: true })
    }
  }

  setReloading(reloading) {
    this.setState({ reloading })
  }

  setExpiredToken(tokenexpired) {
    this.setState({ tokenexpired })
  }

  setIdentities(identobj) {
    this.setState({ identobj })
  }

  decodedToken() {
    return this.socket.decodedToken()
  }

  expiredTokenDialog() {
    return (
      <Dialog
        footer=''
        style={{ width: '30vw' }}
        closeOnEscape={false}
        closable={false}
        showHeader={false}
        modal
        header='Session token time out'
        visible={this.state.tokenexpired}
      >
        <div className='p-grid p-align-center'>
          <div className='p-col-3'>
            <img
              src={this.experimental() ? failsLogoExp : failsLogo}
              alt='FAILS logo'
            />
          </div>
          <div className='p-col-9'>
            <p>
              {' '}
              Your authentication token expired! <br /> <br /> You have to close
              the window or tab and reopen FAILS from your LMS!
            </p>
          </div>
        </div>
      </Dialog>
    )
  }

  netSendSocket(command, data) {
    if (this.socket) this.socket.simpleEmit(command, data)
  }

  initializeCommonSocket(commonsocket) {
    commonsocket.on('avoffer', (data) => {
      if (data.id && data.type && data.type in this.avoffers) {
        this.avoffers[data.type][data.id] = { time: Date.now(), db: data.db }
      }
      if (this.processAVoffers) this.processAVoffers()
      if (!this.state.gotavstuff) this.setState({ gotavstuff: true })
    })

    commonsocket.on('avofferList', (data) => {
      const now = Date.now()
      if (data.offers) {
        const newoffers = {
          video: {},
          audio: {},
          screen: {}
        }
        data.offers.forEach((el) => {
          if (el.time && Number(el.time) > now - 60 * 1000) {
            if (el.id && el.type && el.type in newoffers)
              newoffers[el.type][el.id] = { time: Number(el.time), db: el.db }
          }
        })
        this.avoffers = newoffers
        if (this.processAVoffers) this.processAVoffers()
        if (!this.state.gotavstuff && data?.offers?.length > 0)
          this.setState({ gotavstuff: true })
      }
    })

    commonsocket.on('vqoffer', (data) => {
      if (data.id && data.type && this.videoquestions.panels[data.id]) {
        if (data.type === 'video')
          this.videoquestions.panels[data.id].turnVideoOn(true)
        else if (data.type === 'audio')
          this.videoquestions.panels[data.id].turnAudioOn(true)
      }
    })

    commonsocket.on('videoquestion', (data) => {
      if (data.id && data.displayname && data.userhash) {
        if (data.id !== this.state.id) {
          this.videoquestions.authorized[data.id] = {
            displayname: data.displayname,
            userhash: data.userhash
          }
          delete this.videoquestions.closed[data.id]
          this.updateVideoquestions()
        } else {
          // that's me..., I may ask
          if (this.startVideoQuestion) this.startVideoQuestion()
        }
      }
    })

    commonsocket.on('closevideoquestion', (data) => {
      if (data.id) {
        if (data.id !== this.state.id) {
          this.videoquestions.closed[data.id] = {
            closed: true
          }
          delete this.videoquestions.authorized[data.id]
        } else {
          if (this.activeVideoQuestion) {
            this.activeVideoQuestion.closeChat()
            delete this.activeVideoQuestion
          }
        }
      }
      this.updateVideoquestions()
    })

    commonsocket.on('videoquestionList', (data) => {
      if (data.vquestions) {
        const newauthorized = {}
        data.vquestions.forEach((el) => {
          if (el.displayname && el.userhash) {
            if (el.id && el.id !== this.state.id) {
              newauthorized[el.id] = {
                displayname: el.displayname,
                userhash: el.userhash
              }
              delete this.videoquestions.closed[el.id]
            }
          }
        })
        this.videoquestions.authorized = newauthorized
        this.updateVideoquestions()
      }
    })
    // commonsocket.removeAllListeners('availscreens')
    commonsocket.on('availscreens', (data) => {
      // we can also figure out a notescreen id
      // console.log('availscreens', data)
      if (data.screens) {
        const notescreenuuid = this.decodedToken().notescreenuuid

        const nsid = data.screens.findIndex((el) => el.uuid === notescreenuuid)

        this.setState({ availscreens: data.screens, notescreenid: nsid })
        console.log('notescreenid', nsid)
      }
    })

    commonsocket.on('presinfo', (data) => {
      console.log('data presinfo', data)
      const setstate = {}
      // #error TODO assure that notepads are always within positive range and make sure that changes are immediately
      setstate.casttoscreens = data.casttoscreens === 'true'
      setstate.blackbackground = data.backgroundbw === 'true'
      setstate.showscreennumber = data.showscreennumber === 'true'
      this.setState(setstate)
    })

    commonsocket.on('channelinfo', (data) => {
      // console.log('data channelinfo', data)
      const setstate = {}
      const notescreenuuid = this.decodedToken().notescreenuuid
      // #error TODO assure that notepads are always within positive range and make sure that changes are immediately
      setstate.casttoscreens = data.casttoscreens === 'true'
      if (data.backgroundbw)
        setstate.blackbackground = data.backgroundbw === 'true'
      setstate.showscreennumber = data.showscreennumber === 'true'
      if (data.channelinfo) {
        setstate.channelinfo = data.channelinfo
        const channel = data.channelinfo.find(
          (el) =>
            el.notescreens.findIndex((el2) => el2.uuid === notescreenuuid) !==
            -1
        )
        let scrolloffset = 0
        if (channel) {
          let notepos = 0
          let curpos = 0
          for (let i = 0; i < channel.notescreens.length; i++) {
            const cur = channel.notescreens[i]
            curpos += parseFloat(cur.scrollheight)
            if (cur.purpose === 'notepad') notepos = curpos
          }
          if (notepos === 0) notepos = curpos // if there is no notepad, then treat the lonely screen(s), all as a notepad
          for (let i = 0; i < channel.notescreens.length; i++) {
            const cur = channel.notescreens[i]
            // console.log('scrolloffsets', cur.scrollheight, cur.uuid)

            if (cur.scrollheight) scrolloffset -= parseFloat(cur.scrollheight)
            if (cur.uuid === notescreenuuid) break
          }
          scrolloffset += notepos
          // console.log('Final screen scrolloffset', scrolloffset, this.noteref)
          if (this.noteref) this.noteref.setScrollOffset(scrolloffset)
        }
      }
      // console.log('monitor setstate', setstate, data)
      this.setState(setstate)

      /*
      var scrolloffset = 0.;
      console.log("data notepad",data.notepadisscreen,data );
      if (data.notepadisscreen=="true") { //if notepad is a screen all additional screen start in negative area
        // if it is not a screen we have to correct the offset
        scrolloffset =  -parseFloat(data.notepadscrollheight);
      }
      //now we have to add all screenheight up to the current one
      var arr = data.screenheights;
      console.log("data notepad arr",arr);
      if (arr) {
        var length = arr.length;
        var i = 0;
        for (i = 0; i < length; i++) {
          if (!arr[i]) continue;
          var cur = arr[i];
          console.log("calccheck",cur.scrollheight,parseFloat(cur.scrollheight),cur,scrolloffset);
          
          if (cur.uuid == this.decodedToken().screenuuid) {
            break;
          }
          //console.log("screenif",this.decodedToken().screenuuid,cur.uuid );
          scrolloffset -= parseFloat(cur.scrollheight);
        }
        console.log("Final screen scrolloffset",scrolloffset,this.noteref);
        if (this.noteref) this.noteref.setScrollOffset(scrolloffset);
      }
      this.setState({casttoscreens: data.casttoscreens=="true", 
              blackbackground: data.backgroundbw=="true"  } */
    })

    commonsocket.on('bgpdfinfo', (data) => {
      console.log('bgpdfinfo commonsocket', data)
      if (data.bgpdfurl) {
        this.updateSizes({ blackbackground: false })
        this.setState({ bgpdf: true })
      }
      if (data.none) this.setState({ bgpdf: false })
      if (this.noteref) {
        this.noteref.receiveBgpdfInfo({
          url: data.bgpdfurl,
          none: !!data.none
        })
      }
    })
  }

  updateVideoquestions() {
    // ok we have an update, we only process it, if we are doing video stuff
    // TODO add test for video stuff
    if (
      this.state.avinterfaceStarted /* &&
      (this.state.avstate?.playback?.audio ||
        this.state.avstate?.playback?.video) */
    ) {
      Object.keys(this.videoquestions.authorized).forEach((id) => {
        if (!this.videoquestions.panels[id]) {
          // we do not have a panel, so plese add it
          const el = this.videoquestions.authorized[id]
          const retobj = (args) => {
            return (
              <VideoChat
                id={id}
                ref={(el2) => (this.videoquestions.panels[id] = el2)}
                blockChat={() => this.blockChat(el.userhash)}
                displayName={el.displayname}
                userhash={el.userhash}
                onClose={args.onClose}
                initialAvstate={this.state.avstate}
                speakerset={this.speakerset}
                processAV={this.processAVoffers}
                closeHook={
                  !this.sendCloseVideoQuestion
                    ? undefined
                    : () => {
                        this.sendCloseVideoQuestion({ id })
                      }
                }
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
      })
    }

    Object.keys(this.videoquestions.closed).forEach((id) => {
      // const el = this.videoquestions.authorized[id]
      if (this.videoquestions.panels[id]) {
        // we do not have a panel, so plese add it
        this.videoquestions.panels[id].closeChat()
        delete this.videoquestions.panels[id]
      }
    })
  }

  processAVoffers() {
    // avoffers have updated, now we may change everything

    const audio = this.avoffers.audio
    const video = this.avoffers.video
    const selaudio = new Set()

    let selaid
    let seldb = -70

    const la = this.speakerset.getListAudio() || new Set()

    for (const aid in audio) {
      const el = audio[aid]
      if (el.time > Date.now() - 10 * 1000 && aid !== this.state.id) {
        if (el.db > -70 || (el.db > -75 && la.has(this.aid))) selaudio.add(aid)
      }
      if (el.db > seldb && aid in video && el.time > Date.now() - 10 * 1000) {
        seldb = el.db
        selaid = aid
      }
    }
    // now we ask the video question folks
    Object.keys(this.videoquestions.authorized).forEach((id) => {
      if (this.videoquestions.panels[id]) {
        const vqla = this.videoquestions.panels[id].getListAudio()
        if (vqla) vqla.forEach((el) => selaudio.add(el))
      }
    })
    //
    const dp = this.state.dispvideo
    if (
      dp &&
      audio[dp] &&
      seldb - audio[dp].db < 10 &&
      audio[dp].time > Date.now() - 15 * 1000 // discard audio after 15 seconds, otherwise even if the other client is long gone we are stuck
    )
      selaid = dp

    if (!selaid) {
      // no audio
      let newvideo = false
      if (dp) {
        if (
          !this.avoffers.video[dp] ||
          this.avoffers.video[dp].time < Date.now() - 30 * 1000 ||
          dp === this.state.id
        ) {
          // we need a new one this
          newvideo = true
        }
      } else newvideo = true
      if (newvideo) {
        // select the most recent
        let curtime = 0
        let curid = null
        const video = this.avoffers.video
        for (const id in video) {
          if (
            video[id].time > Date.now() - 30 * 1000 &&
            (video[id].time > curtime ||
              (curid === this.state.id && video[id].time > curtime - 5 * 1000))
          ) {
            curtime = video[id].time
            curid = id
          }
        }
        if (curid) {
          selaid = curid
        }
      }
    }
    if (selaid && selaid !== dp) {
      console.log('change video to', selaid)
      this.setState({ dispvideo: selaid })
    }
    // now figure out if the audio has changed
    if (selaudio.size !== la.size || [...selaudio].some((i) => !la.has(i))) {
      // console.log('set Audio IDS', la, selaudio)
      this.speakerset.setAudioIds(selaudio).catch((error) => {
        console.log('problem speakerset', error)
      })
    }
  }

  servererrorhandler(code, message, type) {
    console.log('server error', code, message, type)
    this.toast.show({
      severity: 'error',
      summary: 'Error Message',
      detail: message,
      life: 20000
    })
  }

  experimental() {
    const exp = window.location.pathname.includes('experimental')
    const token = this.decodedToken()
    // console.log('token', token)

    if (exp && token && token.appversion === 'stable') {
      console.log(
        'token app version and path does not match',
        window.location.pathname,
        token.appversion
      )
    }
    return exp
  }

  loadDataDialog() {
    return (
      <Dialog
        header='(Re-)loading data'
        footer=''
        visible={this.state.reloading}
        style={{ width: '30vw' }}
        closeOnEscape={false}
        closable={false}
        showHeader={false}
        modal
      >
        <div className='p-grid p-align-center'>
          <div className='p-col-3'>
            <img
              src={this.experimental() ? failsLogoExp : failsLogo}
              alt='FAILS logo'
            />
          </div>
          <div className='p-col-9'>
            <div className='p-d-flex p-flex-column'>
              <div className='p-mb-2 p-p-2'>
                Board data is currently loaded or server is disconnected.
                <br />
                Please be patient. <br />
              </div>
              <div className='p-mb-2  p-p-2'>
                <ProgressBar style={{ height: '6px' }} mode='indeterminate' />
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    )
  }

  async toggleFullscreen(event) {
    const ret = await this.screenm.toggleFullscreen()
    console.log('ret screenmanager', ret, this.opScreens)
    if (ret.status === 'selector' && this.opScreens) {
      console.log('screenmanager setstate')
      this.setState({ screensToSel: ret.screens })
      this.opScreens.toggle(event)
    }
  }

  screenOverlay() {
    const screenbuttons = this.state.screensToSel.map((el) => (
      <Button
        className={
          el.isCurrent
            ? 'p-button-primary  p-button-rounded p-m-2'
            : 'p-button-secondary p-button-rounded p-m-2'
        }
        key={el.number}
        icon={<FontAwesomeIcon icon={faDesktop} className='p-m-1' />}
        label={
          ' ' + (el.number + 1) + (el.isCurrent ? ' (current)' : ' (other)')
        }
        onClick={(event) => {
          this.opScreens.hide()
          el.toggle()
        }}
      />
    ))

    return (
      <OverlayPanel
        ref={(el) => {
          this.opScreens = el
        }}
      >
        <h3> Fullscreen on </h3>
        {screenbuttons}
      </OverlayPanel>
    )
  }

  commonMount() {
    // check for features
    if (document.featurePolicy) {
      console.log(
        'allowed website features',
        document.featurePolicy.allowedFeatures()
      )
      console.log(
        'allowed origins for feature camera',
        document.featurePolicy.getAllowlistForFeature('camera')
      )
    }
    if (new UAParser().getEngine().name !== 'Blink') {
      confirmDialog({
        message:
          'Please use a Blink based browser such as Chrome, Chromium, Edge, etc..!',
        header: 'Unsupported browser warning',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Ok',
        rejectClassName: 'hiddenButton'
      })
    }
    // we support it for a period of time only on the experimental branch
    const expmedia = this.experimental()
    const supportedMedia = AVInterface.queryMediaSupported()
    this.setState({ supportedMedia })
    this.hasMedia =
      (supportedMedia.videoin ||
        supportedMedia.videoout ||
        supportedMedia.audioin ||
        supportedMedia.audioout) &&
      expmedia
    this.hasMediaSend =
      (supportedMedia.videoout || supportedMedia.audioout) && expmedia
  }

  commonDidUpdate(prevProps, prevState, snapshot) {
    if (this.state.avstate !== prevState.avstate) {
      // we have to inform all video messages
      if (
        (this.state?.avstate?.playback?.audio ||
          this.state?.avstate?.playback?.video) !==
        (prevState?.avstate?.playback?.audio ||
          prevState?.avstate?.playback?.video)
      ) {
        this.updateVideoquestions()
      }
      Object.values(this.videoquestions.panels).forEach((panel) => {
        if (panel) panel.informAvstate(this.state.avstate)
        else console.log('WEIRD panel', this.videoquestions.panels, panel)
      })
    }
  }

  commonUnmount() {
    if (this.reauthorizeTimeout) {
      clearTimeout(this.reauthorizeTimeout)
      this.reauthorizeTime = null
    }
    this.speakerset.close()
  }

  getNoteRef(ref) {
    // console.log('getNoteRef')
    this.noteref = ref
    /*  this.noteref.setHasControl(true);
    this.noteref.reactivateToolBox(); */
  }

  updateSizes(args) {
    if (this.noteref) {
      // console.log('checko us', this.noteref.blackboard.current)
      const data = {
        scrollheight: this.noteref.blackboard.current.scrollheight(),
        // isscreen: this.isscreen,
        /*   backgroundbw: this.state.blackbackground, */
        showscreennumber: this.state.showscreennumber
      }
      // console.log('update sizes', data, args)
      if (args && args.scrollheight) data.scrollheight = args.scrollheight
      if (args && typeof args.blackbackground !== 'undefined')
        data.backgroundbw = args.blackbackground
      if (args && typeof args.showscreennumber !== 'undefined')
        data.showscreennumber = args.showscreennumber
      // console.log('update sizes2', data, args)
      if (!this.isscreen) {
        // data.isalsoscreen=this.state.notepadisscreen;
        if (this.state.casttoscreens)
          data.casttoscreens = this.state.casttoscreens
        // data.showscreennumber=this.state.showscreennumber;
        // if (args && typeof args.notepadisscreen!== 'undefined') data.isalsoscreen=args.notepadisscreen;
        if (args && typeof args.casttoscreens !== 'undefined')
          data.casttoscreens = args.casttoscreens
        // if (args && typeof args.showscreennumber!== 'undefined') data.showscreennumber=args.showscreennumber;
      }

      if (this.netSendSocket) this.netSendSocket('updatesizes', data)
    }
    this.setState(args)
  }

  detectLatex(string) {
    return string.indexOf('$') !== -1
  }

  convertToLatex(string) {
    const retarray = []
    let secstart = 0
    let seclatex = false
    for (let curpos = 0; curpos < string.length; curpos++) {
      const curchar = string.charAt(curpos)
      if (curchar === '$') {
        if (seclatex) {
          const html = katex.renderToString(
            string.substring(secstart, curpos),
            {
              throwOnError: false,
              displayMode: false
            }
          )
          retarray.push(
            <span dangerouslySetInnerHTML={{ __html: html }}></span>
          )
          secstart = curpos + 1
          seclatex = false
        } else {
          retarray.push(
            <React.Fragment>
              {string.substring(secstart, curpos - 1)}{' '}
            </React.Fragment>
          )
          secstart = curpos + 1
          seclatex = true
        }
      }
    }

    retarray.push(
      <React.Fragment>
        {string.substring(secstart, string.length)}{' '}
      </React.Fragment>
    )

    return retarray
  }
}

class ShortcutsMessage extends React.Component {
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
                onClick={(event) => {
                  this.props.parent.onOpenNewScreen()
                }}
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
                onClick={(event) => {
                  this.props.parent.onOpenNewNotepad()
                }}
              ></Button>
            </div>
          </div>
          {!(
            this.props.parent?.state?.avinterfaceStarted ||
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

class VideoChat extends React.Component {
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

class VideoChatSender extends React.Component {
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

class ChatMessage extends React.Component {
  constructor(args) {
    super(args)
    this.state = { hideName: true, videoQuestionSend: false }
  }

  render() {
    let displayname
    const data = this.props.data
    if (data.displayname) {
      if (this.state.hideName) {
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

    const retobj = (
      <React.Fragment>
        <span
          className='p-toast-message-icon pi pi-info-circle'
          key='messicon'
        ></span>
        <div className='p-toast-message-text' key='messkey'>
          {displayname && (
            <div className='buttonheadinggroup'>
              <h3>{displayname + ':'} </h3>
              <Button
                icon={!this.state.hideName ? fiEyeOn : fiEyeOff}
                className='p-button-primary p-button-text p-button-rounded p-m-2'
                onClick={() =>
                  this.setState({ hideName: !this.state.hideName })
                }
              />
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

export class FailsBoard extends FailsBasis {
  constructor(props) {
    super(props)
    // this.state = {} move to parent
    this.state.arrangebuttondialog = false
    this.state.pictbuttondialog = false
    // this.state.casttoscreens = false // no initial definition, wait for network
    // this.state.showscreennumber = false // no initial definition, wait for network
    this.state.notepadisscreen = true
    this.state.blackbackground = true
    this.state.screens = [{ name: 'Loading...' }]
    this.state.noscreen = false
    this.state.pictures = null
    this.state.pictIndex = 0
    this.state.availscreens = []
    this.state.welcomeMessageSend = 0

    this.availscreensmenu = React.createRef()

    this.blockchathash = []

    // this.notepaduuid=uuidv4(); // may be get it later from server together with token?, yes that is how it is handled

    this.netSendSocket = this.netSendSocket.bind(this)

    this.reportDrawPos = this.reportDrawPos.bind(this)

    this.onHideArrangeDialog = this.onHideArrangeDialog.bind(this)
    this.onHidePictDialog = this.onHidePictDialog.bind(this)
    this.onAddPicture = this.onAddPicture.bind(this)
    this.onOpenNewScreen = this.onOpenNewScreen.bind(this)
    this.onNewWriting = this.onNewWriting.bind(this)
    this.arrangebuttonCallback = this.arrangebuttonCallback.bind(this)
    this.pictbuttonCallback = this.pictbuttonCallback.bind(this)
    this.itemGalleriaTemplate = this.itemGalleriaTemplate.bind(this)
    this.thumbnailGalleriaTemplate = this.thumbnailGalleriaTemplate.bind(this)
    this.pollTemplate = this.pollTemplate.bind(this)
    this.blockChat = this.blockChat.bind(this)
    this.allowVideoquestion = this.allowVideoquestion.bind(this)
    this.onStartPoll = this.onStartPoll.bind(this)
    this.onStartSelPoll = this.onStartSelPoll.bind(this)
    this.onFinishSelPoll = this.onFinishSelPoll.bind(this)
  }

  /*
  netSendShortCircuit(command, data) {
    if (command === 'lecturedetail') {
      this.setState({ lecturedetail: data })
      return
    }
    if (this.noteref) {
      switch (command) {
        case 'drawcommand':
          this.noteref.receiveData(data)
          break
        case 'pictureinfo':
          this.noteref.receivePictInfo(data)
          break
        case 'FoG':
          this.noteref.receiveFoG(data)
          break
        default:
          console.log('unhandled network command')
      }
    }
  }
  */

  componentDidMount() {
    console.log('Component mount Failsboard')
    // call connect socket?

    this.socket.connectNotepad()
    this.initializeNotepadSocket(this.socket)
    // this.updateSizes() // no argument no effect

    this.commonMount()
    if (!this.welcomeMessageSend) {
      this.toast.show({
        severity: 'info',
        sticky: true,
        content: <ShortcutsMessage parent={this} hasMedia={this.hasMedia} />
      })
      this.welcomeMessageSend = 1
    }
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    this.commonDidUpdate(prevProps, prevState, snapshot)
  }

  componentWillUnmount() {
    console.log('Component unmount Failsboard')
    this.socket.disconnect()
    this.commonUnmount()
  }

  initializeNotepadSocket(notepadsocket) {
    this.initializeCommonSocket(notepadsocket)

    notepadsocket.on(
      'notepadscreens',
      function (data) {
        console.log('notepadscreens', data)
        if (data.screens.length === 0) {
          this.setState({
            screens: [{ name: 'No screen available', value: 'none' }],
            noscreen: true
          })
        } else {
          this.setState({
            screens: data.screens,
            selscreen: null,
            noscreen: false
          })
        }
      }.bind(this)
    )

    notepadsocket.on('connect', (data) => {
      // if (this.noteref) this.noteref.setHasControl(false) // do not emit while reloading!
      /* setTimeout(function () {
          notepadsocket.emit('sendboards', {})
        }, 500) */
      this.setState({ id: this.socket.id })
      this.updateSizes() // inform sizes
    })

    notepadsocket.on('chatquestion', async (data) => {
      console.log('Incoming chat', data)
      let { text, userhash, encData, iv, keyindex } = data
      let isEncrypted = false
      try {
        if (this.blockchathash.indexOf(userhash) === -1) {
          if ((text === 'Encrypted' && encData, iv, keyindex)) {
            isEncrypted = true
            const decoder = new TextDecoder()
            const key = await this.keystore.getKey(keyindex)
            const decdata = await globalThis.crypto.subtle.decrypt(
              {
                name: 'AES-GCM',
                iv
              },
              key.e2e,
              encData
            )
            text = decoder.decode(decdata)
          }
        } else console.log('chat had been blocked')
      } catch (error) {
        console.log('Error in chatquestion', error)
        text = 'Error: receiving/decrypting chat: ' + error
      }
      const retobj = (
        <ChatMessage
          data={data}
          blockChat={() => this.blockChat(userhash)}
          latex={this.convertToLatex(text)}
          isEncrypted={isEncrypted}
          allowVideoquestion={this.allowVideoquestion}
          videoQuestion={
            this.state.avinterfaceStarted &&
            data?.videoquestion &&
            this.hasMediaSend
          }
        />
      )
      this.toast.show({ severity: 'info', content: retobj, sticky: true })
    })

    notepadsocket.on('startPoll', (data) => {
      console.log('startpoll incoming', data)

      this.setState({
        polltask: 1,
        curpoll: data,
        pollsel: undefined,
        pollshowres: false,
        pollvotes: {},
        pollballots: []
      })
    })

    notepadsocket.on('finishPoll', (data) => {
      console.log('finishpoll incoming', data)

      this.setState({ polltask: 2, pollsel: undefined })
    })

    notepadsocket.on('castvote', (data) => {
      console.log('castvote incoming', data)
      if (
        data.ballotid &&
        data.vote &&
        data.pollid &&
        data.pollid === this.state.curpoll.id
      ) {
        this.setState((state) => {
          const ballots = state.pollballots
          ballots.push({ data })
          const votes = state.pollvotes
          votes[data.ballotid] = data.vote

          return { pollballots: ballots, pollvotes: votes }
        })
      }

      // this.setState({ polltask: 2,  pollsel: undefined} );
    })
  }

  blockChat(userhash) {
    this.blockchathash.push(userhash)
  }

  allowVideoquestion(data) {
    this.netSendSocket('allowvideoquestion', data)
  }

  sendCloseVideoQuestion(data) {
    this.netSendSocket('closevideoquestion', data)
  }

  arrangebuttonCallback() {
    // End button was pressed
    this.setState({ arrangebuttondialog: true })
  }

  reportDrawPos(x, y) {
    if (this.floatvideo.current) {
      this.floatvideo.current.reportDrawPos(x, y)
    }
  }

  async onOpenNewScreen() {
    try {
      const authtoken = sessionStorage.getItem('failstoken')
      const ret = await this.socket.createScreen()
      sessionStorage.removeItem('failspurpose') // workaround for cloning
      sessionStorage.removeItem('failstoken')

      let targeturl = ret.screenurl
      if (targeturl[0] === '/')
        targeturl =
          window.location.protocol +
          '//' +
          window.location.hostname +
          (window.location.port !== '' ? ':' + window.location.port : '') +
          targeturl
      console.log('debug target url', targeturl)

      const newscreen = window.open(
        targeturl,
        uuidv4(),
        'height=600,width=1000,modal=yes,alwaysRaised=yes,menubar=yes,toolbar=yes'
      )
      sessionStorage.setItem('failstoken', authtoken)
      sessionStorage.setItem('failspurpose', 'lecture')

      if (!newscreen) console.log('Opening window failed')
      else {
        let postcount = 0
        const intervalId = setInterval(() => {
          newscreen.postMessage(
            { token: ret.token, purpose: 'screen' },
            targeturl
          )
          if (postcount === 50) window.clearInterval(intervalId) // if it was not loaded after 10 seconds forget about it
          postcount++
        }, 200)
        const messageHandle = (event) => {
          if (event && event.data && event.data.failsTokenOk) {
            window.clearInterval(intervalId)
            window.removeEventListener('message', messageHandle)
          }
        }
        window.addEventListener('message', messageHandle)
      }
    } catch (error) {
      console.log('createScreen failed', error)
    }
  }

  async onOpenNewNotepad() {
    try {
      const authtoken = this.myauthtoken
      const ret = await this.socket.createNotepad()
      sessionStorage.removeItem('failspurpose') // workaround for cloning
      sessionStorage.removeItem('failstoken')

      let targeturl = ret.notepadurl
      if (targeturl[0] === '/')
        targeturl =
          window.location.protocol +
          '//' +
          window.location.hostname +
          (window.location.port !== '' ? ':' + window.location.port : '') +
          targeturl
      console.log('debug target url', targeturl)

      const newnotepad = window.open(
        targeturl,
        uuidv4(),
        'height=600,width=1000,modal=yes,alwaysRaised=yes,menubar=yes,toolbar=yes'
      )
      sessionStorage.setItem('failstoken', authtoken)
      sessionStorage.setItem('failspurpose', 'lecture')

      if (!newnotepad) console.log('Opening window failed')
      else {
        let postcount = 0
        const intervalId = setInterval(() => {
          newnotepad.postMessage(
            { token: ret.token, purpose: 'lecture' },
            targeturl
          )
          if (postcount === 50) window.clearInterval(intervalId) // if it was not loaded after 10 seconds forget about it
          postcount++
        }, 200)
        const messageHandle = (event) => {
          if (event && event.data && event.data.failsTokenOk) {
            window.clearInterval(intervalId)
            window.removeEventListener('message', messageHandle)
          }
        }
        window.addEventListener('message', messageHandle)
      }
    } catch (error) {
      console.log('createNotepad failed', error)
    }
  }

  onNewWriting() {
    console.log('onnewwriting!')
    this.socket.simpleEmit('createchannel')
  }

  /* onRemoveScreen()
  {
    console.log("Remove screen",this.state.selscreen);
    this.socket.emit('removescreen',{screenuuid: this.state.selscreen.uuid});
  } */

  onRemoveChannel(channeluuid) {
    console.log('Remove channel', channeluuid)
    this.socket.simpleEmit('removechannel', { channeluuid })
  }

  async pictbuttonCallback() {
    // Picture button was pressed
    const ret = await this.socket.getAvailablePicts()

    console.log('getAvailablePicts', ret)
    const picts = ret.map((el) => ({
      itemImageSrc: el.url,
      thumbnailImageSrc: el.urlthumb,
      id: el.sha,
      alt: el.name
    }))
    this.setState({ pictbuttondialog: true, pictures: picts })

    /* let dummypicthelp=dummypict.default;

    let picts= [{itemImageSrc: dummypicthelp , thumbnailImageSrc: dummypicthelp, alt: "Dummy Pict", title: "Dummy Pict",id:1, uuid: "d1f4387e-5793-4d13-a16a-28572ebcbc18" },
    {itemImageSrc: dummypicthelp , thumbnailImageSrc: dummypicthelp, alt: "Dummy Pict2", title: "Dummy Pict2",id:2, uuid: "d1f4387e-5793-4d13-a16a-28572ebcbc18" },
    {itemImageSrc: dummypicthelp , thumbnailImageSrc: dummypicthelp, alt: "Dummy Pict3", title: "Dummy Pict3",id:2, uuid: "d1f4387e-5793-4d13-a16a-28572ebcbc18" } ]; */
  }

  selectWrist(pos) {
    if (this.noteref) this.noteref.selectWrist(pos)
  }

  onHideArrangeDialog() {
    this.setState({ arrangebuttondialog: false })
    if (this.noteref) {
      this.noteref.setHasControl(true)
      this.noteref.reactivateToolBox()
    }
  }

  onHidePictDialog() {
    this.setState({ pictbuttondialog: false })
    if (this.noteref) {
      this.noteref.setHasControl(true)
      this.noteref.reactivateToolBox()
    }
  }

  onAddPicture() {
    this.setState({ pictbuttondialog: false })
    if (this.noteref) {
      const pict = this.state.pictures[this.state.pictIndex]
      this.noteref.receivePictInfo({
        uuid: pict.id,
        url: pict.itemImageSrc,
        thumburl: pict.thumbnailImageSrc
      })
      this.noteref.enterAddPictureMode(
        pict.id,
        pict.itemImageSrc /* URL */,
        pict.thumbnailImageSrc
      )
    }
  }

  async onStartPoll() {
    this.setState({ polltask: 0 })
    this.onHideArrangeDialog()

    const ret = await this.socket.getPolls()

    console.log('getPolls', ret)
    this.setState({ pollcoll: ret })
  }

  onStartSelPoll() {
    if (!this.state.pollcoll) return
    const polfind = this.state.pollcoll.find(
      (el) => el.id === this.state.pollsel
    )
    this.socket.simpleEmit('startPoll', {
      poll: polfind
    })
  }

  onFinishSelPoll() {
    if (!this.state.curpoll) return
    const result = this.calcPollresults().data
    const tresult = []
    for (const res in result) {
      const mine = this.state.curpoll.children.find((el) => el.id === res)
      tresult.push({ id: res, data: result[res], name: mine.name })
    }
    this.socket.simpleEmit('finishPoll', {
      pollid: this.state.curpoll.id,
      result: tresult
    })
  }

  addNotescreenToChannel(channeluuid, uuid) {
    console.log('Add screen with uuid')
    this.socket.simpleEmit('addnotescreentochannel', {
      channeluuid,
      notescreenuuid: uuid
    })
  }

  itemGalleriaTemplate(item) {
    if (!item) {
      return <div>No valid picture selected!</div>
    }
    return (
      <div key={item.itemImageSrc + 'IMG'}>
        <img
          src={item.itemImageSrc}
          key={item.itemImageSrc + 'IMGBody'}
          alt={item.alt}
          loading='lazy'
          style={{
            width: 'auto',
            height: '50vh',
            display: 'block',
            maxWidth: '75vw',
            backgroundImage: 'url(' + item.thumbnailImageSrc + ')',
            backgroundSize: 'contain'
          }}
        />
        <span
          style={{
            right: 0,
            bottom: 0,
            position: 'absolute',
            color: '#2196F3'
          }}
        >
          {' '}
          {item.alt}
        </span>
      </div>
    )
  }

  thumbnailGalleriaTemplate(item) {
    return (
      <img
        src={item.thumbnailImageSrc}
        alt={item.alt}
        style={{ height: '40px', display: 'block' }}
      />
    )
  }

  pollTemplate(item) {
    console.log('itemlog', item)
    let childlist = []
    if (item.children)
      childlist = item.children.map((el, ind) => (
        <li key={item.id + ind}>{el.name}</li>
      ))
    return (
      <div key={item.id}>
        <h3> {item.name + (item.multi ? ' (multi)' : ' (single)')} </h3>
        <ol>{childlist}</ol>
      </div>
    )
  }

  calcPollresults() {
    const tpolldata = {}
    this.state.curpoll.children.forEach((el) => {
      tpolldata[el.id] = 0
    })
    const helper = (el2) => {
      if (el2) {
        if (el2 in tpolldata) tpolldata[el2]++
      }
    }
    let numballots = 0
    for (const el in this.state.pollvotes) {
      // the element
      const cur = this.state.pollvotes[el]

      if (this.state.curpoll.multi) {
        cur.forEach(helper)
      } else {
        helper(cur)
      }
      numballots++
    }
    return { data: tpolldata, numballots }
  }

  render() {
    let polldata = {}
    const pollanswers = []
    let numballots = 0

    if (this.state.polltask === 1 || this.state.polltask === 2) {
      const tpollres = this.calcPollresults()
      const tpolldata = tpollres.data
      numballots = tpollres.numballots

      polldata = {
        labels: [],
        datasets: [
          {
            data: [],
            label: 'number of votes',
            type: 'bar',
            backgroundColor: '#CAFEB8',
            borderColor: '#D3D3D3',
            borderDash: [5, 5],
            fill: true
          }
        ]
      }
      let ind = 0
      for (const choice in tpolldata) {
        const mine = this.state.curpoll.children.find((el) => el.id === choice)
        polldata.labels.push('A ' + (ind + 1))
        pollanswers.push(
          <div key={ind + 'anw'}>
            {' '}
            <b>{'A ' + (ind + 1) + ': '} </b> {mine.name}{' '}
          </div>
        )
        polldata.datasets[0].data.push(tpolldata[choice])
        ind++
      }
      console.log('polldata', polldata)
    }

    // if (this.decodedToken()) console.log("decoded token",this.decodedToken(), this.decodedToken().notepadhandler);

    const pollitems = [
      { label: 'Choose' },
      { label: 'Poll' },
      { label: 'Results' }
    ]
    const blackbackground =
      typeof this.state.blackbackground === 'undefined'
        ? true
        : this.state.blackbackground

    // console.log('pictures', this.state.pictures)
    return (
      <div>
        <Toast ref={(el) => (this.toast = el)} position='top-left' />
        {this.screenOverlay()}
        {!this.state.tokenexpired && this.loadDataDialog()}
        {this.expiredTokenDialog()}
        <NoteScreenBase
          arrangebuttoncallback={this.arrangebuttonCallback}
          netsend={this.netSendSocket}
          isnotepad={true}
          bbchannel={this.bbchannel}
          pictbuttoncallback={this.pictbuttonCallback}
          reportDrawPosCB={this.reportDrawPos}
          mainstate={{
            blackbackground,
            bgpdf: this.state.bgpdf,
            showscreennumber: this.state.showscreennumber,
            casttoscreens: this.state.casttoscreens
          }}
          backgroundcolor={
            this.state.bgpdf
              ? '#FFFFFF'
              : blackbackground
              ? '#505050'
              : '#efefef'
          }
          backclass={
            this.state.bgpdf
              ? ''
              : blackbackground
              ? 'blackboardBlackNote'
              : 'blackboardWhiteNote'
          }
          screennumbercolor={blackbackground ? '#FFFFFF' : '#000000'}
          screennumber={this.state.notescreenid}
          startpoll={this.onStartPoll}
          width={this.props.width}
          height={this.props.height}
          noteref={this.getNoteRef}
          updateSizes={this.updateSizes}
          toggleFullscreen={this.toggleFullscreen}
          showscreennumber={this.state.showscreennumber}
          identobj={this.state.identobj}
          experimental={this.experimental()}
          startUpAVBroadcast={
            this.state.avinterfaceStarted || !this.hasMedia
              ? undefined
              : () => {
                  this.startUpAVinterface()
                }
          }
        ></NoteScreenBase>
        {!this.state.casttoscreens && (
          <div
            style={{
              position: 'absolute',
              bottom: '2vh',
              right: '1vw',
              zIndex: 150
            }}
          >
            <Button
              label=' Start casting'
              icon={fiEyeOn}
              key={'casttoscreen'}
              onClick={(e) => {
                this.updateSizes({
                  casttoscreens: true
                })
              }}
              className='p-button-primary p-button-raised p-button-rounded'
            />
          </div>
        )}
        {this.state.avinterfaceStarted && (
          <FloatingVideo ref={this.floatvideo}>
            <VideoControl
              videoid={this.state.dispvideo}
              id={this.state.id}
              speakerset={this.speakerset}
              avStateHook={(avstate) => {
                this.setState({ avstate })
              }}
            ></VideoControl>
          </FloatingVideo>
        )}

        <Dialog
          header='Select picture'
          visible={this.state.pictbuttondialog}
          style={{ width: '50vw' }}
          onHide={this.onHidePictDialog}
        >
          {this.state.pictures && this.state.pictures.length !== 0 && (
            <div className='p-grid'>
              <div className='p-col-12'>
                <Galleria
                  value={this.state.pictures}
                  item={this.itemGalleriaTemplate}
                  thumbnail={this.thumbnailGalleriaTemplate}
                  activeIndex={this.state.pictIndex}
                  onItemChange={(e) => {
                    if (
                      !this.state.pictures ||
                      e.index >= this.state.pictures.length
                    )
                      return
                    this.setState({ pictIndex: e.index })
                  }}
                ></Galleria>
              </div>
              <div className='p-col-6'>
                <Button
                  label='Add to lecture'
                  icon='pi pi-plus'
                  onClick={this.onAddPicture}
                />
              </div>
            </div>
          )}
          {this.state.pictures && this.state.pictures.length === 0 && (
            <h3> No pictures uploaded! </h3>
          )}
        </Dialog>

        <Dialog
          header='Arrange elements'
          visible={this.state.arrangebuttondialog}
          onHide={this.onHideArrangeDialog}
        >
          <div className='p-grid'>
            <ChannelEdit
              channelinfo={this.state.channelinfo}
              availscreens={this.state.availscreens}
              app={this}
            ></ChannelEdit>
          </div>
        </Dialog>
        <Dialog
          header='Poll'
          visible={typeof this.state.polltask !== 'undefined'}
          closable={this.state.polltask === 2 || this.state.polltask === 0}
          onHide={() => {
            this.setState({ polltask: undefined, pollsel: undefined })
          }}
        >
          <Steps model={pollitems} activeIndex={this.state.polltask} />
          {this.state.polltask === 0 && (
            <React.Fragment>
              <ListBox
                value={this.state.pollsel}
                className='p-m-2'
                options={
                  this.state.pollcoll &&
                  this.state.pollcoll.filter(
                    (el) => el.children && el.children.length > 1
                  )
                }
                optionLabel='name'
                optionValue='id'
                itemTemplate={this.pollTemplate}
                onChange={(e) => this.setState({ pollsel: e.value })}
              />
              {this.state.pollsel && (
                <Button
                  label='Start poll'
                  icon='pi pi-chart-bar'
                  className='p-m-2'
                  onClick={this.onStartSelPoll}
                />
              )}
            </React.Fragment>
          )}
          {(this.state.polltask === 1 || this.state.polltask === 2) && (
            <React.Fragment>
              <div className='p-d-flex p-ai-center'>
                <div className='p-mr-2'>
                  <h3>
                    {' '}
                    {this.state.curpoll
                      ? this.state.curpoll.name +
                        (this.state.curpoll.multi ? ' (multi)' : ' (single)')
                      : 'Current poll'}
                  </h3>
                </div>
                {this.state.polltask === 1 && (
                  <div className='p-mr-2'>
                    <Button
                      icon={this.state.pollshowres ? fiEyeOn : fiEyeOff}
                      tooltip='Show/hide poll results'
                      onClick={(e) =>
                        this.setState({ pollshowres: !this.state.pollshowres })
                      }
                      className='p-button-rounded p-button-text'
                    />
                  </div>
                )}
              </div>
              <Chart
                type='bar'
                data={polldata}
                style={{
                  visibility:
                    this.state.pollshowres || this.state.polltask === 2
                      ? 'visible'
                      : 'hidden'
                }}
                options={{
                  indexAxis: 'x',
                  responsive: true,
                  maintainAspectRation: false
                }}
              />
              {pollanswers}
              Number of ballots: {numballots} <br></br>
              {this.state.polltask === 1 && (
                <Button
                  label='Finish poll'
                  icon='pi pi-chart-bar'
                  className='p-m-2'
                  onClick={this.onFinishSelPoll}
                />
              )}
              {this.state.polltask === 2 && (
                <React.Fragment>
                  {' '}
                  <h4> Voting is over!</h4>
                  <Button
                    label='Report to Clipboard'
                    icon='pi pi-copy'
                    className='p-m-2'
                    onClick={() =>
                      navigator.clipboard &&
                      navigator.clipboard.writeText(
                        JSON.stringify(
                          {
                            ballots: this.state.pollballots,
                            poll: this.state.curpoll,
                            votes: this.state.pollvotes
                          },
                          null,
                          2
                        )
                      )
                    }
                  />{' '}
                </React.Fragment>
              )}
            </React.Fragment>
          )}
        </Dialog>
      </div>
    )
  }
}

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
        ></NoteScreenBase>
        <Sidebar
          visible={!this.state.casttoscreens}
          position='top'
          style={{ width: '100%', height: '98%', zIndex: 100 }}
          showCloseIcon={false}
          onHide={() => {}}
        >
          {this.state.screenmode && this.renderScreenText()}
        </Sidebar>
        {this.state.avinterfaceStarted && (
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
            {!this.state.avinterfaceStarted && (
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

    this.notepaduuid = null
    this.notetools = React.createRef()

    this.toggleScrollUnlock = this.toggleScrollUnlock.bind(this)
    this.sendChatMessage = this.sendChatMessage.bind(this)
    this.onVoteSel = this.onVoteSel.bind(this)
    this.onCastvote = this.onCastvote.bind(this)
    this.informDraw = this.informDraw.bind(this)
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
          return { scrollunlock: !state.scrollunlock, pageoffset: curoffset }
        }
      })
    }
  }

  toggleScrollUnlock() {
    const curoffset = this.noteref.calcCurpos()

    this.setState((state) => {
      if (state.scrollunlock) {
        return { scrollunlock: !state.scrollunlock, pageoffset: 0 }
      } else {
        return { scrollunlock: !state.scrollunlock, pageoffset: curoffset }
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
    const notesmode = this.state.notesmode
    const ttopts = {
      className: 'teal-tooltip',
      position: 'top',
      showDelay: 1000
    }
    return (
      <div>
        <Button
          icon={this.state.scrollunlock ? 'pi pi-lock-open' : 'pi pi-lock'}
          className='p-button-raised p-button-rounded p-m-2'
          tooltip='Lock/unlock scrolling to lecturer'
          tooltipOptions={ttopts}
          onClick={this.toggleScrollUnlock}
        />
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
        <Button
          icon='pi pi-comment'
          className='p-button-raised p-button-rounded p-m-2'
          onClick={(e) => this.chatop.toggle(e)}
          tooltip='Send comment to lecturer'
          tooltipOptions={ttopts}
          aria-haspopup
          aria-controls='overlay_panel'
        />
        {!this.state.avinterfaceStarted &&
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
                {this.state.avinterfaceStarted && (
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
          <b>{'A ' + (ind + 1) + ': '} </b> {el.name}{' '}
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
            {el.name}
          </label>
        </div>
      ))
    }

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
        {this.state.avinterfaceStarted && (
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
          hidden={!this.state.casttoscreens}
          informDraw={this.informDraw}
          experimental={this.experimental()}
        ></NoteScreenBase>
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
                  ? this.state.curpoll.name +
                    (this.state.curpoll.multi ? ' (multi)' : ' (single)')
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
                  ? this.state.curpoll.name +
                    (this.state.curpoll.multi ? ' (multi)' : ' (single)')
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
