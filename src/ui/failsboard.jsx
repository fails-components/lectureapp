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
import { Chart } from 'primereact/chart'
import { Dialog } from 'primereact/dialog'
import { ListBox } from 'primereact/listbox'
import { Steps } from 'primereact/steps'
import { Toast } from 'primereact/toast'
import { Tree } from 'primereact/tree'
import React, { Fragment } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { VideoControl, FloatingVideo } from '../avwidgets'
import { ChannelEdit } from './widgets/channeledit'
import { ChatMessage } from './widgets/chatmessage'
import { FailsBasis } from './failsbasis'
import { fiEyeOn, fiEyeOff } from './icons/icons'
import { NoteScreenBase } from './notepad/notepad'
import { PictureSelect } from './widgets/pictureselect'
import { ShortcutsMessage } from './widgets/shortcutsmessage'
import Pica from 'pica'
import ImageBlobReduce from 'image-blob-reduce'
import { notebookEditPseudoAppid } from './blackboard/jupyterhublet'

export class FailsBoard extends FailsBasis {
  constructor(props) {
    super(props)
    // this.state = {} move to parent
    this.state.arrangebuttondialog = false
    this.state.pictbuttondialog = false
    this.state.ipynbbuttondialog = false
    // this.state.casttoscreens = false // no initial definition, wait for network
    // this.state.showscreennumber = false // no initial definition, wait for network
    this.state.notepadisscreen = true
    this.state.blackbackground = true
    this.state.screens = [{ name: 'Loading...' }]
    this.state.noscreen = false
    this.state.pictures = null
    this.state.ipynbs = null
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
    this.onHideIpynbDialog = this.onHideIpynbDialog.bind(this)
    this.onAddPicture = this.onAddPicture.bind(this)
    this.onOpenNewScreen = this.onOpenNewScreen.bind(this)
    this.onOpenNewNotepad = this.onOpenNewNotepad.bind(this)
    this.onNewWriting = this.onNewWriting.bind(this)
    this.arrangebuttonCallback = this.arrangebuttonCallback.bind(this)
    this.pictbuttonCallback = this.pictbuttonCallback.bind(this)
    this.ipynbbuttonCallback = this.ipynbbuttonCallback.bind(this)
    this.screenShotSaver = this.screenShotSaver.bind(this)
    this.pollTemplate = this.pollTemplate.bind(this)
    this.blockChat = this.blockChat.bind(this)
    this.allowVideoquestion = this.allowVideoquestion.bind(this)
    this.onStartPoll = this.onStartPoll.bind(this)
    this.onStartSelPoll = this.onStartSelPoll.bind(this)
    this.onFinishSelPoll = this.onFinishSelPoll.bind(this)
    this.ipynbTemplate = this.ipynbTemplate.bind(this)
  }

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
            !this.state.avinterfaceHidden &&
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

