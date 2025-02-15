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
import React, { Fragment } from 'react'
import failsLogo from '../logo/logo2.svg'
import { Badge } from 'primereact/badge'
import failsLogoExp from '../logo/logo2exp.svg'
import { Button } from 'primereact/button'
import { OverlayPanel } from 'primereact/overlaypanel'
import { ListBox } from 'primereact/listbox'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faEraser,
  faPen,
  faHighlighter,
  faArrowsAltV as faUpdown,
  faLongArrowAltDown as faArrowDownLong,
  faLongArrowAltUp as faArrowUpLong,
  faBars,
  faAdjust,
  faUndoAlt,
  faUser,
  faUserGroup
} from '@fortawesome/free-solid-svg-icons'
import {
  fiLaserpointer,
  fiPoll,
  fiEyeOff,
  fiEyeOn,
  fiArrangeScreens,
  fiPenBlocksTouch,
  fiPalmAreaDetection,
  fiWristPalmRejection,
  fiWristBottomRight,
  fiWristMiddleRight,
  fiWristTopRight,
  fiWristTopLeft,
  fiWristMiddleLeft,
  fiWristBottomLeft,
  fiMagicwand,
  fiTouchOn,
  fiTouchOff,
  fiBroadcastStart,
  fiStudent,
  fiFailsLogo,
  fiFormPictSubMenuIcon,
  fiAddPictIcon,
  fiAddLineIcon,
  fiAddRectangleIcon,
  fiAddEllipseIcon,
  fiAddCircleIcon,
  fiJupyterLiteIcon
} from '../icons/icons.jsx'
import { UAParser } from 'ua-parser-js'
import { ToolHandling } from './toolhandling.jsx'

export class ToolBox extends ToolHandling {
  constructor(props) {
    super(props)
    if (this.blackboard()) this.blackboard().current.toolbox = this

    this.state = {}

    this.state.posy = 0.1
    this.state.tbkey = 'tb0'
    this.setStateDefaults(this.state)

    this.tbx = 0.8 // constant toolbox pos
    this.lastpostime = Date.now()
    this.divheight = 32
    this.divwidth = 32

    this.secondtoolnum = 0

    this.lastUpdateTime = performance.now()

    // dynamics

    this.lastdrawpos = false
    this.lastdrawposx = 0
    this.lastdrawposy = 0

    this.lastvx = 0
    this.lastvy = 0

    this.scrollPointerdown = this.scrollPointerdown.bind(this)
    this.scrollPointerup = this.scrollPointerup.bind(this)
    this.scrollPointermove = this.scrollPointermove.bind(this)
    this.addRemoveTouchToolGuardian = this.addRemoveTouchToolGuardian.bind(this)
    this.addRemoveWristToolGuardian = this.addRemoveWristToolGuardian.bind(this)

    this.scrollButtonRef = React.createRef()
  }

  blackboard() {
    if (this.props.notepad && this.props.notepad.blackboard)
      return this.props.notepad.blackboard.current
  }

  scrollheight() {
    return this.props.bbheight / this.props.bbwidth
  }

  componentDidMount() {
    this.setDefaults()
    // select defaults after mount

    if (this.state.touchOn === undefined && this.blackboard())
      this.blackboard().pushTouchConfigToToolbox()
  }

  componentDidUpdate() {
    if (this.divref) {
      if (
        this.divref.offsetHeight !== this.divheight ||
        this.divref.offsetWidth !== this.divwidth
      ) {
        this.divheight = this.divref.offsetHeight
        this.divwidth = this.divref.offsetWidth
        // console.log('divheight changed', this.divheight)
        if (!this.scrollmodeactiv) this.reportDrawPos()
      }
    }
    if (this.state.touchOn === undefined && this.blackboard())
      this.blackboard().pushTouchConfigToToolbox()
  }

  addRemoveTouchToolGuardian(newguard) {
    if (this.touchtoolnum) clearTimeout(this.touchtoolnum)
    this.touchtoolnum = null
    if (newguard) {
      this.addRemoveSecondToolGuardian(newguard)
      this.touchtoolnum = setTimeout(() => {
        this.setState({ touchtool: null })
      }, 5000)
    }
  }

