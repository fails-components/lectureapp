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
import React, { Component, Fragment } from 'react'

export class CopyDeleteBox extends Component {
  constructor(props) {
    super(props)

    this.state = { activated: false }

    this.moveButtonRef = React.createRef()

    this.state.posx = 0
    this.state.posy = 0

    this.deleteButtonPressed = this.deleteButtonPressed.bind(this)
  }

  blackboard() {
    if (this.props.notepad && this.props.notepad.getEditBlackboard)
      return this.props.notepad.getEditBlackboard()
  }

  reactivate(position) {
    this.setState({
      posx: position.x,
      posy: position.y,
      activated: true,
      activationTime: Date.now()
    })
  }

  deactivate() {
    this.setState({
      activated: false,
      activationTime: null
    })
  }

  setPosition(position) {
    this.setState({
      posx: position.x,
      posy: position.y
    })
  }

  deleteButtonPressed() {
    this.blackboard().deleteMagicButtonPressed()
    this.setState({ activated: false })
  }

  copyButtonPressed() {
    this.blackboard().copyMagicButtonPressed()
  }

  render() {
    let buttons = []

    const ttopts = {
      className: 'teal-tooltip',
      position: 'top',
      showDelay: 1000
    }

    const copybutton = (
      <Button
        icon='pi pi-copy'
        key={1}
        tooltip='Copy selected objects'
        tooltipOptions={ttopts}
        onClick={(e) => {
          if (Date.now() - this.state.activationTime > 500)
            this.copyButtonPressed()
        }}
        className='p-button-raised p-button-rounded tbChild'
      />
    )

    buttons.push(copybutton)

    const deletebutton = (
      <Button
        icon='pi pi-trash'
        key={1}
        tooltip='Delete selected objects'
        tooltipOptions={ttopts}
        onClick={(e) => {
          if (Date.now() - this.state.activationTime > 500)
            this.deleteButtonPressed()
        }}
        className='p-button-danger p-button-raised p-button-rounded tbChild'
      />
    )

    buttons.push(deletebutton)

    buttons = buttons.map((ele, it) => (
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
              {buttons}
            </div>
          </Fragment>
        )}
      </div>
    )
  }
}
