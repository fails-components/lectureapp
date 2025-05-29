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
import { ColorPickerButton } from './colorpickerbutton'

export class ToolHandling extends Component {
  constructor(props) {
    super(props)
    this.svgscale = 2000 // should be kept constant

    this.lasttool = 5

    this.colorwheelcolors = [
      '#FFFFFFFF',
      // '#844D18FF',
      '#BFBFBFFF',
      '#000000FF',
      '#FF7373FF',
      '#FFAC62FF',
      '#FFF284FF',
      '#CAFEB8FF',
      '#99C7FFFF',
      // '#2F74D0FF',
      '#AE70EDFF',
      '#FE8BF0FF',
      '#FFA8A8FF'
    ]
    this.pensizesizes = [0.25, 0.375, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 11, 16]
    this.tmcolorwheelcolors = [
      '#FF0066',
      '#00FF00',
      '#FFFF00',
      '#FF3300',
      '#6600FF',
      '#FF9900',
      '#FF0000'
    ]

    this.changeBBConfig = this.changeBBConfig.bind(this)
    this.undo = this.undo.bind(this)
  }

  setStateDefaults(state) {
    state.activated = true

    console.log('bbwidth in tb', this.props.bbwidth)
    state.pencolor = '#FFFFFF' // "#99FF99";
    state.markercolor = '#CCFF33'
    state.pensize = 1
    state.selectedButtonid = 5
    state.secondtoolstep = false
    state.selectedPickerid = 1
    state.canundo = false
    state.cantooltip = true
    state.bordercolor = '#FFFFFFFF'
    state.fillcolor = '#00000000'
  }

  setBBConfig(prop, val) {
    const forstate = {}
    forstate[prop] = val
    this.setState(forstate)
  }