  async onOpenNewScreen(event) {
    try {
      const fullscreenopts = '' // for now the feature is obsolete, and another alternative is pursued,

      // the existing code is deactivated and will be rewritten once the alternative is implemented.
      const ret = await this.socket.createScreen()
      const authtoken = sessionStorage.getItem('failstoken')
      sessionStorage.removeItem('failspurpose') // workaround for cloning
      sessionStorage.removeItem('failstoken')

      const targeturl =
        window.location.protocol +
        '//' +
        window.location.hostname +
        (window.location.port !== '' ? ':' + window.location.port : '') +
        window.location.pathname
      console.log('debug target url', targeturl)

      const newscreen = window.open(
        targeturl,
        uuidv4(),
        fullscreenopts
          ? 'modal=yes,alwaysRaised=yes,menubar=yes,toolbar=yes' +
              fullscreenopts
          : 'height=600,width=1000,modal=yes,alwaysRaised=yes,menubar=yes,toolbar=yes'
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

  async onOpenNewNotepad(event) {
    try {
      const fullscreenopts = '' // for now the feature is obsolete, and another alternative is pursued,

      // the existing code is deactivated and will be rewritten once the alternative is implemented.
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
        fullscreenopts
          ? 'modal=yes,alwaysRaised=yes,menubar=yes,toolbar=yes' +
              fullscreenopts
          : 'height=600,width=1000,modal=yes,alwaysRaised=yes,menubar=yes,toolbar=yes'
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
  }

  async ipynbbuttonCallback() {
    // Picture button was pressed
    const ret = await this.socket.getAvailableIpynbs()

    const ipynbs = ret
      .map((el) => ({
        label: el.name + (el.note ? ' (' + el.note + ') ' : ''),
        key: el.id + 'key',
        id: el.id,
        sha: el.sha,
        alt: el.name,
        selectable: false,
        children: el.applets?.map?.((applet) => ({
          appid: applet.appid,
          sha: el.sha,
          id: el.id,
          label: applet.appname,
          selectable: true,
          key: el.id + ':' + el.sha + ':' + applet.appid
        }))
      }))
      .filter((el) => el.children?.length > 0)
    this.setState({ ipynbbuttondialog: true, ipynbs })
  }

  async screenShotSaver({ data, type }) {
    const picture = new Blob([data], { type })

    if (!this.reduce) {
      const pica = Pica({ features: ['js', 'wasm', 'cib'] })
      this.reduce = new ImageBlobReduce({ pica })
    }
    const thumbnail = await this.reduce.toBlob(picture, { max: 100 })

    const result = await this.socket.uploadPicture(
      'screenshot_' +
        new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_') +
        '.png',
      picture,
      thumbnail
    )
    console.log('Peek result')
    const { sha, tsha } = result
    return { sha, tsha }
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

  onHideIpynbDialog() {
    console.log('inHideIpynbDialog')
    this.setState({ ipynbbuttondialog: false })
    /* if (this.noteref) {
      this.noteref.setHasControl(true)
      this.noteref.reactivateToolBox()
    } */
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

  async onStartApplet({
    appid = undefined,
    id = undefined,
    sha = undefined
  } = {}) {
    if (this.noteref && appid && id && sha) {
      this.noteref.onAppStart(id, sha, appid)
    }
    this.setState({
      ipynbs: undefined,
      ipynbbuttondialog: false
    })
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

  pollTemplate(item) {
    console.log('itemlog', item)
    let childlist = []
    if (item.children)
      childlist = item.children.map((el, ind) => (
        <li key={item.id + ind}>{el.name}</li>
      ))
    return (
      <div key={item.id}>
        <h3>
          {' '}
          {item.name + (item.multi ? ' (multi)' : ' (single)')}
          {item.note ? <small> {' ' + item.note} </small> : ''}
        </h3>
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

  ipynbTemplate(node) {
    if (node.appid) {
      const { appid, id, sha } = node
      // it is a app
      return (
        <React.Fragment>
          <b>{node.label}</b>{' '}
          <Button
            icon='pi pi-send'
            className='p-button-text p-button-sm'
            tooltip={'Start applet'}
            tooltipOptions={{
              className: 'teal-tooltip',
              position: 'top',
              showDelay: 1000
            }}
            iconPos='right'
            onClick={() => {
              this.onStartApplet({
                appid,
                id,
                sha
              })
            }}
          />{' '}
        </React.Fragment>
      )
    }
    return (
      <React.Fragment>
        <b>{node.label}</b>{' '}
        <Button
          icon='pi pi-file'
          className='p-button-text p-button-sm'
          tooltip={'Work individuelly at the notebook'}
          tooltipOptions={{
            className: 'teal-tooltip',
            position: 'top',
            showDelay: 1000
          }}
          iconPos='right'
          onClick={() => {
            this.onStartApplet({
              appid: notebookEditPseudoAppid,
              id: node.id,
              sha: node.sha
            })
          }}
        />{' '}
      </React.Fragment>
    )
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
    return (
      <div>
        <Toast ref={(el) => (this.toast = el)} position='top-left' />
        {this.screenOverlay()}
        {this.openNotepadScreenOverlay()}
        {!this.state.tokenexpired && this.loadDataDialog()}
        {this.expiredTokenDialog()}
        <NoteScreenBase
          arrangebuttoncallback={this.arrangebuttonCallback}
          netsend={this.netSendSocket}
          isnotepad={true}
          bbchannel={this.bbchannel}
          pictbuttoncallback={this.pictbuttonCallback}
          ipynbbuttoncallback={this.ipynbbuttonCallback}
          reportDrawPosCB={this.reportDrawPos}
          makeAppletMaster={() => {
            this.netSendSocket('switchAppMaster')
          }}
          screenShotSaver={this.screenShotSaver}
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
          features={this.features()}
          startUpAVBroadcast={
            (this.state.avinterfaceStarted && !this.state.avinterfaceHidden) ||
            !this.hasMedia
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
              zIndex: 151
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
        {this.state.avinterfaceStarted && !this.state.avinterfaceHidden && (
          <FloatingVideo ref={this.floatvideo}>
            <VideoControl
              videoid={this.state.dispvideo}
              id={this.state.id}
              speakerset={this.speakerset}
              avStateHook={(avstate) => {
                this.setState({ avstate })
              }}
              numUsers={this.state.identobj?.idents?.length}
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
                <PictureSelect
                  value={this.state.pictures}
                  activeIndex={this.state.pictIndex}
                  onItemChange={(e) => {
                    if (
                      !this.state.pictures ||
                      e.index >= this.state.pictures.length
                    )
                      return
                    this.setState({ pictIndex: e.index })
                  }}
                />
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
          header='Select jupyter notebook'
          visible={this.state.ipynbbuttondialog}
          style={{ maxWidth: '50vw', minWidth: '30vw' }}
          onHide={this.onHideIpynbDialog}
        >
          {this.state.ipynbs && this.state.ipynbs.length !== 0 && (
            <div className='p-grid'>
              <div className='p-col-12'>
                <Tree
                  value={this.state.ipynbs}
                  nodeTemplate={this.ipynbTemplate}
                  selectionMode='single'
                />
              </div>
            </div>
          )}
          {(!this.state.ipynbs || this.state.ipynbs.length === 0) && (
            <Fragment> No jupyter notebook uploaded!</Fragment>
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
              availscreenchannels={this.availscreenchannels}
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
