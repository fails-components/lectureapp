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
import { Button } from 'primereact/button'
import { OverlayPanel } from 'primereact/overlaypanel'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faEraser,
  faPen,
  faHighlighter,
  faImages,
  faArrowsAlt,
  faArrowsAltV as faUpdown,
  faBars,
  faThList,
  faAdjust,
  faEye,
  faEyeSlash,
  faInfo
} from '@fortawesome/free-solid-svg-icons'
import screenfull from 'screenfull'

class ColorPickerButton2 extends Component {
  constructor(props) {
    super(props)

    this.onClick = this.onClick.bind(this)
  }

  onClick() {
    this.props.toolbox.selectColor(
      this.props.pickerid,
      this.props.color,
      this.props.mysize
    )
  }

  render() {
    const selbuttonclass = (cond, add) =>
      cond
        ? // eslint-disable-next-line no-unneeded-ternary
          (add ? add : '') + 'p-button-primary p-button-raised p-button-rounded'
        : 'p-button-secondary p-button-raised p-button-rounded'

    return (
      <Button
        icon={
          <svg viewBox='-20 -20 40 40' width='100%' height='100%'>
            {this.props.size * 0.5 < 10 && (
              <circle
                cx='0'
                cy='0'
                r={10}
                stroke='#001A00'
                strokeWidth='0'
                fill='#001A00'
              />
            )}
            <circle
              cx='0'
              cy='0'
              r={this.props.size * this.props.sizefac * 0.5}
              stroke='#001A00'
              strokeWidth='0'
              fill={this.props.color}
              fillOpacity={this.props.alpha}
            />
          </svg>
        }
        key={2}
        onClick={this.onClick}
        className={selbuttonclass(this.props.selected)}
      />
    )
  }
}

export class ToolBox extends Component {
  constructor(props) {
    super(props)
    if (this.blackboard()) this.blackboard().current.toolbox = this
    this.stage = props.stage

    this.state = {}

    this.state.posy = 0.1
    this.state.activated = true

    console.log('bbwidth in tb', this.props.bbwidth)
    this.state.scalefac = (1.2 * 0.45 * this.props.bbwidth) / 1000

    this.state.scale = { x: this.state.scalefac, y: this.state.scalefac }

    this.state.pencolor = '#FFFFFF' // "#99FF99";
    this.state.markercolor = '#CCFF33'
    this.state.pensize = 1
    this.state.selectedButtonid = 5
    this.state.secondtoolstep = false
    this.state.selectedPickerid = 1

    this.tbx = 0.8 // constant toolbox pos
    this.lastpostime = Date.now()

    this.secondtoolnum = 0

    this.lastUpdateTime = performance.now()

    // dynamics

    this.lastdrawpos = false
    this.lastdrawposx = 0
    this.lastdrawposy = 0

    this.lastvx = 0
    this.lastvy = 0

    this.colorwheelcolors = [
      '#FFFFFF',
      '#844D18',
      '#BFBFBF',
      '#000000',
      '#FF7373',
      '#FFAC62',
      '#FFF284',
      '#CAFEB8',
      '#99C7FF',
      '#2F74D0',
      '#AE70ED',
      '#FE8BF0',
      '#FFA8A8'
    ]
    this.pensizesizes = [1, 1.5, 2, 3, 4, 6, 8, 11, 16]
    this.tmcolorwheelcolors = [
      '#FF0066',
      '#00FF00',
      '#FFFF00',
      '#FF3300',
      '#6600FF',
      '#FF99',
      '#FF',
      '#FFFF'
    ]

    this.scrollPointerdown = this.scrollPointerdown.bind(this)
    this.scrollPointerup = this.scrollPointerup.bind(this)
    this.scrollPointermove = this.scrollPointermove.bind(this)

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
    // select defaults after mount
    this.selectColor(3, this.tmcolorwheelcolors[2], 20)
    this.selectColor(2, this.colorwheelcolors[0], this.pensizesizes[2])
    this.selectColor(1, this.colorwheelcolors[0], 10)

    if (this.blackboard())
      this.blackboard().setPenTool(
        this.colorwheelcolors[0],
        this.pensizesizes[2]
      )
  }

  addRemoveSecondToolGuardian(newguard) {
    if (this.secondtoolnum) clearTimeout(this.secondtoolnum)
    this.secondtoolnum = null
    if (newguard)
      this.secondtoolnum = setTimeout(
        () => this.setState({ secondtoolstep: 0 }),
        5000
      )
  }

