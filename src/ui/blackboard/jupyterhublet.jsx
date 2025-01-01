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
import React, { Component, Fragment } from 'react'
import { Tooltip } from 'primereact/tooltip'
import {
  faMaximize,
  faArrowsAlt,
  faTachometerAlt,
  faCamera,
  faChevronLeft,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { JupyterEdit } from '../../../../app/src/jupyteredit'
import { OverlayPanel } from 'primereact/overlaypanel'

export class AppletButton extends Component {
  constructor(args) {
    super(args)
    this.buttonRef = React.createRef()
  }

  setPointerCapture(pointerid) {
    this.buttonRef.current?.setPointerCapture?.(pointerid)
  }

  render() {
    const icon = typeof this.props.icon !== 'string' && this.props.icon
    const style = {}
    let iconclassname
    if (typeof this.props.icon === 'string') iconclassname = this.props.icon
    if (this.props.hide) style.visibility = 'hidden'
    return (
      <button
        className={
          this.props.selected
            ? 'appletButtons appletButtonSelected'
            : 'appletButtons'
        }
        ref={this.buttonRef}
        style={style}
        onClick={this.props.onClick}
        onPointerDown={this.props.onPointerDown}
        onPointerMove={this.props.onPointerMove}
        onPointerUp={this.props.onPointerUp}
      >
        {icon}
        {iconclassname && <span className={iconclassname}></span>}
        {this.props.tooltip && (
          <Tooltip
            target={this.buttonRef.current}
            content={this.props.tooltip}
            className='teal-tooltip'
            position='top'
            showDelay={1000}
          />
        )}
      </button>
    )
  }
}

export class JupyterHublet extends Component {
  constructor(props) {
    super(props)
    this.buttonRef = {
      resize: React.createRef(),
      move: React.createRef()
    }
    this.jupyteredit = React.createRef()
    this.jupyterinfo = React.createRef()
    this.kernelStatusRef = React.createRef()
    this.moveid = {}
    this.movemodeactiv = {}
    this.moveposcurrent = {}
    this.moveposstart = {}
    this.lastmovetime = {}
    this.state = {}
    this.state.movemodeactiv = {}
    this.state.kernelStatus = 'unknown'
    this.appletwidth = 100
    this.appletheight = 100
  }

  componentDidMount() {
    // we just got mounted, we should load the file
    this.tryLoadJupyterFile()
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.props.ipynb?.sha !== prevProps.ipynb?.sha) {
      this.setState({ jupyteredit: false })
      this.tryLoadJupyterFile()
    }
    if (this.props.master !== prevProps.master) {
      // check if we have to initiate a master rescale
      this.checkAdjustAppletSize()
    }
  }

  async jupyterLicense() {
    const { licenses } = await this.jupyteredit.current.getLicenses()
    const lines = []
    for (const [key, value] of Object.entries(licenses.bundles)) {
      lines.push(
        key + '\n' + '#'.repeat(key.length) + '\n\n',
        'Dependencies:\n'
      )
      const text = value?.packages
        ?.map?.(
          ({ name, versionInfo = '', licenseId = '', extractedText = '' }) => {
            const heading = name + '(' + versionInfo + ', ' + licenseId + ')'
            return (
              heading +
              ':\n' +
              '-'.repeat(heading.length) +
              '\n' +
              extractedText
            )
          }
        )
        ?.join('\n')
      if (text) lines.push(text)
    }
    // now generate a blob and download
    const blob = new Blob([lines.join('')], {
      type: 'text/plain'
    })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    URL.revokeObjectURL(url)
  }

  async tryLoadJupyterFile() {
    if (!this.props?.ipynb?.sha || !this.props?.ipynb?.url) {
      this.setState({ jupyteredit: false })
    }
    if (!this.props?.ipynb?.url) return
    try {
      const response = await fetch(this.props.ipynb?.url)
      if (!response.ok)
        throw new Error(
          'Fetch failed with code: ' +
            response.status +
            ' ' +
            response.statusText
        )
      const jupyterDocument = await response.json()
      this.setState({ jupyterDocument, jupyteredit: true })
    } catch (error) {
      console.log('Problem loading Jupyter file', error)
    }
  }

  async doScreenshot() {
    if (!this.props.screenShotSaver) return
    if (!this.props.addPicture) return
    try {
      const { sha } = await this.props.screenShotSaver(
        await this.jupyteredit.current?.screenShot?.({
          dpi: 300
        })
      )
      if (!sha) {
        throw new Error('No sha in doScreeenshot')
      }
      // TODO issue picture command
      this.props.addPicture(
        this.props.pos.x,
        this.props.pos.y,
        this.props.pos.width,
        this.props.pos.height,
        sha
      )
      // remove app, this also ensures, that it happens after the new picture arrives
      if (!this.props.submitAppPosition) return
      this.props.submitAppPosition(
        this.props.pos.x,
        this.props.pos.y,
        this.props.pos.width,
        this.props.pos.height,
        true
      )
    } catch (error) {
      console.log('Screenshot error', error)
    }
  }

  canMove() {
    return this.props.master // or unlocked
  }

  onPointerDown(buttonid, event) {
    if (!this.canMove()) return
    if (this.buttonRef[buttonid].current) {
      this.buttonRef[buttonid].current.setPointerCapture(event.pointerId)
    }
    const stateChange = {}
    stateChange[buttonid] = true
    this.setState((state) => ({
      movemodeactiv: { ...state.movemodeactiv, ...stateChange }
    }))
    this.movemodeactiv[buttonid] = true
    this.moveid[buttonid] = event.pointerId
    this.lastmovetime[buttonid] = Date.now() - 50
    this.moveposstart[buttonid] = { x: event.clientX, y: event.clientY }
    this.moveposcurrent[buttonid] = { x: event.clientX, y: event.clientY }
  }

  onPointerMove(buttonid, event) {
    if (!this.canMove()) return
    // by pass for better smoothness
    const now = Date.now()
    if (
      this.movemodeactiv[buttonid] &&
      this.moveid[buttonid] === event.pointerId &&
      now - this.lastmovetime[buttonid] > 25
    ) {
      this.moveposcurrent[buttonid] = { x: event.clientX, y: event.clientY }
      // const pos = { x: event.clientX, y: event.clientY }
      /* this.blackboard().addFormPictureMovePos({
        pos,
        corner: this.props.corner
      }) */
      this.lastmovetime[buttonid] = now
      this.updateMovePos()
    }
  }

  onPointerUp(buttonid, event) {
    if (!this.canMove()) return
    // rewrite
    if (
      this.movemodeactiv[buttonid] &&
      this.moveid[buttonid] === event.pointerId
    ) {
      this.commitMovePos()
      const stateChange = {}
      stateChange[buttonid] = false
      this.setState((state) => ({
        movemodeactiv: { ...state.movemodeactiv, ...stateChange }
      }))
      delete this.movemodeactiv[buttonid]
      delete this.moveid[buttonid]
      delete this.moveposstart[buttonid]
      delete this.moveposcurrent[buttonid]
      this.updateMovePos()
    }
  }

  get aspect() {
    return this.appletwidth / this.appletheight
  }

  commitMovePos() {
    if (this.props.master && this.props.submitAppPosition) {
      this.props.submitAppPosition(
        this.props.pos.x + (this.state?.movepos?.x ?? 0) / this.props.bbwidth,
        this.props.pos.y + (this.state?.movepos?.y ?? 0) / this.props.bbwidth,
        this.props.pos.width +
          (this.state?.resize?.width ?? 0) / this.props.bbwidth,
        this.props.pos.height +
          (this.state?.resize?.height ?? 0) / this.props.bbwidth,
        this.props.deactivated
      )
    }
  }

  updateMovePos() {
    const stateChange = { movepos: undefined, resize: undefined }
    if (this.movemodeactiv.move) {
      stateChange.movepos = {
        x: this.moveposcurrent.move.x - this.moveposstart.move.x,
        y: this.moveposcurrent.move.y - this.moveposstart.move.y
      }
    }
    if (this.movemodeactiv.resize) {
      // this one is trickier, first calculate the width and height
      const oldwidth = this.props.pos.width * this.props.bbwidth
      const oldheight = this.props.pos.height * this.props.bbwidth
      let newwidth =
        oldwidth + this.moveposcurrent.resize.x - this.moveposstart.resize.x
      let newheight =
        oldheight + this.moveposcurrent.resize.y - this.moveposstart.resize.y
      // filter out edge cases
      newwidth = Math.max(150, newwidth)
      newheight = Math.max(150, newheight)
      const destaspect = this.aspect
      if (newwidth > newheight) {
        newheight = newwidth / destaspect
      } else {
        newwidth = newheight * destaspect
      }
      newheight -= oldheight
      newwidth -= oldwidth

      stateChange.resize = {
        width: newwidth,
        height: newheight
      }
    }

    this.setState(stateChange)
  }

  setAspectScaleFactor(width, height) {
    if (width !== this.appletwidth || height !== this.appletheight) {
      this.appletwidth = width
      this.appletheight = height
    }
    this.setState({ appletwidth: width, appletheight: height })
    this.checkAdjustAppletSize()
  }

  checkAdjustAppletSize() {
    if (this.props.master) {
      const oldaspect = this.props.pos.width / this.props.pos.height
      const newaspect = this.aspect
      if (oldaspect !== newaspect) {
        // Keep the area constant
        const area = this.props.pos.width * this.props.pos.height
        this.props.submitAppPosition(
          this.props.pos.x,
          this.props.pos.y,
          Math.sqrt(newaspect * area),
          Math.sqrt(area / newaspect),
          this.props.deactivated
        )
        /* if (
          this.props.pos.height * newaspect < this.props.pos.width &&
          this.props.pos.height * newaspect > 0.1
        ) {
          // we have to choose the height as reference
          this.props.submitAppPosition(
            this.props.pos.x,
            this.props.pos.y,
            this.props.pos.height * newaspect,
            this.props.pos.height,
            this.props.deactivated
          )
        } else {
          // we have to choose the width as reference
          this.props.submitAppPosition(
            this.props.pos.x,
            this.props.pos.y,
            this.props.pos.width,
            this.props.pos.width / newaspect,
            this.props.deactivated
          )
        } */
      }
    }
  }

  render() {
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    )
    const buttonVSize = 2.357 /* rem */ * rootFontSize + 8 /* border */
    const buttonHSize = 1.35 * rootFontSize
    const applet = this.props.ipynb?.applets?.find?.(
      (el) => this.props.appids?.appid === el.appid
    )
    const master = this.props.master
    const stopProp = (event) => event.stopPropagation()
    const width =
      this.props.pos.width * this.props.bbwidth +
      2 * buttonHSize +
      (this.state.resize?.width ?? 0)

    const wscale = Math.min(
      5,
      Math.max(
        0.2,
        (this.props.pos.width * this.props.bbwidth +
          (this.state.resize?.width ?? 0)) /
          (this.state?.appletwidth ??
            this.props.pos.width * this.props.bbwidth +
              (this.state.resize?.width ?? 0))
      )
    )
    const hscale = Math.min(
      5,
      Math.max(
        0.2,
        (this.props.pos.height * this.props.bbwidth +
          (this.state.resize?.height ?? 0)) /
          (this.state?.appletheight ??
            this.props.pos.height * this.props.bbwidth +
              (this.state.resize?.height ?? 0))
      )
    )
    return (
      <Fragment>
        <div
          className={
            this.state.movepos || this.state.resize
              ? 'appletMain appletMainMove'
              : 'appletMain'
          }
          key='appletMain'
          style={{
            position: 'absolute',
            left:
              (this.props.deactivated
                ? -width - 100
                : this.props.pos.x * this.props.bbwidth -
                  buttonHSize +
                  (this.state.movepos?.x ?? 0)) + 'px',
            top:
              this.props.pos.y * this.props.bbwidth -
              buttonVSize +
              (this.state.movepos?.y ?? 0) +
              'px',
            width: width + 'px',
            height:
              this.props.pos.height * this.props.bbwidth +
              2 * buttonVSize +
              (this.state.resize?.height ?? 0) +
              'px',
            zIndex: this.props.zIndex
          }}
          onPointerDown={stopProp}
          onPointerMove={stopProp}
          onPointerUp={stopProp}
        >
          <div
            style={{
              position: 'absolute',
              left: '0px',
              bottom: '0px'
            }}
          >
            {master && (
              <AppletButton
                icon={<FontAwesomeIcon icon={faChevronLeft} />}
                key='collapsebutton'
                tooltip='Collapse applet'
                onClick={(event) =>
                  this.props.submitAppPosition(
                    this.props.pos.x,
                    this.props.pos.y,
                    this.props.pos.width,
                    this.props.pos.height,
                    true
                  )
                }
              />
            )}
          </div>
          <div style={{ position: 'absolute', right: '0px', bottom: '0px' }}>
            <AppletButton
              // eslint-disable-next-line no-constant-condition
              icon={true ? 'pi pi-lock-open' : 'pi pi-lock'}
              key='lockbutton'
              tooltip='Unlock/Lock to instructors applet state'
            />
            {!master && this.props.makeAppletMaster && (
              <AppletButton
                icon={<FontAwesomeIcon icon={faTachometerAlt} />}
                key='controlbutton'
                onClick={() => {
                  this.props.makeAppletMaster()
                }}
                tooltip='Steer applet state'
              />
            )}
            {master && this.props.screenShotSaver && (
              <AppletButton
                icon={<FontAwesomeIcon icon={faCamera} />}
                key='appletbutton'
                onClick={() => {
                  this.doScreenshot()
                }}
                tooltip='Create picture from applet'
              />
            )}
            <AppletButton
              icon={'pi pi-info-circle'}
              key='infobutton'
              onClick={(e) => {
                console.log('Jupyter info')
                this.jupyterinfo?.current?.toggle?.(e)
              }}
              tooltip='Info about applet and license'
            />

            <AppletButton
              icon={<FontAwesomeIcon icon={faMaximize} />}
              key='sizebutton'
              hide={!master}
              tooltip={
                !(this.state.movepos || this.state.resize) && 'Resize applet'
              }
              ref={this.buttonRef.resize}
              selected={!!this.state.movemodeactiv.resize}
              onPointerDown={(event) => this.onPointerDown('resize', event)}
              onPointerMove={(event) => this.onPointerMove('resize', event)}
              onPointerUp={(event) => this.onPointerUp('resize', event)}
            />
          </div>
          <div className='appletHeading'>
            <AppletButton
              icon={<FontAwesomeIcon icon={faArrowsAlt} />}
              key='movebutton'
              tooltip={
                !(this.state.movepos || this.state.resize) && 'Move applet'
              }
              hide={!master}
              ref={this.buttonRef.move}
              selected={!!this.state.movemodeactiv.move}
              onPointerDown={(event) => this.onPointerDown('move', event)}
              onPointerMove={(event) => this.onPointerMove('move', event)}
              onPointerUp={(event) => this.onPointerUp('move', event)}
            />
            <div className='appletHeadingText'>
              {applet?.appname || 'Loading...'}
            </div>
            <div
              ref={this.kernelStatusRef}
              className={
                'appletKernelStatus appletKernelStatus' +
                this.state.kernelStatus
              }
            >
              <Tooltip
                target={this.kernelStatusRef.current}
                content={'Kernelstatus: ' + this.state.kernelStatus}
                className='teal-tooltip'
                position='top'
                showDelay={1000}
              />
            </div>
            <AppletButton
              icon={'pi pi-times'}
              key='closebutton'
              hide={!(master && this.props.closeApp)}
              onClick={() => {
                console.log('Close applet')
                this.props.closeApp()
              }}
              tooltip='Close applet'
            />
          </div>
          <div
            className='appletIframe'
            style={{
              position: 'absolute',
              inset: buttonVSize + 'px ' + buttonHSize + 'px'
            }}
          >
            <div
              style={{
                transform: 'scale(' + wscale + ',' + hscale + ')',
                transformOrigin: 'top left',
                width: '100%',
                height: '100%'
              }}
            >
              <JupyterEdit
                editActivated={this.state.jupyteredit}
                rerunAtStartup={true}
                installScreenShotPatches={
                  !!this.props
                    .makeAppletMaster /* only install, if it can become master */
                }
                ref={this.jupyteredit}
                document={this.state.jupyterDocument}
                filename={this.props.ipynb?.filename}
                appid={this.props.appids?.appid}
                stateCallback={(stateChange) => {
                  this.setState((state) => ({
                    jupyterState: {
                      ...(state.jupyterState || {}),
                      ...stateChange
                    }
                  }))
                }}
                appletSizeChanged={(appid, width, height) => {
                  if (appid === this.props.appids?.appid) {
                    this.setAspectScaleFactor(width, height)
                  }
                }}
                kernelStatusCallback={(status) => {
                  console.log('kernelStatus', status)
                  this.setState({ kernelStatus: status })
                }}
              />
            </div>
            {/* Id: {this.props.appids.id} <br />
            Sha: {this.props.appids.sha} <br />
            AppId: {this.props.appids.appid} <br />
            Url: {this.props.ipynb?.url || 'No url'} <br /> */}
          </div>
        </div>
        <div
          className={
            this.props.deactivated
              ? 'appletCollapsed'
              : 'appletCollapsed appletCollapsedHidden'
          }
          key='appletCollapsed'
          onPointerDown={stopProp}
          onPointerMove={stopProp}
          onPointerUp={stopProp}
          onClick={(event) =>
            this.props.submitAppPosition(
              this.props.pos.x,
              this.props.pos.y,
              this.props.pos.width,
              this.props.pos.height,
              false
            )
          }
          style={{
            position: 'absolute',
            top:
              (this.props.pos.y + this.props.pos.height * 0.5) *
                this.props.bbwidth -
              0.5 * buttonVSize +
              (this.state.movepos?.y ?? 0) +
              'px',
            zIndex: this.props.zIndex
          }}
        >
          <div className='appletCollapsedContent'>
            <FontAwesomeIcon icon={faChevronRight} />
          </div>
        </div>
        <OverlayPanel className='tbChild' ref={this.jupyterinfo} showCloseIcon>
          <h3>FAILS' apps are powered by Jupyter Lite</h3>
          Build upon the shoulders of giants, see{' '}
          <button
            onClick={() => {
              if (this.jupyteredit.current) {
                this.jupyterLicense()
              }
            }}
            className='link-button'
          >
            {' '}
            OSS attribution and licensing{' '}
          </button>{' '}
          for app related content.
          <br /> <br />
        </OverlayPanel>
      </Fragment>
    )
  }
}