  changeBBConfig(prop, val) {
    const blackboard = this.blackboard()
    if (blackboard) {
      blackboard.saveConfig(prop, val)
    }
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
    this.setDefaults()

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

  addRemoveSecondToolGuardian(newguard, oldbuttonid) {
    if (this.secondtoolnum) clearTimeout(this.secondtoolnum)
    this.secondtoolnum = null
    if (newguard)
      this.secondtoolnum = setTimeout(() => {
        if (oldbuttonid) this.selectTool(oldbuttonid)
        this.setState({ secondtoolstep: 0 })
      }, 8000)
  }

  addRemoveThirdToolGuardian(newguard) {
    if (this.thirdtoolnum) clearTimeout(this.thirdtoolnum)
    this.thirdtoolnum = null
    if (newguard)
      this.thirdtoolnum = setTimeout(() => {
        this.setState({ thirdtoolstep: 0 })
      }, 5000)
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

  selectTool(buttonid) {
    if (buttonid !== 7) {
      if (this.blackboard()) this.blackboard().deactivateLaserPointer()
    }
    switch (buttonid) {
      case 3:
        if (this.blackboard())
          this.blackboard().setEraserTool(12 * 0.001 * this.svgscale) // was 30
        this.addRemoveSecondToolGuardian(false)
        this.lasttool = 3
        break
      case 4:
        if (this.blackboard())
          this.blackboard().setMarkerTool(
            this.state.markercolor,
            12 * 0.001 * this.svgscale
          )
        this.addRemoveSecondToolGuardian(true)
        this.lasttool = 4
        break
      case 5:
        if (this.blackboard())
          this.blackboard().setPenTool(this.state.pencolor, this.state.pensize)
        this.addRemoveSecondToolGuardian(true)
        this.lasttool = 5
        break
      case 1:
        if (this.blackboard()) this.blackboard().setMenuMode()
        this.addRemoveSecondToolGuardian(true, this.lasttool)
        break
      case 7:
        if (this.blackboard()) this.blackboard().activateLaserPointer()
        this.addRemoveSecondToolGuardian(true)
        this.lasttool = 7
        break
      case 8:
        if (this.blackboard()) this.blackboard().setMagicTool()
        this.addRemoveSecondToolGuardian(false)
        this.lasttool = 8
        break
      case 10: // addformpict menu
        if (this.blackboard()) this.blackboard().setMenuMode()
        this.setState({ selectedFormid: undefined })
        this.addRemoveSecondToolGuardian(false, this.lasttool)
        break
      case 11: // startActivityMenu menu
        if (this.blackboard()) this.blackboard().setMenuMode()
        this.addRemoveSecondToolGuardian(true, this.lasttool)
        break
      default:
        break
    }

    this.setState((state) => {
      let secondtoolstep = 0
      let newbuttonid = state.selectedButtonid
      switch (buttonid) {
        case 8:
        case 7:
        case 3:
          newbuttonid = buttonid
          break
        case 1:
        case 4:
        case 10:
        case 11:
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

      return { selectedButtonid: newbuttonid, secondtoolstep }
    })
  }

  selectForm(formid) {
    if (this.blackboard()) this.blackboard().deactivateLaserPointer()

    if (this.blackboard())
      this.blackboard().setFormTool({
        type: formid,
        bColor: this.state.bordercolor,
        lw: this.state.pensize,
        fColor: this.state.fillcolor,
        lastdrawx: this.lastrdpx,
        lastdrawy: this.lastrdpy
      })
    // this.addRemoveSecondToolGuardian(false, this.lasttool)
    // this.lasttool = 10
    this.addRemoveThirdToolGuardian(true)

    this.setState((state) => {
      let secondtoolstep = 1
      let thirdtoolstep = 1
      const oldthirdtoolstep = state.thirdtoolstep || 0
      let newbuttonid = state.selectedButtonid
      let newformid = state.selectedFormid
      switch (formid) {
        case 1: // line
          newbuttonid = 10
          newformid = formid
          if (formid === newformid) thirdtoolstep = (oldthirdtoolstep % 2) + 1
          break
        case 2:
        case 3:
        case 4:
          newbuttonid = 10
          newformid = formid
          if (formid === newformid) thirdtoolstep = (oldthirdtoolstep % 3) + 1
          break
        default:
          secondtoolstep = 1
          thirdtoolstep = 0
          break
      }

      return {
        selectedButtonid: newbuttonid,
        secondtoolstep,
        thirdtoolstep,
        selectedFormid: newformid
      }
    })
  }

  setDefaults() {
    const bbwidth = this.state.bbwidth || this.props.bbwidth
    let penselect = 1
    for (penselect = 1; penselect < this.pensizesizes.length; penselect++) {
      if (
        this.pensizesizes[penselect] *
          0.001 *
          bbwidth *
          (this.state.devicePixelRatio || this.props.devicePixelRatio) >=
        1.5
      )
        break
    }

    this.selectColor(3, this.tmcolorwheelcolors[2], 20)
    this.selectColor(
      2,
      this.colorwheelcolors[0],
      this.pensizesizes[penselect] * 0.001 * bbwidth
    )
    this.selectColor(1, this.colorwheelcolors[0], 10)
    if (this.blackboard())
      this.blackboard().setPenTool(
        this.colorwheelcolors[0],
        this.pensizesizes[penselect] * 0.001 * bbwidth
      )
    if (this.blackboard())
      this.blackboard().updateToolProps({
        fillcolor: '#00000000',
        bordercolor: '#ffffffff',
        lw: this.pensizesizes[penselect] * 0.001 * bbwidth
      })
  }

  selectColor(pickerid, color, size, formmode) {
    this.addRemoveSecondToolGuardian(this.state.selectedButtonid !== 10)
    switch (pickerid) {
      case 1:
        this.setState({ pencolor: color, selectedPickerid: pickerid })
        if (this.blackboard()) this.blackboard().updateToolProps({ color })
        break
      case 2:
        this.setState({ pensize: size, selectedPickerid: pickerid })

        if (this.blackboard()) {
          if (this.state.selectedButtonid === 10)
            this.blackboard().updateToolProps({ lw: size })
          else this.blackboard().updateToolProps({ size })
        }
        break
      case 3:
        this.setState({ markercolor: color, selectedPickerid: pickerid })
        if (this.blackboard())
          this.blackboard().setMarkerTool(color, 12 * 0.001 * this.svgscale)
        break
      case 4:
        this.setState({ fillcolor: color, selectedPickerid: pickerid })
        if (this.blackboard())
          this.blackboard().updateToolProps({ fillcolor: color })
        break
      case 5:
        this.setState({ bordercolor: color, selectedPickerid: pickerid })
        if (this.blackboard())
          this.blackboard().updateToolProps({ bordercolor: color })
        break
      default:
        break
    }
  }

  undo() {
    if (this.blackboard()) this.blackboard().undo()
  }

  setCanUndo(canundo) {
    if (this.state.canundo !== !!canundo) this.setState({ canundo: !!canundo })
  }

  setCanTooltip(cantooltip) {
    if (this.state.cantooltip !== cantooltip)
      this.setState({ cantooltip: !!cantooltip })
  }

  getColorButtons({ addclass, notransparent }) {
    const colorwheel = []
    const bcolorwheel = []
    const fcolorwheel = []

    if (!notransparent) {
      bcolorwheel.push(
        <ColorPickerButton
          toolbox={this}
          color={'#00000000'}
          addclass={addclass}
          pickerid={5}
          size={20}
          sizefac={1}
          alpha={0}
          key={'trans_bcol'}
          selected={this.state.bordercolor === '#00000000'}
        />
      )
      fcolorwheel.push(
        <ColorPickerButton
          toolbox={this}
          color={'#00000000'}
          strokecolor={this.state.bordercolor}
          addclass={addclass}
          pickerid={4}
          sizefac={1}
          alpha={0}
          key={'trans_fcol'}
          selected={this.state.fillcolor === '#00000000'}
        />
      )
    }
    // this.addChild(this.colorwheel);
    let it = 0
    for (it = 0; it < this.colorwheelcolors.length; it++) {
      const newcolorbutton = (
        <ColorPickerButton
          toolbox={this}
          color={this.colorwheelcolors[it]}
          addclass={addclass}
          pickerid={1}
          size={20}
          sizefac={1}
          alpha={1}
          key={it + '_col'}
          selected={this.state.pencolor === this.colorwheelcolors[it]}
        />
      )
      colorwheel.push(newcolorbutton)
      const newfcolorbutton = (
        <ColorPickerButton
          toolbox={this}
          color={this.colorwheelcolors[it]}
          strokecolor={this.state.pencolor}
          addclass={addclass}
          pickerid={4}
          sizefac={1}
          alpha={1}
          key={it + '_fcol'}
          selected={this.state.fillcolor === this.colorwheelcolors[it]}
        />
      )
      fcolorwheel.push(newfcolorbutton)
      const newbcolorbutton = (
        <ColorPickerButton
          toolbox={this}
          color={this.colorwheelcolors[it]}
          addclass={addclass}
          pickerid={5}
          size={20}
          sizefac={1}
          alpha={1}
          key={it + '_bcol'}
          selected={this.state.bordercolor === this.colorwheelcolors[it]}
        />
      )
      bcolorwheel.push(newbcolorbutton)
    }

    // this.colorwheel.arrangeButtons();
    const pensizewheel = []

    const bbwidth = this.state.bbwidth || this.props.bbwidth

    for (it = 0; it < this.pensizesizes.length; it++) {
      const newcolorbutton = (
        <ColorPickerButton
          toolbox={this}
          color={'#ffffff'}
          addclass={addclass}
          pickerid={2}
          selected={
            this.state.pensize === this.pensizesizes[it] * 0.001 * bbwidth
          }
          size={this.pensizesizes[it] * 0.001 * bbwidth}
          mysize={this.pensizesizes[it] * 0.001 * bbwidth}
          sizefac={/* this.props.devicePixelRatio */ 1.0}
          alpha={1}
          key={it + '_pensize'}
        />
      )

      if (
        this.pensizesizes[it] *
          0.001 *
          (this.state.devicePixelRatio || this.props.devicePixelRatio) *
          bbwidth <
        0.5
      )
        continue

      pensizewheel.push(newcolorbutton)
    }

    // this.pensizewheel.arrangeButtons();
    const tmcolorwheel = []

    for (it = 0; it < this.tmcolorwheelcolors.length; it++) {
      const newcolorbutton = (
        <ColorPickerButton
          toolbox={this}
          color={this.tmcolorwheelcolors[it]}
          addclass={addclass}
          pickerid={3}
          size={20}
          sizefac={1}
          scalefac={1}
          alpha={0.5}
          key={it + '_tm_col'}
          selected={this.state.markercolor === this.tmcolorwheelcolors[it]}
        />
      )
      tmcolorwheel.push(newcolorbutton)
      const newfcolorbutton = (
        <ColorPickerButton
          toolbox={this}
          color={this.tmcolorwheelcolors[it] + '4c'}
          strokecolor={this.state.pencolor}
          addclass={addclass}
          pickerid={4}
          sizefac={1}
          alpha={1.0}
          key={it + '_tmfcol'}
          selected={this.state.fillcolor === this.tmcolorwheelcolors[it]}
        />
      )
      fcolorwheel.push(newfcolorbutton)
      const newbcolorbutton = (
        <ColorPickerButton
          toolbox={this}
          color={this.tmcolorwheelcolors[it] + '4c'}
          addclass={addclass}
          pickerid={5}
          sizefac={1}
          size={20}
          alpha={1.0}
          key={it + '_tmbcol'}
          selected={this.state.bordercolor === this.tmcolorwheelcolors[it]}
        />
      )
      bcolorwheel.push(newbcolorbutton)
    }
    return { colorwheel, pensizewheel, tmcolorwheel, bcolorwheel, fcolorwheel }
  }
}
