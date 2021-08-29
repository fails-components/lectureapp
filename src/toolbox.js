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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faEraser,
  faPen,
  faHighlighter,
  faImages,
  faArrowsAltV as faUpdown,
  faBars,
  faThList
} from '@fortawesome/free-solid-svg-icons'
import screenfull from 'screenfull'

class CircleElement extends Component {
  render() {
    const offset = 0
    const dangle = (2 * Math.PI * this.props.cpos) / this.props.clength
    const radius = this.props.radius * this.props.cpos
    const x = -Math.cos(offset + dangle * this.props.id) * radius + radius
    const y = Math.sin(offset + dangle * this.props.id) * radius + radius

    return (
      <div style={{ position: 'absolute', top: x, left: y }}>
        {this.props.children}
      </div>
    )
  }
}

class CircleWrap extends Component {
  render() {
    const radius = this.props.radius * this.props.cpos + 20
    return (
      <span
        style={{
          left: -radius + 'px',
          top: -radius + 'px',
          width: 2 * radius + 'px',
          height: 2 * radius + 'px',
          borderRadius: radius + 'px',
          backgroundColor: '#3d3d3d',
          borderColor: '#001A00',
          borderWidth: '1.5px',
          display: 'inline-block',
          position: 'absolute' /*, opacity: "0.8" */
        }}
      >
        {this.props.children}
      </span>
    )
  }
}

class FilledButton extends Component {
  constructor(props) {
    super(props)
    this.pointerdown = this.pointerdown.bind(this)
    this.pointerup = this.pointerup.bind(this)
    this.pointermove = this.pointermove.bind(this)
  }

  pointerdown(pointer) {
    if (this.props.buttonid) this.props.toolbox.selectTool(this.props.buttonid)
    if (this.props.pointerdown) this.props.pointerdown(pointer)
  }

  pointermove(pointer) {
    if (this.props.pointermove) this.props.pointermove(pointer)
  }

  pointerup(pointer) {
    if (this.props.pointerup) this.props.pointerup(pointer)
  }

  render() {
    const radius = this.props.radius ? this.props.radius : 20
    let background = '#001A00'
    let bordercolor = '#3d3d3d'
    if (!this.props.selected) {
      bordercolor = '#001A00'
      background = '#3d3d3d'
    }
    return (
      <span
        style={{
          width: 2 * radius + 'px',
          height: 2 * radius + 'px',
          borderRadius: radius + 'px',
          backgroundColor: background,
          borderColor: bordercolor,
          borderWidth: '1.5px',
          display: 'inline-block',
          overscrollBehavior: 'none',
          touchAction: 'none'
        }}
        onPointerDown={this.pointerdown}
        onPointerMove={this.pointermove}
        onPointerUp={this.pointerup}
        onPointerLeave={this.pointerup}
      >
        {this.props.children}
      </span>
    )
  }
}

class ColorPickerButton extends Component {
  constructor(props) {
    super(props)

    this.pointerdown = this.pointerdown.bind(this)
  }

  pointerdown(pointer) {
    console.log('pointer down', pointer)
    this.props.toolbox.selectColor(
      this.props.pickerid,
      this.props.color,
      this.props.mysize
    )
  }