  addRemoveWristToolGuardian(newguard) {
    if (this.wristtoolnum) clearTimeout(this.wristtoolnum)
    this.wristtoolnum = null
    if (newguard) {
      this.addRemoveTouchToolGuardian(true)
      this.wristtoolnum = setTimeout(() => {
        this.setState({ wristtool: null })
      }, 5000)
    }
  }

  scrollboardSetReference() {
    const scrollref = this.blackboard().getStartScrollboardTB()
    this.scrollboardreference = scrollref
    this.scrolltoolposref = this.state.posy
  }

  scrollboard(scrollx, scrolly) {
    const scrollheight = this.scrollheight()
    const marginbottom = this.marginbottom()
    const bottom = scrollheight - marginbottom
    let newposy = this.scrolltoolposref - scrolly / this.props.bbwidth // well we have to check if it will be relocated
    if (newposy > bottom || newposy < 0.1 * scrollheight)
      newposy = 0.5 * scrollheight
    this.setState({ posy: newposy })
    if (this.blackboard()) {
      this.blackboard().scrollboardTB(
        scrollx / this.props.bbwidth,
        scrolly / this.props.bbwidth,
        this.scrollboardreference
      )
    }
  }

  marginbottom() {
    const scrollheight = this.scrollheight()
    return Math.max(
      this.divheight / this.props.bbwidth + 0.05 * scrollheight,
      0.1 * scrollheight
    )
  }

  reportDrawPos(x, y) {
    const now = Date.now()
    this.lastpostime = now

    if (x && y) {
      if (
        Math.abs(this.lastrdpy - y) < 0.02 &&
        Math.abs(this.lastrdpx - x) < 0.02
      )
        return
    }

    if (x) this.lastrdpx = x
    else x = this.lastrdpx

    if (y) {
      this.lastrdpy = y
    } else y = this.lastrdpy

    if (!y) this.lastrdpy = y = this.state.posy
    if (!x) this.lastrdpx = x = 0

    // ok the idea as as follows, if drawing is close, the toolbox is in an circle around the drawing
    const circlerad = 0.1 // 0.2
    const circleradw = circlerad + (1.1 * this.divwidth) / this.props.bbwidth
    const circleradh = circlerad + (1.1 * this.divheight) / this.props.bbwidth

    // now we try to figure out if the circle and the line are intersecting
    const d = this.tbx - x

    const scrollheight = this.scrollheight()

    const marginbottom = this.marginbottom()

    const bottom = scrollheight - marginbottom

    this.setState((state) => {
      let finaly = 0
      let tbkey = state.tbkey
      if (d * d > circleradw * circleradw) {
        // no intersection
        finaly = Math.max(Math.min(bottom, y), 0.1 * scrollheight)
      } else {
        const finaly1 =
          y +
          (Math.sqrt(circleradw * circleradw - d * d) * circleradh) / circleradw
        const finaly2 =
          y -
          (Math.sqrt(circleradw * circleradw - d * d) * circleradh) / circleradw
        let ofinaly

        if (Math.abs(finaly1 - state.posy) < Math.abs(finaly2 - state.posy)) {
          finaly = finaly1
          ofinaly = finaly2
        } else {
          finaly = finaly2
          ofinaly = finaly1
        }

        if (finaly < 0.1 * scrollheight || finaly > bottom) {
          // in this case take the otherone

          // ok we move outside, jump
          finaly = ofinaly

          // ok we have to fix if still outside
          if (finaly < 0.1 * scrollheight || finaly > bottom) {
            finaly = Math.max(Math.min(bottom, finaly), 0.1 * scrollheight)
          }
        }
      }
      const beamborder = -0.6 * (this.divwidth / this.props.bbwidth) + this.tbx
      if (
        ((finaly < y && state.posy > y) || (finaly > y && state.posy < y)) &&
        x > beamborder
      ) {
        // Beam if you cross writing
        tbkey = 'tb' + (Number(tbkey.substring(2)) + 1)
      }
      return { posy: finaly, tbkey }
    })
  }

