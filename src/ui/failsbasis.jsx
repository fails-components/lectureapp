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

import { faDesktop, faWindowMaximize } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Button } from 'primereact/button'
import { confirmDialog } from 'primereact/confirmdialog'
import { Dialog } from 'primereact/dialog'
import { OverlayPanel } from 'primereact/overlaypanel'
import { ProgressBar } from 'primereact/progressbar'
import React, { Component } from 'react'
import { UAParser } from 'ua-parser-js'
import { AVInterface } from '../av/interface'
import { SpeakerSet } from '../avwidgets'
import { KeyStore } from '../misc/keystore'
import { ScreenManager } from '../misc/screenmanager'
import { SocketInterface } from '../socket/interface'
import failsLogo from './logo/logo2.svg'
import failsLogoExp from './logo/logo2exp.svg'
import { VideoChat } from './widgets/videochat'

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
    this.state.avinterfaceHidden = true
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

    this.availscreenchannels = {}

    // TODO add purpose stuff
  }

  startUpAVinterface({ hidden = false } = {}) {
    const userhash = this.socket.getUserHash()
    if (!AVInterface.getInterface()) {
      AVInterface.createAVInterface({ userhash })
      this.avinterf = AVInterface.getInterface() // please hold a reference for the gargabe collector
      AVInterface.setNetworkControl(this.avchannel)
    }
    if (
      AVInterface.getInterface() &&
      (!this.state.avinterfaceStarted ||
        (this.state.avinterfaceHidden && !hidden))
    ) {
      this.setState({
        avinterfaceStarted: true,
        avinterfaceHidden: hidden
      })
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
        this.avoffers[data.type][data.id] = {
          time: Date.now(),
          db: data.db,
          miScChg: data.miScChg,
          channelid: data.channelid
        }
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
              newoffers[el.type][el.id] = {
                time: Number(el.time),
                db: el.db,
                miScChg: data.miScChg,
                channelid: data.channelid
              }
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
          if (channel.type === 'screenshare') {
            setstate.channeltype = 'screenshare'
            setstate.screenshareSourceId = channel.channeluuid
            this.startUpAVinterface({ hidden: true })
          } else {
            setstate.channeltype = 'notebooks'
            setstate.screenshareSourceId = undefined
            let notepos = 0
            let curpos = 0
            for (let i = 0; i < channel.notescreens.length; i++) {
              const cur = channel.notescreens[i]
              curpos += parseFloat(cur.scrollheight)
              if (cur.purpose === 'notepad') notepos = curpos
            }
            if (notepos === 0) {
              if (channel.notescreens.length > 0) {
                notepos = parseFloat(channel.notescreens[0].scrollheight)
              } else {
                notepos = curpos // if there is no notepad, then treat the lonely screen(s), all as a notepad
              }
            }
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
      this.state.avinterfaceStarted &&
      !this.state.avinterfaceHidden /* &&
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
    const screen = this.avoffers.screen
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
    const availscreenchannels = {}
    // screentime
    // TODO
    for (const sid in screen) {
      if (screen[sid].time > Date.now() - 30 * 1000 && screen[sid].channelid) {
        availscreenchannels[screen[sid].channelid] = {
          id: sid
          // may be add other stuff later
        }
      }
      if (screen[sid].miScChg && screen[sid].time > Date.now() - 5 * 1000) {
        // ok, activity on the screen share...
        if (this.screenShareActivity) this.screenShareActivity(sid)
      }
    }
    let screenshareSourceAVId
    if (this.state.screenshareSourceId) {
      screenshareSourceAVId =
        availscreenchannels[this.state.screenshareSourceId]?.id
    }
    if (screenshareSourceAVId !== this.state.screenshareSourceAVId) {
      this.setState({ screenshareSourceAVId })
    }
    this.availscreenchannels = availscreenchannels
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

  features() {
    const token = this.decodedToken()
    return token?.features || []
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
    if (ret.status === 'selector' && this.opScreens) {
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

  whereToOpen({ typename, event }) {
    if (this.whereToPromRej) {
      delete this.whereToPromRes
      const rej = this.whereToPromRej
      delete this.whereToPromRej
      rej()
    }
    return new Promise((resolve, reject) => {
      this.whereToPromRes = resolve
      this.whereToPromRej = reject

      this.screenm
        .queryExtended()
        .then((ret) => {
          if (ret.status === 'selector' && this.opNoteScreenOpen) {
            this.setState({ screensToSel: ret.screens })
            console.log('Notepadscreen event', event)
            this.setState({ typeNoteScreenOpening: typename })
            if (event.target) {
              if (typeof event.target.offsetHeight === 'undefined') {
                event.target.offsetHeight = 0 // fixes isssue in prime react
              }
            }
            this.opNoteScreenOpen.toggle(event)
          } else {
            resolve('')
            delete this.whereToPromRes
            delete this.whereToPromRej
          }
        })
        .catch((error) => {
          console.log('Problem in whereToOpen', error)
          delete this.whereToPromRes
          delete this.whereToPromRej
          reject(error)
        })
    })
  }

  // Overlay to choose, if the notepad or screen should be opened
  // on another screen
  openNotepadScreenOverlay() {
    const selOption = (openoption) => {
      if (this.whereToPromRes) {
        const res = this.whereToPromRes
        delete this.whereToPromRes
        delete this.whereToPromRej
        res(openoption)
      }
    }
    const screenbuttons = this.state.screensToSel.map((el) => (
      <Button
        className={
          !el.isCurrent
            ? 'p-button-primary  p-button-rounded p-m-2'
            : 'p-button-secondary p-button-rounded p-m-2'
        }
        key={el.number}
        icon={<FontAwesomeIcon icon={faDesktop} className='p-m-1' />}
        label={
          'Fullscreen ' +
          (el.number + 1) +
          (el.isCurrent ? ' (current)' : ' (other)')
        }
        onClick={(event) => {
          this.opNoteScreenOpen.hide()
          // TODO get info
          const openoption = `,left=${el?.screen?.availLeft},top=${el?.screen?.availTop},width=${el?.screen?.availWidth},height=${el?.screen?.availHeight},fullscreen`
          this.setState({ typeNoteScreenOpening: undefined })
          selOption(openoption)
        }}
      />
    ))
    screenbuttons.unshift(
      <Button
        className='p-button-secondary p-button-rounded p-m-2'
        key='Window'
        icon={<FontAwesomeIcon icon={faWindowMaximize} className='p-m-1' />}
        label='Window'
        onClick={(event) => {
          this.opNoteScreenOpen.hide()
          const openoption = ''
          this.setState({ typeNoteScreenOpening: undefined })
          selOption(openoption)
        }}
      />
    )

    return (
      <OverlayPanel
        ref={(el) => {
          this.opNoteScreenOpen = el
        }}
        onHide={() => {
          if (this.whereToPromRej) {
            delete this.whereToPromRes
            const rej = this.whereToPromRej
            delete this.whereToPromRej
            rej()
          }
        }}
      >
        <h3> Open {this.state.typeNoteScreenOpening} as</h3>
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
    const expmedia = this.features().includes('avbroadcast')
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
        scrollheight: this.noteref?.blackboard?.current
          ? this.noteref.blackboard.current.scrollheight()
          : 1,
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

  maybeUseLatex(item) {
    return this.detectLatex(item) ? this.convertToLatex(item) : item
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
            <span
              key={'latex-' + retarray.length}
              dangerouslySetInnerHTML={{ __html: html }}
            ></span>
          )
          secstart = curpos + 1
          seclatex = false
        } else {
          retarray.push(
            <React.Fragment key={'latex-' + retarray.length}>
              {string.substring(secstart, curpos - 1)}{' '}
            </React.Fragment>
          )
          secstart = curpos + 1
          seclatex = true
        }
      }
    }

    retarray.push(
      <React.Fragment key={'latex-' + retarray.length}>
        {string.substring(secstart, string.length)}{' '}
      </React.Fragment>
    )

    return retarray
  }
}
