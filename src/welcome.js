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
import failsLogoLong from './logo/logo1.svg'
import failsLogoLongExp from './logo/logo1exp.svg'
import { RadioButton } from 'primereact/radiobutton'
import { Button } from 'primereact/button'
import QRCode from 'qrcode.react'
import { ScreenManager } from './screenmanager'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDesktop } from '@fortawesome/free-solid-svg-icons'
import { io } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'

export class Welcome extends Component {
  constructor(args) {
    super(args)
    this.state = {
      purpose: 'lecture',
      logincode: null,
      fullscreen: false
    }

    this.screenChange = this.screenChange.bind(this)

    this.screenm = new ScreenManager({ informScreenChange: this.screenChange })

    this.screenm.initializeScreenInfo()

    this.toggleFullscreen = this.toggleFullscreen.bind(this)
    this.sendRequests = this.sendRequests.bind(this)
    this.changePurpose = this.changePurpose.bind(this)
    this.messageHandle = this.messageHandle.bind(this)
    this.openWindow = this.openWindow.bind(this)
    this.reqprocessed = this.reqprocessed.bind(this)
    this.networkerror = this.networkerror.bind(this)

    this.clientId = Math.random().toString(36).substr(2, 9)

    this.requests = []
    this.requestpoint = {}
    const myrequest = { purpose: 'lecture', id: this.clientId }
    this.requests.push(myrequest)
    this.requestpoint[this.clientId] = myrequest
  }

  reqprocessed(data) {
    if (Array.isArray(data)) {
      let mytoken = null
      for (let i = 0; i < data.length; i++) {
        const cur = data[i]
        if (cur.id === this.clientId) mytoken = cur
        else {
          // post to respective client
          if (this.requestpoint[cur.id] && this.requestpoint[cur.id].win) {
            this.requestpoint[cur.id].win.postMessage({ reqprocessed: data })
          }
        }
      }
      if (mytoken) {
        sessionStorage.setItem('failspurpose', mytoken.purpose)
        sessionStorage.setItem('failstoken', mytoken.token)
        this.props.purposesetter(mytoken.purpose)
      }
    }
  }

  networkerror(data) {
    this.setState({ logincode: null })
  }

  componentDidMount() {
    console.log('Component mount welcome')
    const authhandler =
      window.location.protocol +
      '//' +
      window.location.hostname +
      (window.location.port !== '' ? ':' + window.location.port : '')
    this.socket = io(authhandler + '/auth', {
      path: '/auth.io',
      multiplex: false,
      transports: ['websocket']
    })

    this.socket.removeAllListeners('reqprocessed')
    this.socket.on('reqprocessed', this.reqprocessed)
    this.socket.removeAllListeners('error')
    this.socket.on('error', this.networkerror)
    window.addEventListener('message', this.messageHandle)
    this.sendRequests()
  }

  componentWillUnmount() {
    console.log('Component unmount welcome')
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    if (this.requestTimer) window.clearTimeout(this.requestTimer)
    delete this.requestTimer
    window.removeEventListener('message', this.messageHandle)
  }

  notSlave() {
    return (
      !this.master || (this.master && Date.now() - this.master > 60 * 2 * 1000)
    )
  }

  sendRequests() {
    if (this.requestTimer) window.clearTimeout(this.requestTimer)
    console.log('send requests')
    if (this.notSlave()) {
      const srequests = this.requests.map((el) => ({
        id: el.id,
        purpose: el.purpose
      }))
      this.socket.emit('request', { reqs: srequests }, (code) => {
        if (this.notSlave()) this.distributeLogincode(code)
      })
    }
    this.requestTimer = window.setTimeout(this.sendRequests, 10 * 60 * 1000)
  }

  distributeLogincode(code) {
    for (let i = 0; i < this.requests.length; i++) {
      const cur = this.requests[i]
      if (cur.id !== this.clientId && cur.win)
        cur.win.postMessage({ logincode: code })
    }
    this.setState({ logincode: code })
  }