  selectTool(buttonid) {
    switch (buttonid) {
      case 3:
        if (this.blackboard()) this.blackboard().setEraserTool(15) // was 30
        this.addRemoveSecondToolGuardian(false)
        break
      case 4:
        if (this.blackboard())
          this.blackboard().setMarkerTool(this.state.markercolor, 20)
        this.addRemoveSecondToolGuardian(true)
        break
      case 5:
        if (this.blackboard())
          this.blackboard().setPenTool(this.state.pencolor, this.state.pensize)
        this.addRemoveSecondToolGuardian(true)
        break
      case 1:
        this.addRemoveSecondToolGuardian(true)
        break
      default:
        break
    }

    this.setState((state) => {
      let secondtoolstep = 0
      let newbuttonid = state.selectedButtonid
      switch (buttonid) {
        case 3:
          newbuttonid = buttonid
          break
        case 1:
        case 4:
          secondtoolstep = 1
          newbuttonid = buttonid
          break
        case 5:
          newbuttonid = buttonid
          if (buttonid === newbuttonid)
            secondtoolstep = (state.secondtoolstep % 2) + 1
          else secondtoolstep = 1
          break
        default:
          secondtoolstep = 0
          break
      }

      return { selectedButtonid: newbuttonid, secondtoolstep: secondtoolstep }
    })
  }

  selectColor(pickerid, color, size) {
    this.addRemoveSecondToolGuardian(true)
    switch (pickerid) {
      case 1:
        this.setState({ pencolor: color, selectedPickerid: pickerid })
        if (this.blackboard())
          this.blackboard().setPenTool(color, this.state.pensize)
        break
      case 2:
        this.setState({ pensize: size, selectedPickerid: pickerid })
        if (this.blackboard())
          this.blackboard().setPenTool(this.state.pencolor, size)
        break
      case 3:
        this.setState({ markercolor: color, selectedPickerid: pickerid })
        if (this.blackboard()) this.blackboard().setMarkerTool(color, 20)
        break
      default:
        break
    }
  }

  scrollboardSetReference() {
    const scrollref = this.blackboard().getStartScrollboardTB()
    this.scrollboardreference = scrollref
    this.scrolltoolposref = this.state.posy
  }

  scrollboard(scrollx, scrolly) {
    let newposy = this.scrolltoolposref - scrolly / this.props.bbwidth // well we have to check if it will be relocated
    if (
      newposy > 0.9 * this.scrollheight() ||
      newposy < 0.1 * this.scrollheight()
    )
      newposy = 0.5 * this.scrollheight()
    this.setState({ posy: newposy })
    if (this.blackboard()) {
      this.blackboard().scrollboardTB(
        scrollx / this.props.bbwidth,
        scrolly / this.props.bbwidth,
        this.scrollboardreference
      )
    }
  }

  reportDrawPos(x, y) {
    const now = Date.now()
    this.lastpostime = now

    let finaly = 0
    // ok the idea as as follows, if drawing is close, the toolbox is in an circle around the drawing
    const circlerad = 0.2
    // now we try to figure out if the circle and the line are intersecting
    const d = this.tbx - x

    const scrollheight = this.scrollheight()

    this.setState((state) => {
      if (d * d > circlerad * circlerad) {
        // no intersection
        finaly = Math.max(Math.min(0.9 * scrollheight, y), 0.1 * scrollheight)
        // console.log("stupid  finaly",finaly,d,circlerad);
      } else {
        const finaly1 = y + Math.sqrt(circlerad * circlerad - d * d)
        const finaly2 = y - Math.sqrt(circlerad * circlerad - d * d)
        let ofinaly

        if (Math.abs(finaly1 - state.posy) < Math.abs(finaly2 - state.posy)) {
          finaly = finaly1
          ofinaly = finaly2
        } else {
          finaly = finaly2
          ofinaly = finaly1
        }

        // console.log("first finaly",finaly);
        if (finaly < 0.1 * scrollheight || finaly > 0.9 * scrollheight) {
          // in this case take the otherone

          // ok we move outside, jump
          finaly = ofinaly

          //   console.log("second finaly",finaly);
        }
      }
      return { posy: finaly }
    })
  }

  arrangeButtonPressed() {
    this.blackboard().arrangeButtonPressed()
    this.setState({ activated: false })
  }

  pictButtonPressed() {
    this.blackboard().pictButtonPressed()

    this.setState({ activated: false })
  }

