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
import { Blackboard, BlackboardNotepad } from './blackboard.js'
import { ToolBox, ConfirmBox } from './toolbox.js'

export class NoteScreenBase extends Component {
  constructor(props) {
    super(props)
    console.log('myprops', props)

    // this.animate=this.animate.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this)

    this.state = {}
    this.state.bbwidth = window.innerWidth
    this.state.bbheight = window.innerHeight
    this.state.devicePixelRatio = window.devicePixelRatio || 1.0

    this.blackboard = React.createRef()
    this.toolbox = React.createRef()
    this.confirmbox = React.createRef()

    this.running = false

    this.backgroundbw = true
  }

  componentDidMount() {
    console.log('Component mount notepad')
    const myself = this
    this.resizeeventlistener = function (event) {
      const iwidth = window.innerWidth
      const iheight = window.innerHeight

      console.log('resize event!' + event + iwidth + ' ' + iheight)

      myself.props.updateSizes({ scrollheight: iheight / iwidth })
      console.log('resize' /*, myself.bgtrick */, iheight / iwidth)

      console.log('device pixel ratio', window.devicePixelRatio)
      myself.setState({
        bbwidth: iwidth,
        bbheight: iheight,
        devicePixelRatio: window.devicePixelRatio || 1
      })
    }

    window.addEventListener('resize', this.resizeeventlistener)
    window.addEventListener('keydown', this.onKeyDown, false)

    console.log('Create new NoteScreenBase', this.width, this.height)

    if (
      this.state.bbwidth !== window.innerWidth ||
      this.state.bbheight !== window.innerHeight
    ) {
      const iwidth = window.innerWidth
      const iheight = window.innerHeight
      console.log('resize mount' /*, myself.bgtrick */, iheight / iwidth)
      this.props.updateSizes({ scrollheight: iheight / iwidth })
      this.setState({
        bbwidth: window.innerWidth,
        bbheight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1
      })
    }

    this.initNotepad()
    this.running = true
    // requestAnimationFrame(this.animate);
  }

  initNotepad() {
    if (this.props.isnotepad) {
      // this.confirmbox = new ConfirmBox(this.stage,this.blackboard); // TODO
      this.isscreen = false
      // this.isalsoscreen = this.props.isalsoscreen;
      this.casttoscreens = false
      this.scrolloffset = 0

      // keyboard handling
      const mythis = this
      document.addEventListener('keydown', function (key) {
        mythis.onKeyDown(key)
      })
    } else {
      this.isscreen = true
      this.scrolloffset = 0
    }
    if (this.props.noteref) this.props.noteref(this)
  }

  /*
    animate(timestamp)
    {
       // if (this.blackboard) this.blackboard.current.updateGraphics(timestamp); //obsolete?
        if (this.toolbox) this.toolbox.updateGraphics(timestamp);
        if (this.confirmbox) this.confirmbox.updateGraphics(timestamp);

        // render the stage
        //this.renderer.render(this.stage);

        if (this.running) requestAnimationFrame(this.animate);
        return this.running;
    }; */

  setScrollOffset(scrolloffset) {
    this.scrolloffset = scrolloffset
    console.log(this.blackboard.current)
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.setScrollOffset(scrolloffset)
    if (this.backgroundbw) this.setBackgroundColor(this.backcolornormal)
    else this.setBackgroundColor(this.backcolorwhite)
  }

  setBackgroundColor(bgcolor) {
    this.setState({ backgroundColor: bgcolor })
  }

  componentWillUnmount() {
    console.log('shutdown notepad')
    // this.blackboard.current.shutdown();
    this.running = false
    //  this.stage.destroy();
    window.removeEventListener('resize', this.resizeeventlistener)
    window.removeEventListener('keydown', this.onKeyDown, false)
    this.resizeeventlistener = null
    // this.renderer.view.remove();
    // this.renderer.destroy(true);
  }

  calcCurpos() {
    if (!this.props.isnotepad && this.blackboard && this.blackboard.current)
      return (
        (this.blackboard.current.calcCurpos() / this.state.bbheight) *
        this.state.bbwidth
      )
    return 0
  }