  screenChange() {
    console.log('screenchange!')
    if (this.screenm.isFullscreen()) {
      this.setState({ fullscreen: true, screens: undefined })
    } else {
      this.setState({ fullscreen: false, screens: this.screenm.getScreens() })
    }
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

  changePurpose(val) {
    this.setState({ purpose: val })
    this.requestpoint[this.clientId].purpose = val
    if (this.masterwin) {
      this.masterwin.postMessage({
        changePurpose: true,
        purpose: val,
        id: this.clientId
      })
    }
    this.sendRequests()
  }

  openWindow() {
    const targeturl =
      window.location.protocol +
      '//' +
      window.location.hostname +
      (window.location.port !== '' ? ':' + window.location.port : '') +
      '/static/lecture/'
    console.log('debug target url', targeturl)

    const newwindow = window.open(
      targeturl,
      uuidv4(),
      'height=600,width=1000,modal=yes,alwaysRaised=yes,menubar=yes,toolbar=yes'
    )

    if (!newwindow) console.log('Opening window failed')
    else {
      let postcount = 0
      const intervalId = setInterval(() => {
        newwindow.postMessage({
          slavemode: true,
          logincode: this.state.logincode
        })
        if (postcount === 50) window.clearInterval(intervalId) // if it was not loaded after 10 seconds forget about it
        postcount++
      }, 200)
      const messageHandle = (event) => {
        if (event && event.data && event.data.slavemodeAck) {
          window.clearInterval(intervalId)
          window.removeEventListener('message', messageHandle)
        }
      }
      window.addEventListener('message', messageHandle)
    }
  }

  messageHandle(event) {
    if (event && event.data) {
      if (event.origin !== window.location.origin) {
        console.log('origin check', event.origin)
        return
      }
      if (event.data.slavemode) {
        if (event.source) {
          console.log('enter slave mode', event.data.logincode)
          this.setState({ logincode: event.data.logincode })
          const slreqs = this.requests.map((el) => ({
            purpose: el.purpose,
            id: el.id
          }))
          const mess = {
            slavemodeAck: true,
            slaveRequests: slreqs,
            slaveId: this.clientID
          }
          event.source.postMessage(mess)
          this.master = Date.now()
          this.masterwin = event.source
        }
      } else if (event.data.reqprocessed) {
        // we have a token
        this.reqprocessed(event.data.reqprocessed)
      } else if (event.data.logincode) {
        console.log('got logincode', event.data.logincode)
        this.distributeLogincode(event.data.logincode)
        this.master = Date.now()
      } else if (
        event.data.changePurpose &&
        event.data.id &&
        event.data.purpose
      ) {
        this.requestpoint[event.data.id].purpose = event.data.purpose
        if (this.masterwin) {
          this.masterwin.postMessage({
            changePurpose: true,
            purpose: event.data.purpose,
            id: event.data.id
          })
        }
        this.sendRequests()
      } else if (event.data.slaveRequests && event.source) {
        if (this.masterwin) this.masterwin.postMessage(event.data)
        const requests = event.data.slaveRequests
        requests.forEach((el) => {
          if (el.purpose && el.id) {
            const newel = { purpose: el.purpose, id: el.id }
            newel.win = event.source
            this.requestpoint[el.id] = newel
            this.requests.push(newel)
          }
        })
        this.sendRequests()
      }
    }
  }

  render() {
    const experimental = window.location.pathname.includes('experimental')
    let fullscreensbuttons
    if (
      this.state.fullscreen ||
      (this.state.screens && this.state.screens.length === 1) ||
      !this.state.screens
    ) {
      fullscreensbuttons = (
        <Button
          icon='pi pi-window-maximize'
          style={{ width: '2vw', height: '2vw' }}
          key={'fsbutton'}
          onClick={this.toggleFullscreen}
          className='p-button-primary p-button-raised p-button-rounded fadeMenu'
        />
      )
    } else {
      fullscreensbuttons = this.state.screens.map((el) => (
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
            el.toggle()
          }}
        />
      ))
    }
    return (
      <div className='p-d-flex p-flex-column fade-in-welcome'>
        <div className='p-mb-2 p-as-center'>
          <img
            src={experimental ? failsLogoLongExp : failsLogoLong}
            style={{ width: '50vw' }}
            alt='FAILS logo long'
          />
        </div>
        <div className='p-mb-2'>
          <div className='p-d-flex  p-jc-center'>
            <div
              className='p-mr-2 p-p-4 p-as-center'
              style={{ fontSize: '1.2vw', width: '40%', color: '#023e8a' }}
            >
              <div className='p-d-flex p-flex-column'>
                <div className='p-mb-2 p-as-center'>
                  <h1>You are currently not logged in. </h1>
                  <p>
                    Please start FAILS directly from your LMS or authorize this
                    window in your LMS using the QR code or code on this page.{' '}
                  </p>
                </div>
                <div className='p-mb-2 p-as-center'>
                  <div className='p-grid p-align-center'>
                    <div className='p-col-6'>
                      <h2> Window function </h2>
                      <span>
                        <div className='p-field-radiobutton'>
                          <RadioButton
                            inputId='lecture'
                            name='notepad'
                            value='lecture'
                            onChange={(e) => this.changePurpose(e.value)}
                            checked={this.state.purpose === 'lecture'}
                          />
                          <label htmlFor='lecture'>
                            Notepad (draw and edit)
                          </label>
                        </div>
                        <div className='p-field-radiobutton'>
                          <RadioButton
                            inputId='screen'
                            name='screen'
                            value='screen'
                            onChange={(e) => this.changePurpose(e.value)}
                            checked={this.state.purpose === 'screen'}
                          />
                          <label htmlFor='screen'>
                            Screen (shows the lecture)
                          </label>
                        </div>
                      </span>
                    </div>
                    <div className='p-col-6'>
                      <h2> Multi-window </h2>
                      <Button
                        className='p-button-primary  p-button-rounded p-m-2'
                        label='Open additional window'
                        icon='pi pi-plus'
                        onClick={this.openWindow}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className='p-mr-2 p-p-4 p-as-center' style={{ width: '40vw' }}>
              {this.state.logincode && (
                <div className='p-grid'>
                  <div
                    className='p-col-fixed'
                    style={{
                      fontSize: '1.7vw',
                      width: '18vw',
                      color: '#023e8a'
                    }}
                  >
                    <h1>Logincode </h1>
                    <p
                      style={{
                        fontSize: '3.0vw',
                        fontFamily: 'monospace',
                        fontVariantNumeric: 'slashed-zero'
                      }}
                    >
                      <big>{this.state.logincode} </big>
                    </p>
                  </div>
                  <div className='p-col-6 p-p-4'>
                    <QRCode
                      value={this.state.logincode}
                      size={'16vw'}
                      renderAs='svg'
                      level={'L'}
                      fgColor={'#023e8a'}
                    ></QRCode>
                  </div>
                </div>
              )}
              {!this.state.logincode && (
                <div className='p-grid p-justify-center'>
                  <div
                    className='p-col-fixed'
                    style={{
                      fontSize: '1.2vw',
                      width: '30vw',
                      color: '#023e8a'
                    }}
                  >
                    <h1> No internet or server disconnected!</h1>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div
          className='p-mb-2 p-as-center'
          style={{ fontSize: '0.8vw', color: '#023e8a', textAlign: 'center' }}
        >
          {this.state.fullscreen && <h1> Exit fullscreen </h1>}
          {!this.state.fullscreen && <h1> Enter fullscreen </h1>}
          {fullscreensbuttons}
        </div>
      </div>
    )
  }
}