  reactivate() {
    console.log('reactivate')
    this.setState({ activated: true })
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

  render() {
    // move to state ?

    const selbuttonclass = (cond, add) =>
      cond
        ? // eslint-disable-next-line no-unneeded-ternary
          (add ? add : '') + 'p-button-primary p-button-raised p-button-rounded'
        : 'p-button-secondary p-button-raised p-button-rounded'

    const setclass = 'p-button-secondary p-button-raised p-button-rounded'
    let maintools = []

    const endbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faBars} />}
        key={1}
        onClick={(e) => this.selectTool(1)}
        className={selbuttonclass(this.state.selectedButtonid === 1)}
      />
    )

    const pictbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faImages} />}
        key={6}
        onClick={(e) => {
          this.pictButtonPressed()
        }}
        className={selbuttonclass(this.state.selectedButtonid === 6)}
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

    const eraserbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faEraser} />}
        key={3}
        onClick={(e) => this.selectTool(3)}
        className={selbuttonclass(this.state.selectedButtonid === 3)}
      />
    )

    const markerbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faHighlighter} />}
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
        key={5}
        onClick={(e) => {
          this.selectTool(5)
        }}
        className={selbuttonclass(this.state.selectedButtonid === 5)}
      />
    )
    const pollbutton = (
      <Button
        icon='pi pi-chart-bar'
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
    maintools.push(scrollbutton)
    maintools.push(endbutton)
    maintools.push(pictbutton)
    maintools.push(pollbutton)

    maintools = maintools.map((ele, it) => (
      <div className='p-mr-2 p-mb-2' id={it} key={it}>
        {ele}
      </div>
    ))

    // maintools.arrangeButtons();

    let cwheelcpos = false
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

    const fsbutton = (
      <Button
        icon='pi pi-window-maximize'
        key={1}
        onClick={(e) => {
          screenfull.toggle()
        }}
        className={setclass}
      />
    )

    const mainstate = this.props.mainstate

    const backbwbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faAdjust} />}
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
        icon={
          <FontAwesomeIcon
            icon={mainstate.casttoscreens ? faEye : faEyeSlash}
          />
        }
        key={2}
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
        icon={<FontAwesomeIcon icon={faThList} />}
        key={3}
        onClick={(e) => {
          this.arrangeButtonPressed()
        }}
        className={setclass}
      />
    )

    const infobutton = (
      <Button
        icon={<FontAwesomeIcon icon={faInfo} />}
        key={4}
        onClick={(e) => {
          if (this.ossinfo) this.ossinfo.toggle(e)
        }}
        className={setclass}
      />
    )

    settingswheel.push(arrangebutton)
    settingswheel.push(fsbutton)
    settingswheel.push(casttoscreenbutton)
    if (!mainstate.bgpdf) settingswheel.push(backbwbutton)
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

    const colorwheel = []
    // this.addChild(this.colorwheel);

    let it = 0
    for (it = 0; it < this.colorwheelcolors.length; it++) {
      const newcolorbutton = (
        <div className='p-mr-2 p-mb-2' id={it} key={it}>
          <ColorPickerButton2
            toolbox={this}
            color={this.colorwheelcolors[it]}
            pickerid={1}
            size={20}
            sizefac={1}
            alpha={1}
            key={it}
            selected={this.state.pencolor === this.colorwheelcolors[it]}
          />
        </div>
      )
      colorwheel.push(newcolorbutton)
    }

    // this.colorwheel.arrangeButtons();

    const pensizewheel = []

    for (it = 0; it < this.pensizesizes.length; it++) {
      const newcolorbutton = (
        <div className='p-mr-2 p-mb-2' id={it} key={it}>
          <ColorPickerButton2
            toolbox={this}
            color={'#ffffff'}
            pickerid={2}
            selected={this.state.pensize === this.pensizesizes[it]}
            size={this.pensizesizes[it] * 0.001 * this.props.bbwidth}
            mysize={this.pensizesizes[it]}
            sizefac={1 / this.state.scalefac}
            alpha={1}
            key={it}
          />
        </div>
      )

      pensizewheel.push(newcolorbutton)
    }

    // this.pensizewheel.arrangeButtons();

    const tmcolorwheel = []

    for (it = 0; it < this.tmcolorwheelcolors.length; it++) {
      const newcolorbutton = (
        <div className='p-mr-2 p-mb-2' id={it} key={it}>
          <ColorPickerButton2
            toolbox={this}
            color={this.tmcolorwheelcolors[it]}
            pickerid={3}
            size={20}
            sizefac={1}
            scalefac={1}
            alpha={0.5}
            key={it}
            selected={this.state.markercolor === this.tmcolorwheelcolors[it]}
          />
        </div>
      )
      tmcolorwheel.push(newcolorbutton)
    }

    // this.tmcolorwheel.arrangeButtons();
    //  this.tmcolorwheel.filters = [this.BloomFilter];
    let tbclass = 'toolboxMove'
    if (this.state.scrollmodeactiv) tbclass = 'toolboxStatic'

    return (
      <div
        className={tbclass}
        style={{
          position: 'absolute',
          top: this.state.posy * this.props.bbwidth + 'px',
          left: this.tbx * this.props.bbwidth + 'px',
          width: '15vx',
          zIndex: 200,
          touchAction: 'none'
        }}
      >
        <OverlayPanel
          ref={(el) => {
            this.ossinfo = el
          }}
          showCloseIcon
        >
          <h4>
            Fancy automated internet lecture system (<b>FAILS </b>) - components{' '}
          </h4>
          <p>
            Copyright (C) 2015-2017 (original FAILS), <br />
            2021- (FAILS Components) Marten Richter <br /> <br />
            Released under GNU Affero General Public License Version 3<br />{' '}
            <br />
            Build upon the shoulders of giants, see{' '}
            <a href='/static/oss'> OSS attribution and licensing.</a>
          </p>
        </OverlayPanel>
        {this.state.activated && (
          <Fragment>
            <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
              {maintools}
            </div>
            {cwheelcpos && (
              <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
                {colorwheel}
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
              <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
                {settingswheel}
              </div>
            )}
          </Fragment>
        )}
      </div>
    )
  }
}