  arrangeButtonPressed() {
    this.blackboard().arrangeButtonPressed()
    this.setState({ activated: false })
  }

  pictButtonPressed() {
    this.addRemoveSecondToolGuardian(false)
    if (this.blackboard()) {
      this.blackboard().pictButtonPressed()
      this.setState({ activated: false })
    }
  }

  ipynbButtonPressed() {
    if (this.blackboard()) {
      this.blackboard().ipynbButtonPressed()
    }
  }

  reactivate() {
    console.log('reactivate toolbox')
    this.addRemoveSecondToolGuardian(true)
    this.setState({ activated: true, selectedButtonid: this.lasttool })
  }

  deactivate() {
    console.log('deactivate toolbox')
    this.setState({ activated: false })
  }

  scrollPointerdown(event) {
    // if (this.scrollmodeactiv && this.scrollid !== event.pointerId) return

    if (this.scrollButtonRef.current) {
      this.scrollButtonRef.current.setPointerCapture(event.pointerId)
    }
    this.setState({
      scrollmodeactiv: true
    })
    this.scrollboardSetReference()
    this.scrollmodeactiv = true
    this.scrollid = event.pointerId
    this.lastscrolltime = Date.now() - 50
    this.mousescrollx = event.clientX
    this.mousescrolly = event.clientY
  }

  scrollPointermove(event) {
    // by pass for better smoothness
    const now = Date.now()
    if (
      this.scrollmodeactiv &&
      this.scrollid === event.pointerId &&
      now - this.lastscrolltime > 16
    ) {
      this.scrollboard(0, -event.clientY + this.mousescrolly)
      this.lastscrolltime = now
    }
  }

  scrollPointerup(event) {
    if (this.scrollmodeactiv && this.scrollid === event.pointerId) {
      if (event.clientY) this.scrollboard(0, -event.clientY + this.mousescrolly)
      this.setState({
        scrollmodeactiv: false
      })
      this.scrollmodeactiv = false
    }
  }

  goAway() {
    const scrollheight = this.scrollheight()
    if (this.state.posy < scrollheight * 0.5) {
      this.setState({ posy: 0.8 * scrollheight })
    } else {
      this.setState({ posy: 0.2 * scrollheight })
    }
  }

  identTemplate(element) {
    let icon = <FontAwesomeIcon icon={faUser} />
    if (element.purpose === 'notes') icon = fiStudent({ newSize: '18px' })
    return (
      <span>
        {icon} {element.displayname} ({element.purpose})
      </span>
    )
  }

