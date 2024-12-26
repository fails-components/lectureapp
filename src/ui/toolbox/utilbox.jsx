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
import { faMaximize, faArrowsAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from 'primereact/button'
import React, { Component, Fragment } from 'react'

export class UtilBox extends Component {
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

  deactivate() {
    this.setState({ activated: false })
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
      this.blackboard().addFormPictureMovePos({
        pos,
        corner: this.props.corner
      })
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

    if (this.props.utilbox) {
      const okbutton = (
        <Button
          icon='pi pi-check'
          key={1}
          onClick={(e) => {
            if (Date.now() - this.state.activationTime > 1000)
              this.okButtonPressed()
          }}
          className='p-button-success p-button-raised p-button-rounded tbChild'
        />
      )
      okcancel.push(okbutton)
    }

    const movebutton = (
      <Button
        icon={
          <FontAwesomeIcon
            icon={this.props.utilbox ? faMaximize : faArrowsAlt}
          />
        }
        style={{
          touchAction: 'none'
        }}
        key={3}
        selected={this.state.movemodeactiv}
        onPointerDown={this.movePointerdown}
        onPointerMove={this.movePointermove}
        onPointerUp={this.movePointerup}
        ref={this.moveButtonRef}
        className='p-button-primary p-button-raised p-button-rounded tbChild moveButtonTransparent'
      />
    )
    okcancel.push(movebutton)

    if (this.props.utilbox) {
      const cancelbutton = (
        <Button
          icon='pi pi-times'
          key={2}
          onClick={(e) => {
            if (Date.now() - this.state.activationTime > 1000)
              this.cancelButtonPressed()
          }}
          className='p-button-danger p-button-raised p-button-rounded tbChild'
        />
      )
      okcancel.push(cancelbutton)
    }

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