  render() {
    return (
      <FilledButton
        toolbox={this.props.toolbox}
        selected={this.props.selected}
        buttonid={this.props.buttonid}
        pointerdown={this.pointerdown}
      >
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
      </FilledButton>
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

    console.log('bbwidth in tb', this.props.bbwidth)
    this.state.scalefac = (1.2 * 0.45 * this.props.bbwidth) / 1000

    this.state.scale = { x: this.state.scalefac, y: this.state.scalefac }

    this.state.pencolor = '#FFFFFF' // "#99FF99";
    this.state.markercolor = '#CCFF33'
    this.state.pensize = 1
    this.state.selectedButtonid = 5
    this.state.secondtoolstep = false
    this.state.selectedPickerid = 1

    this.tbx = 0.87 // constant toolbox pos
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
        3000
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
    const elapsed = Math.min(now - this.lastpostime, 100)
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

      const timefac = Math.min(elapsed / 1000, 1.0)
      // console.log("reportDrawPos", timefac, this.state.posy,finaly);

      let desty = state.posy * (1 - timefac) + timefac * finaly
      if (Math.abs(desty - y) < Math.abs(finaly - y)) {
        // in this case jump
        desty = finaly
      }

      return { posy: desty }
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
    this.setState({
      mousescrollx: event.clientX,
      mousescrolly: event.clientY,
      scrollmodeactiv: true
    })
    this.scrollboardSetReference()
  }

  scrollPointermove(event) {
    // by pass for better smoothness
    if (this.state.scrollmodeactiv) {
      this.scrollboard(0, -event.clientY + this.state.mousescrolly)
    }
  }

  scrollPointerup(event) {
    if (this.state.scrollmodeactiv) {
      this.scrollboard(0, -event.clientY + this.state.mousescrolly)
      this.setState({
        scrollmodeactiv: false
      })
    }
  }

  render() {
    // move to state ?

    const selbuttonclass = (cond, add) =>
      cond
        ? // eslint-disable-next-line no-unneeded-ternary
          (add ? add : '') +
          'p-button-primary p-button-raised p-button-rounded p-m-2'
        : 'p-button-secondary p-button-raised p-button-rounded p-m-2'

    let maintools = []

    const endbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faBars} />}
        key={1}
        onClick={(e) => this.selectTool(1)}
        className={selbuttonclass(this.state.selectedButtonid === 1)}
      />
    )
    maintools.push(endbutton)

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
    maintools.push(pictbutton)

    const scrollbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faUpdown} />}
        key={2}
        onPointerDown={this.scrollPointerdown}
        onPointerLeave={this.scrollPointerup}
        onPointerMove={this.scrollPointermove}
        onPointerUp={this.scrollPointerup}
        onClick={(e) => {
          this.selectTool(2)
        }}
        className={selbuttonclass(this.state.scrollmodeactiv, 'p-button-lg ')}
      />
    )
    maintools.push(scrollbutton)

    const eraserbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faEraser} />}
        key={3}
        onClick={(e) => this.selectTool(3)}
        className={selbuttonclass(this.state.selectedButtonid === 3)}
      />
    )
    maintools.push(eraserbutton)

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
    maintools.push(markerbutton)

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
    maintools.push(penbutton)

    maintools = maintools.map((ele, it) => (
      <CircleElement
        radius={45}
        id={it}
        key={it}
        cpos={1}
        clength={maintools.length}
      >
        {' '}
        {ele}
      </CircleElement>
    ))

    // maintools.arrangeButtons();

    let cwheelcpos = 0
    let pswheelcpos = 0
    if (this.state.selectedButtonid === 5) {
      if (this.state.secondtoolstep === 1) {
        cwheelcpos = 1
      } else if (this.state.secondtoolstep === 2) {
        pswheelcpos = 1
      }
    }
    let tmcwheelpcpos = 0
    if (this.state.selectedButtonid === 4) {
      if (this.state.secondtoolstep === 1) {
        tmcwheelpcpos = 1
      }
    }

    let settingswheel = []
    const setclass = 'p-button-secondary p-button-raised p-button-rounded p-m-2'

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
    settingswheel.push(fsbutton)

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
    settingswheel.push(pollbutton)

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
    settingswheel.push(arrangebutton)

    let setwheelpcpos = 0
    if (this.state.selectedButtonid === 1) {
      if (this.state.secondtoolstep === 1) {
        setwheelpcpos = 1
      }
    }

    settingswheel = settingswheel.map((ele, it) => (
      <CircleElement
        radius={88}
        id={it}
        key={it}
        cpos={setwheelpcpos}
        clength={settingswheel.length}
      >
        {' '}
        {ele}
      </CircleElement>
    ))

    const colorwheel = []
    // this.addChild(this.colorwheel);

    let it = 0
    for (it = 0; it < this.colorwheelcolors.length; it++) {
      const newcolorbutton = (
        <CircleElement
          radius={85}
          id={it}
          key={it}
          cpos={cwheelcpos}
          clength={this.colorwheelcolors.length}
        >
          <ColorPickerButton
            toolbox={this}
            color={this.colorwheelcolors[it]}
            pickerid={1}
            size={20}
            sizefac={1}
            alpha={1}
            key={it}
            selected={this.state.pencolor === this.colorwheelcolors[it]}
          />
        </CircleElement>
      )
      colorwheel.push(newcolorbutton)
    }

    // this.colorwheel.arrangeButtons();

    const pensizewheel = []

    for (it = 0; it < this.pensizesizes.length; it++) {
      const newcolorbutton = (
        <CircleElement
          radius={85 + 16 * 0.001 * this.props.bbwidth}
          cpos={pswheelcpos}
          id={it}
          key={it}
          clength={this.pensizesizes.length}
        >
          <ColorPickerButton
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
        </CircleElement>
      )

      pensizewheel.push(newcolorbutton)
    }

    // this.pensizewheel.arrangeButtons();

    const tmcolorwheel = []

    for (it = 0; it < this.tmcolorwheelcolors.length; it++) {
      const newcolorbutton = (
        <CircleElement
          radius={88}
          cpos={tmcwheelpcpos}
          id={it}
          key={it}
          clength={this.tmcolorwheelcolors.length}
        >
          <ColorPickerButton
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
        </CircleElement>
      )
      tmcolorwheel.push(newcolorbutton)
    }

    // this.tmcolorwheel.arrangeButtons();
    //  this.tmcolorwheel.filters = [this.BloomFilter];

    return (
      <div
        style={{
          position: 'absolute',
          top: this.state.posy * this.props.bbwidth + 'px',
          left: this.tbx * this.props.bbwidth + 'px',
          zIndex: 200
        }}
      >
        {this.state.activated && (
          <Fragment>
            <CircleWrap radius={85} cpos={cwheelcpos}>
              {colorwheel}
            </CircleWrap>
            <CircleWrap
              radius={85 + 16 * 0.001 * this.props.bbwidth}
              cpos={pswheelcpos}
            >
              {pensizewheel}
            </CircleWrap>
            <CircleWrap radius={88} cpos={tmcwheelpcpos}>
              {tmcolorwheel}
            </CircleWrap>
            <CircleWrap radius={92} cpos={setwheelpcpos}>
              {settingswheel}
            </CircleWrap>
            <CircleWrap radius={45} cpos={1}>
              {maintools}
            </CircleWrap>
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

    this.state.posx = 0
    this.state.posy = 0
    this.okButtonPressed = this.okButtonPressed.bind(this)
    this.cancelButtonPressed = this.cancelButtonPressed.bind(this)
  }

  blackboard() {
    if (this.props.notepad && this.props.notepad.blackboard)
      return this.props.notepad.blackboard.current
  }

  reactivate(position) {
    this.setState({ posx: position.x, posy: position.y, activated: true })
  }

  okButtonPressed() {
    this.blackboard().okButtonPressed()
    this.setState({ activated: false })
  }

  cancelButtonPressed() {
    this.blackboard().cancelButtonPressed()
    this.setState({ activated: false })
  }

  render() {
    let okcancel = []

    const okbutton = (
      <Button
        icon='pi pi-check'
        key={1}
        onClick={(e) => this.okButtonPressed()}
        className='p-button-success p-button-raised p-button-rounded p-m-2'
      />
    )

    okcancel.push(okbutton)

    const cancelbutton = (
      <Button
        icon='pi pi-times'
        key={2}
        onClick={(e) => this.cancelButtonPressed()}
        className='p-button-danger p-button-raised p-button-rounded p-m-2'
      />
    )
    okcancel.push(cancelbutton)

    okcancel = okcancel.map((ele, it) => (
      <CircleElement
        radius={20}
        id={it}
        key={it}
        cpos={1}
        clength={okcancel.length}
      >
        {' '}
        {ele}
      </CircleElement>
    ))

    return (
      <div
        style={{
          position: 'absolute',
          top: this.state.posy * this.props.bbwidth + 'px',
          left: this.state.posx * this.props.bbwidth + 'px',
          zIndex: 200
        }}
      >
        {this.state.activated && (
          <Fragment>
            <CircleWrap radius={20} cpos={1}>
              {okcancel}
            </CircleWrap>
          </Fragment>
        )}
      </div>
    )
  }
}