  setHasControl(hascntrl) {
    console.log('sethascontrol', hascntrl)
    console.log('tbc', this.blackboard.current)
    if (this.props.isnotepad && this.blackboard && this.blackboard.current)
      this.blackboard.current.setblocked(!hascntrl)
  }

  reactivateToolBox() {
    console.log('reactivate Toolbox NSB', this.blackboard)
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.reactivateToolBox()
  }

  arrangeButtonPressed() {
    this.props.arrangebuttoncallback()
  }

  pictButtonPressed() {
    this.props.pictbuttoncallback()
  }

  receiveData(data) {
    // console.log("notepad receive Data",this.blackbaord,data);
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.receiveData(data)
  }

  receivePictInfo(data) {
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.receivePictInfo(data)
  }

  receiveBgpdfInfo(data) {
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.receiveBgpdfInfo(data)
  }

  replaceData(data) {
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.replaceData(data)
  }

  netSend(command, data) {
    this.props.netsend(command, data)
  }

  reportFoG(x, y) {
    this.props.netsend('FoG', { x: x, y: y })
  }

  receiveFoG(data) {
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.receiveFoG(data)
  }

  enterAddPictureMode(uuid, url) {
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.enterAddPictureMode(uuid, url)
  }

  onKeyDown(key) {
    if (!this.blackboard.current) return
    switch (key.keyCode) {
      case 0x28: // arrowdown
        if (this.blackboard.current.scrollboardKeys)
          this.blackboard.current.scrollboardKeys(0, 0.05)
        break
      case 0x26: // arrowUp
        if (this.blackboard.current.scrollboardKeys)
          this.blackboard.current.scrollboardKeys(0, -0.05)
        break
      /* case 0x44: { // "d"
              this.blackboard.current.toggleDebugView();
           }break; */
      default:
        break
    }
  }

  getBlackboard() {
    if (this.blackboard) return this.blackboard.current
  }

  render() {
    // console.log("pageoffset",this.props.pageoffset*this.state.bbheight/this.state.bbwidth, this.props.pageoffset,this.state.bbheight,this.state.bbwidth )
    // console.log("screennumbercolor", this.props.screennumbercolor);
    // console.log("tsw",this.state.width,this.state.height,this.blackboard);
    return (
      <div
        style={{
          width: this.props.width,
          height: this.props.height,
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {this.props.showscreennumber && (
          <span
            style={{
              position: 'absolute',
              top: '2vw',
              left: '4vw',
              fontSize: '10vw',
              textShadow: '2px 2px 8px ' + this.props.screennumbercolor,
              color: this.props.screennumbercolor
            }}
            zIndex={50}
          >
            {' '}
            {this.props.screennumber + 1}{' '}
          </span>
        )}
        {!this.props.isnotepad ? (
          <Blackboard
            ref={this.blackboard}
            backcolor={this.props.backgroundcolor}
            notepadscreen={this}
            bbwidth={this.state.bbwidth}
            bbheight={this.state.bbheight}
            pageoffset={
              (this.props.pageoffset * this.state.bbheight) / this.state.bbwidth
            }
            pageoffsetabsolute={this.props.pageoffsetabsolute}
          ></Blackboard>
        ) : (
          <BlackboardNotepad
            ref={this.blackboard}
            backcolor={this.props.backgroundcolor}
            notepadscreen={this}
            bbwidth={this.state.bbwidth}
            bbheight={this.state.bbheight}
            devicePixelRatio={this.state.devicePixelRatio}
          ></BlackboardNotepad>
        )}
        {this.props.isnotepad && (
          <ToolBox
            ref={this.toolbox}
            bbwidth={this.state.bbwidth}
            bbheight={this.state.bbheight}
            notepad={this}
            startpoll={this.props.startpoll}
            dispres={this.dispres}
          />
        )}
        {this.props.isnotepad && (
          <ConfirmBox
            ref={this.confirmbox}
            bbwidth={this.state.bbwidth}
            bbheight={this.state.bbheight}
            notepad={this}
          />
        )}
      </div>
    )
  }
}
