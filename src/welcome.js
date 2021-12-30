import React, { Component } from 'react'
import failsLogoLong from './logo/logo1.svg'
import { RadioButton } from 'primereact/radiobutton'
import { Button } from 'primereact/button'
import QRCode from 'qrcode.react'
import { ScreenManager } from './screenmanager'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDesktop } from '@fortawesome/free-solid-svg-icons'
import { io } from 'socket.io-client'

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

    this.clientId = Math.random().toString(36).substr(2, 9)

    this.requests = []
    this.requestpoint = {}
    const myrequest = { purpose: 'lecture', id: this.clientId }
    this.requests.push(myrequest)
    this.requestpoint[this.clientId] = myrequest
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
      multiplex: false
    })

    this.socket.removeAllListeners('reqprocessed')
    this.socket.on('reqprocessed', (data) => {
      console.log('reqprocessed', data)
      if (Array.isArray(data)) {
        let mytoken = null
        for (let i = 0; i < data.length; i++) {
          const cur = data[i]
          if (cur.id === this.clientId) mytoken = cur
          else {
            // post to respective client
            if (this.requestpoint[cur.id]) {
              this.requestpoint[cur.id].win.postMessage('reqprocessed', cur)
            }
          }
        }
        if (mytoken) {
          sessionStorage.setItem('failspurpose', mytoken.purpose)
          sessionStorage.setItem('failstoken', mytoken.token)
          this.props.purposesetter(mytoken.purpose)
        }
      }
    })
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
  }

  sendRequests() {
    if (this.requestTimer) window.clearTimeout(this.requestTimer)
    console.log('send requests')
    this.socket.emit('request', { reqs: this.requests }, (code) => {
      console.log('got answer', this.requests)
      this.setState({ logincode: code })
    })
    this.requestTimer = window.setTimeout(this.sendRequests, 10 * 60 * 1000)
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
    this.sendRequests()
  }

  render() {
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
            src={failsLogoLong}
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
                  <h2> Function </h2>
                  <span>
                    <div className='p-field-radiobutton'>
                      <RadioButton
                        inputId='lecture'
                        name='notepad'
                        value='lecture'
                        onChange={(e) => this.changePurpose(e.value)}
                        checked={this.state.purpose === 'lecture'}
                      />
                      <label htmlFor='lecture'>Notepad (draw and edit)</label>
                    </div>
                    <div className='p-field-radiobutton'>
                      <RadioButton
                        inputId='screen'
                        name='screen'
                        value='screen'
                        onChange={(e) => this.changePurpose(e.value)}
                        checked={this.state.purpose === 'screen'}
                      />
                      <label htmlFor='screen'>Screen (shows the lecture)</label>
                    </div>
                  </span>
                  <Button
                    className='p-button-primary  p-button-rounded p-m-2'
                    label='Open additional window'
                    icon='pi pi-plus'
                  />
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
                    <p style={{ fontSize: '3.0vw' }}>
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