export class ConfirmBox extends Component {
  constructor(props) {
    super(props)

    this.state = { activated: false }

    this.moveButtonRef = React.createRef()

    this.state.posx = 0
    this.state.posy = 0
    this.okButtonPressed = this.okButtonPressed.bind(this)
    this.cancelButtonPressed = this.cancelButtonPressed.bind(this)
    this.movePointerdown = this.movePointerdown.bind(this)
    this.movePointermove = this.movePointermove.bind(this)
    this.movePointerup = this.movePointerup.bind(this)
  }

  blackboard() {
    if (this.props.notepad && this.props.notepad.blackboard)
      return this.props.notepad.blackboard.current
  }

  reactivate(position) {
    this.setState({
      posx: position.x,
      posy: position.y,
      activated: true,
      activationTime: Date.now()
    })
  }

  setPosition(position) {
    this.setState({
      posx: position.x,
      posy: position.y
    })
  }

  okButtonPressed() {
    this.blackboard().okButtonPressed()
    this.setState({ activated: false })
  }

  cancelButtonPressed() {
    this.blackboard().cancelButtonPressed()
    this.setState({ activated: false })
  }

  movePointerdown(event) {
    // if (this.scrollmodeactiv && this.scrollid !== event.pointerId) return

    if (this.moveButtonRef.current) {
      this.moveButtonRef.current.setPointerCapture(event.pointerId)
    }
    this.setState({
      movemodeactiv: true
    })
    this.movemodeactiv = true
    this.moveid = event.pointerId
    this.lastmovetime = Date.now() - 50
  }

  movePointermove(event) {
    // by pass for better smoothness
    const now = Date.now()
    if (
      this.movemodeactiv &&
      this.moveid === event.pointerId &&
      now - this.lastmovetime > 25
    ) {
      const pos = { x: event.clientX, y: event.clientY }
      this.blackboard().addPictureMovePos(pos)
      this.lastmovetime = now
    }
  }

  movePointerup(event) {
    if (this.movemodeactiv && this.moveid === event.pointerId) {
      // if (event.clientY) this.scrollboard(0, -event.clientY + this.mousescrolly)
      this.setState({
        movemodeactiv: false
      })
      this.movemodeactiv = false
    }
  }

  render() {
    let okcancel = []

    const okbutton = (
      <Button
        icon='pi pi-check'
        key={1}
        onClick={(e) => {
          if (Date.now() - this.state.activationTime > 1000)
            this.okButtonPressed()
        }}
        className='p-button-success p-button-raised p-button-rounded'
      />
    )

    okcancel.push(okbutton)

    const movebutton = (
      <Button
        icon={<FontAwesomeIcon icon={faArrowsAlt} />}
        style={{
          touchAction: 'none'
        }}
        key={3}
        selected={this.state.movemodeactiv}
        onPointerDown={this.movePointerdown}
        onPointerMove={this.movePointermove}
        onPointerUp={this.movePointerup}
        ref={this.moveButtonRef}
        className='p-button-primary p-button-raised p-button-rounded'
      />
    )
    okcancel.push(movebutton)

    const cancelbutton = (
      <Button
        icon='pi pi-times'
        key={2}
        onClick={(e) => {
          if (Date.now() - this.state.activationTime > 1000)
            this.cancelButtonPressed()
        }}
        className='p-button-danger p-button-raised p-button-rounded'
      />
    )
    okcancel.push(cancelbutton)

    okcancel = okcancel.map((ele, it) => (
      <div className='p-mr-2 p-mb-2' id={it} key={it}>
        {ele}
      </div>
    ))

    return (
      <div
        className='toolboxStatic'
        style={{
          position: 'absolute',
          top: this.state.posy * this.props.bbwidth + 'px',
          left: this.state.posx * this.props.bbwidth + 'px',
          zIndex: 200
        }}
      >
        {this.state.activated && (
          <Fragment>
            <div className='p-d-flex p-flex-wrap p-jc-center fadeMenu'>
              {okcancel}
            </div>
          </Fragment>
        )}
      </div>
    )
  }
}