  render() {
    const ttopts = {
      className: 'teal-tooltip',
      position: 'top',
      showDelay: 1000
    }

    if (!this.state.cantooltip) ttopts.disable = true

    const selbuttonclass = (cond, add) =>
      cond
        ? (add || '') +
          'p-button-primary p-button-raised p-button-rounded tbChild'
        : 'p-button-secondary p-button-raised p-button-rounded tbChild'

    const setclass =
      'p-button-secondary p-button-raised p-button-rounded tbChild'
    let maintools = []

    const endbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faBars} />}
        tooltip='Options'
        tooltipOptions={ttopts}
        key={1}
        onClick={(e) => this.selectTool(1)}
        className={selbuttonclass(this.state.selectedButtonid === 1)}
      />
    )

    const pictbutton = (
      <Button
        icon={fiAddPictIcon}
        tooltip='Add picture'
        tooltipOptions={ttopts}
        key={6}
        onClick={(e) => {
          this.pictButtonPressed()
        }}
        className={selbuttonclass(this.state.selectedButtonid === 6)}
      />
    )

    const ipynbbutton = (
      <Button
        icon={fiJupyterLiteIcon}
        tooltip='Jupyter lite base apps and more'
        tooltipOptions={ttopts}
        key={11}
        onClick={(e) => {
          this.ipynbButtonPressed()
        }}
        className='p-button-secondary p-button-raised p-button-rounded tbChild'
      />
    )

    const addformpictbutton = (
      <Button
        icon={fiFormPictSubMenuIcon}
        tooltip='Add form or picture'
        tooltipOptions={ttopts}
        key={10}
        onClick={(e) => this.selectTool(10)}
        className={selbuttonclass(this.state.selectedButtonid === 10)}
      />
    )

    //   onPointerLeave={this.scrollPointerup}
    const scrollbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faUpdown} />}
        style={{
          touchAction: 'none'
        }}
        key={2}
        ref={this.scrollButtonRef}
        onPointerDown={this.scrollPointerdown}
        onPointerMove={this.scrollPointermove}
        onPointerUp={this.scrollPointerup}
        onClick={(e) => {
          this.selectTool(2)
        }}
        className={selbuttonclass(this.state.scrollmodeactiv, 'p-button-lg')}
      />
    )

    const laserbutton = (
      <Button
        icon={fiLaserpointer}
        tooltip='Laser pointer'
        tooltipOptions={ttopts}
        key={7}
        onClick={(e) => this.selectTool(7)}
        className={selbuttonclass(this.state.selectedButtonid === 7)}
      />
    )

    const magicbutton = (
      <Button
        icon={fiMagicwand}
        tooltip='Select magically'
        tooltipOptions={ttopts}
        key={8}
        onClick={(e) => this.selectTool(8)}
        className={selbuttonclass(this.state.selectedButtonid === 8)}
      />
    )

    const eraserbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faEraser} />}
        tooltip='Erase'
        tooltipOptions={ttopts}
        key={3}
        onClick={(e) => this.selectTool(3)}
        className={selbuttonclass(this.state.selectedButtonid === 3)}
      />
    )

    const markerbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faHighlighter} />}
        tooltip='Use marker'
        tooltipOptions={ttopts}
        key={4}
        onClick={(e) => {
          this.selectTool(4)
        }}
        className={selbuttonclass(this.state.selectedButtonid === 4)}
      />
    )

    const penbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faPen} />}
        tooltip='Use pen, click twice for pen sizes'
        tooltipOptions={ttopts}
        key={5}
        onClick={(e) => {
          this.selectTool(5)
        }}
        className={selbuttonclass(this.state.selectedButtonid === 5)}
      />
    )
    const undobutton = (
      <Button
        icon={<FontAwesomeIcon icon={faUndoAlt} />}
        tooltip='Undo last command'
        tooltipOptions={ttopts}
        key={9}
        onClick={this.undo}
        className={setclass}
      />
    )
    const pollbutton = (
      <Button
        icon={fiPoll}
        tooltip='Start poll'
        tooltipOptions={ttopts}
        key={2}
        onClick={(e) => {
          this.props.startpoll()
        }}
        className={setclass}
      />
    )

    maintools.push(penbutton)
    maintools.push(markerbutton)
    maintools.push(eraserbutton)
    maintools.push(magicbutton)
    if (this.state.canundo) maintools.push(undobutton)
    maintools.push(addformpictbutton)
    maintools.push(laserbutton)
    maintools.push(pollbutton)
    maintools.push(endbutton)
    maintools.push(scrollbutton)

    maintools = maintools.map((ele, it) => (
      <div className='p-mr-2 p-mb-2' id={it} key={it}>
        {ele}
      </div>
    ))

    // maintools.arrangeButtons();

    let cwheelcpos = false
    let bcwheelcpos = false
    let fcwheelcpos = false
    let pswheelcpos = false
    if (this.state.selectedButtonid === 5) {
      if (this.state.secondtoolstep === 1) {
        cwheelcpos = true
      } else if (this.state.secondtoolstep === 2) {
        pswheelcpos = true
      }
    }
    let tmcwheelpcpos = false
    if (this.state.selectedButtonid === 4) {
      if (this.state.secondtoolstep === 1) {
        tmcwheelpcpos = true
      }
    }

    let settingswheel = []
    let settingswheel2 = []
    let settingswheel3 = []

    const fsbutton = (
      <Button
        icon='pi pi-window-maximize'
        tooltip='Toggle fullscreen'
        tooltipOptions={ttopts}
        key={1}
        onClick={(e) => {
          this.props.toggleFullscreen(e)
        }}
        className={setclass}
      />
    )

    const mainstate = this.props.mainstate

    const backbwbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faAdjust} />}
        tooltip='Toggle white background'
        tooltipOptions={ttopts}
        key={2}
        onClick={(e) => {
          this.props.updateSizes({
            blackbackground: !mainstate.blackbackground
          })
        }}
        className={selbuttonclass(mainstate.blackbackground)}
      />
    )

    const casttoscreenbutton = (
      <Button
        icon={mainstate.casttoscreens ? fiEyeOn : fiEyeOff}
        tooltip='Show/hide lecture to screen and students'
        tooltipOptions={ttopts}
        key={3}
        onClick={(e) => {
          this.props.updateSizes({
            casttoscreens: !mainstate.casttoscreens
          })
        }}
        className={selbuttonclass(mainstate.casttoscreens)}
      />
    )

    const arrangebutton = (
      <Button
        icon={fiArrangeScreens}
        tooltip='Arrange notepads and screens'
        tooltipOptions={ttopts}
        key={4}
        onClick={(e) => {
          this.arrangeButtonPressed()
        }}
        className={setclass}
      />
    )

    const idents = this.props.identobj.idents
    const digest = this.props.identobj.masterdigest

    let avstartupbutton
    if (this.props.startUpAVBroadcast)
      avstartupbutton = (
        <Button
          icon={fiBroadcastStart}
          tooltip='Startup audio/video broadcast'
          tooltipOptions={ttopts}
          key={17}
          onClick={(e) => {
            if (this.props.startUpAVBroadcast) this.props.startUpAVBroadcast()
          }}
          className={setclass}
        />
      )

    const identbutton = (
      <div className=' p-overlay-badge'>
        <Button
          icon={<FontAwesomeIcon icon={faUserGroup} />}
          tooltip='Participants'
          tooltipOptions={ttopts}
          key={16}
          onClick={(e) => {
            if (this.identinfo) this.identinfo.toggle(e)
          }}
          className={setclass}
        ></Button>
        <Badge value={idents.length}></Badge>
      </div>
    )

    const infobutton = (
      <Button
        icon={fiFailsLogo}
        tooltip='Info about fails'
        tooltipOptions={ttopts}
        key={5}
        onClick={(e) => {
          if (this.ossinfo) this.ossinfo.toggle(e)
        }}
        className={setclass}
      />
    )

    const touchonbutton = (
      <Button
        icon={this.state.touchOn ? fiTouchOn : fiTouchOff}
        tooltip='Toggle touch'
        tooltipOptions={ttopts}
        key={6}
        onClick={(e) => {
          if (this.state.touchOn && !this.state.touchtool) {
            this.setState({ touchtool: true })
            this.addRemoveTouchToolGuardian(true)
          } else if (this.state.touchOn) {
            this.setState({ touchtool: null })
            this.addRemoveTouchToolGuardian(false)
            this.changeBBConfig('touchOn', false)
          } else {
            this.setState({ touchtool: true })
            this.addRemoveTouchToolGuardian(true)
            this.changeBBConfig('touchOn', true)
          }
        }}
        className={selbuttonclass(this.state.touchOn)}
      />
    )

    const touchpenpreventbutton = (
      <Button
        icon={fiPenBlocksTouch}
        tooltip='Toggle pen prevents pen'
        tooltipOptions={ttopts}
        key={7}
        onClick={(e) => {
          this.changeBBConfig('touchPenPrevent', !this.state.touchPenPrevent)
        }}
        className={selbuttonclass(this.state.touchPenPrevent)}
      />
    )

    const touchcontactareabutton = (
      <Button
        icon={fiPalmAreaDetection}
        tooltip='Toggle palm rejection using contact area'
        tooltipOptions={ttopts}
        key={8}
        onClick={(e) => {
          this.changeBBConfig('touchContactArea', !this.state.touchContactArea)
        }}
        className={selbuttonclass(this.state.touchContactArea)}
      />
    )

    const touchwristbutton = (
      <Button
        icon={fiWristPalmRejection}
        tooltip='Toggle palm rejection using wrist position'
        tooltipOptions={ttopts}
        key={9}
        onClick={(e) => {
          if (this.state.touchWrist && !this.state.wristtool) {
            this.setState({ wristtool: true })
            this.addRemoveWristToolGuardian(true)
          } else if (this.state.touchWrist) {
            this.setState({ wristtool: null })
            this.addRemoveWristToolGuardian(false)
            this.changeBBConfig('touchWrist', false)
          } else {
            this.setState({ wristtool: true })
            this.addRemoveWristToolGuardian(true)
            this.changeBBConfig('touchWrist', true)
          }
        }}
        className={selbuttonclass(this.state.touchWrist)}
      />
    )

    const touchposbrbutton = (
      <Button
        icon={fiWristBottomRight}
        tooltip='Wrist position bottom right'
        tooltipOptions={ttopts}
        key={10}
        onClick={(e) => {
          this.changeBBConfig('touchWristPos', 0)
        }}
        className={selbuttonclass(this.state.touchWristPos === 0)}
      />
    )

    const touchposmrbutton = (
      <Button
        icon={fiWristMiddleRight}
        tooltip='Wrist position middle right'
        tooltipOptions={ttopts}
        key={11}
        onClick={(e) => {
          this.changeBBConfig('touchWristPos', 1)
        }}
        className={selbuttonclass(this.state.touchWristPos === 1)}
      />
    )

    const touchpostrbutton = (
      <Button
        icon={fiWristTopRight}
        tooltip='Wrist position top right'
        tooltipOptions={ttopts}
        key={12}
        onClick={(e) => {
          this.changeBBConfig('touchWristPos', 2)
        }}
        className={selbuttonclass(this.state.touchWristPos === 2)}
      />
    )

    const touchpostlbutton = (
      <Button
        icon={fiWristTopLeft}
        tooltip='Wrist position top left'
        tooltipOptions={ttopts}
        key={13}
        onClick={(e) => {
          this.changeBBConfig('touchWristPos', 3)
        }}
        className={selbuttonclass(this.state.touchWristPos === 3)}
      />
    )

    const touchposmlbutton = (
      <Button
        icon={fiWristMiddleLeft}
        tooltip='Wrist position middle left'
        tooltipOptions={ttopts}
        key={14}
        onClick={(e) => {
          this.changeBBConfig('touchWristPos', 4)
        }}
        className={selbuttonclass(this.state.touchWristPos === 4)}
      />
    )

    const touchposblbutton = (
      <Button
        icon={fiWristBottomLeft}
        tooltip='Wrist position middle left'
        tooltipOptions={ttopts}
        key={15}
        onClick={(e) => {
          this.changeBBConfig('touchWristPos', 5)
        }}
        className={selbuttonclass(this.state.touchWristPos === 5)}
      />
    )

    settingswheel.push(arrangebutton)
    settingswheel.push(fsbutton)
    settingswheel.push(casttoscreenbutton)
    if (!mainstate.bgpdf) settingswheel.push(backbwbutton)
    settingswheel.push(touchonbutton)
    if (this.state.touchtool) {
      // settingswheel2.push(touchonbutton)
      settingswheel2.push(touchpenpreventbutton)
      settingswheel2.push(touchcontactareabutton)
      settingswheel2.push(touchwristbutton)
      if (this.state.wristtool) {
        settingswheel3.push(touchposbrbutton)
        settingswheel3.push(touchposmrbutton)
        settingswheel3.push(touchpostrbutton)
        settingswheel3.push(touchpostlbutton)
        settingswheel3.push(touchposmlbutton)
        settingswheel3.push(touchposblbutton)
      }
    }
    if (idents.length > 0) settingswheel.push(identbutton)
    if (this.props.startUpAVBroadcast) settingswheel.push(avstartupbutton)
    if (this.props.experimental) settingswheel.push(ipynbbutton)
    settingswheel.push(infobutton)

    let setwheelpcpos = false
    if (this.state.selectedButtonid === 1) {
      if (this.state.secondtoolstep === 1) {
        setwheelpcpos = true
      }
    }

    settingswheel = settingswheel.map((ele, it) => (
      <div className='p-mr-2 p-mb-2' id={it} key={it}>
        {ele}
      </div>
    ))

    settingswheel2 = settingswheel2.map((ele, it) => (
      <div className='p-mr-2 p-mb-2' id={it} key={it}>
        {ele}
      </div>
    ))
    settingswheel3 = settingswheel3.map((ele, it) => (
      <div className='p-mr-2 p-mb-2' id={it} key={it}>
        {ele}
      </div>
    ))

    let formpictwheel = []
    const linebutton = (
      <Button
        icon={fiAddLineIcon({
          borderColor: this.state.bordercolor,
          fillColor: this.state.fillcolor
        })}
        tooltip='Add a line, press twice for linewidth'
        tooltipOptions={ttopts}
        key={'F1'}
        onClick={(e) => this.selectForm(1)}
        className={selbuttonclass(this.state.selectedFormid === 1)}
      />
    )
    const rectbutton = (
      <Button
        icon={fiAddRectangleIcon({
          borderColor: this.state.bordercolor,
          fillColor: this.state.fillcolor
        })}
        tooltip='Add a rectangle, press twice for linewidth, press three times for fill color'
        tooltipOptions={ttopts}
        key={'F2'}
        onClick={(e) => this.selectForm(2)}
        className={selbuttonclass(this.state.selectedFormid === 2)}
      />
    )
    const circlebutton = (
      <Button
        icon={fiAddCircleIcon({
          borderColor: this.state.bordercolor,
          fillColor: this.state.fillcolor
        })}
        tooltip='Add a circle, press twice for linewidth, press three times for fill color'
        tooltipOptions={ttopts}
        key={'F3'}
        onClick={(e) => this.selectForm(3)}
        className={selbuttonclass(this.state.selectedFormid === 3)}
      />
    )
    const ellipsebutton = (
      <Button
        icon={fiAddEllipseIcon({
          borderColor: this.state.bordercolor,
          fillColor: this.state.fillcolor
        })}
        tooltip='Add an ellipse, press twice for linewidth, press three times for fill color'
        tooltipOptions={ttopts}
        key={'F4'}
        onClick={(e) => this.selectForm(4)}
        className={selbuttonclass(this.state.selectedFormid === 4)}
      />
    )

    formpictwheel.push(linebutton)
    formpictwheel.push(rectbutton)
    formpictwheel.push(circlebutton)
    formpictwheel.push(ellipsebutton)
    formpictwheel.push(pictbutton)

    let formpictwheelcpos = false
    if (this.state.selectedButtonid === 10) {
      if (this.state.secondtoolstep === 1) {
        formpictwheelcpos = true
      }
      if (this.state.thirdtoolstep === 1) {
        fcwheelcpos = true
      } else if (this.state.thirdtoolstep === 2) {
        bcwheelcpos = true
      } else if (this.state.thirdtoolstep === 3) {
        pswheelcpos = true
      }
    }

    formpictwheel = formpictwheel.map((ele, it) => (
      <div className='p-mr-2 p-mb-2' id={it} key={it}>
        {ele}
      </div>
    ))

    const { colorwheel, pensizewheel, tmcolorwheel, bcolorwheel, fcolorwheel } =
      this.getColorButtons({
        addclass: 'p-mr-2 p-mb-2',
        notransparent: this.state.selectedFormid === 1
      })
    let tbposabove = false
    if (this.state.posy < this.scrollheight() * 0.5) tbposabove = true

    let tbclass = 'toolboxMove'
    if (this.state.scrollmodeactiv) tbclass = 'toolboxStatic'
    const uaparser = new UAParser()
    return (
      <div
        className={tbclass}
        key={this.state.tbkey}
        style={{
          position: 'absolute',
          top: this.state.posy * this.props.bbwidth + 'px',
          left: this.tbx * this.props.bbwidth + 'px',
          width: '15vx',
          zIndex: 200
        }}
        ref={(divref) => {
          this.divref = divref
        }}
      >
        <OverlayPanel
          className='tbChild'
          ref={(el) => {
            this.ossinfo = el
          }}
          showCloseIcon
        >
          <div className='p-grid'>
            <div className='p-col-3'>
              <img
                src={this.props.experimental ? failsLogoExp : failsLogo}
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
          FAILS logo by chadkills <br />
          Custom icons by icon_xpert786 and petedesignworks <br /> <br />
          Released under GNU Affero General Public License Version 3. <br />{' '}
          <br />
          Download the source code from{' '}
          <a href='https://github.com/fails-components'>
            https://github.com/fails-components
          </a>{' '}
          <br /> <br />
          Build upon the shoulders of giants, see{' '}
          <a href='/static/oss'> OSS attribution and licensing.</a>
          <br /> <br />
          Lectureapp version {import.meta.env.REACT_APP_VERSION}{' '}
          {this.props.experimental && <b>(Experimental version)</b>}
          <br /> Browser: {uaparser.getBrowser().name} (Version:{' '}
          {uaparser.getBrowser().version}) with Engine:{' '}
          {uaparser.getEngine().name} (Version: {uaparser.getEngine().version})
          {uaparser.getEngine().name !== 'Blink' && (
            <React.Fragment>
              <br /> <br />
              Fails is developed for browsers with Blink engine like Chrome,
              Chromium, Edge, etc. consider using another browser.
            </React.Fragment>
          )}{' '}
        </OverlayPanel>
        <OverlayPanel
          className='tbChild'
          ref={(el) => {
            this.identinfo = el
          }}
          style={{ maxWidth: '20vw', maxHeight: '50vh' }}
          showCloseIcon
        >
          <h4> Participants:</h4>
          <ListBox
            optionLabel='displayname'
            optionValue='id'
            options={idents}
            style={{ maxHeight: '20vh', overflowY: 'auto' }}
            itemTemplate={this.identTemplate}
          />
          {digest && (
            <React.Fragment>
              <h4> Masterkey:</h4>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontVariantNumeric: 'slashed-zero'
                }}
              >
                {digest}
              </span>
              <br></br>
              <br></br>
              Compare these numbers to verify E2E encryption.
            </React.Fragment>
          )}
        </OverlayPanel>
        {this.state.activated && (
          <Fragment>
            <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
              {maintools}
              <div
                className='p-d-flex p-ai-center p-mr-2 p-mb-2'
                id='poarrow'
                key='poarrow'
              >
                <FontAwesomeIcon
                  icon={tbposabove ? faArrowDownLong : faArrowUpLong}
                  inverse
                  className='poIcon p-ai-center tbChild'
                  size='lg'
                  onClick={() => this.goAway()}
                />
              </div>
            </div>
            {formpictwheelcpos && (
              <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
                {formpictwheel}
              </div>
            )}
            {cwheelcpos && (
              <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
                {colorwheel}
              </div>
            )}
            {bcwheelcpos && (
              <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
                {bcolorwheel}
              </div>
            )}
            {fcwheelcpos && (
              <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
                {fcolorwheel}
              </div>
            )}
            {pswheelcpos && (
              <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
                {pensizewheel}
              </div>
            )}
            {tmcwheelpcpos && (
              <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
                {tmcolorwheel}
              </div>
            )}

            {setwheelpcpos && (
              <React.Fragment>
                <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
                  {settingswheel}
                </div>
                {settingswheel2.length > 0 && (
                  <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
                    {settingswheel2}
                  </div>
                )}
                {settingswheel3.length > 0 && (
                  <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
                    {settingswheel3}
                  </div>
                )}
              </React.Fragment>
            )}
          </Fragment>
        )}
      </div>
    )
  }
}
