/*
    Fails Components (Fancy Automated Internet Lecture System - Components)
    Copyright (C)  2022- (FAILS Components)  Marten Richter <marten.richter@freenet.de>

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

export class DbMeter extends Component {
  constructor(args) {
    super(args)
    this.state = {}
    this.dbUpdate = this.dbUpdate.bind(this)
  }

  componentDidMount() {
    if (this.props.microphone) this.props.microphone.registerDB(this.dbUpdate)
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.props.microphone !== prevProps.microphone) {
      if (prevProps.microphone) prevProps.microphone.unregisterDB(this.dbUpdate)
      if (this.props.microphone) this.props.microphone.registerDB(this.dbUpdate)
    }
  }

  componentWillUnmount() {
    if (this.props.microphone) this.props.microphone.unregisterDB(this.dbUpdate)
  }

  dbUpdate(db) {
    if (this.state.db !== db) this.setState({ db })
  }

  render() {
    let height = Math.max(Math.min(((this.state.db - -70) / 40) * 100, 100), 0)
    height = height + '%'
    return (
      <div
        style={{
          width: '4px',
          height: '100%',
          background: 'black',
          display: 'inline-block',
          position: 'relative'
        }}
      >
        <div
          style={{
            width: '100%',
            height,
            background: 'green',
            position: 'absolute',
            left: 0,
            bottom: 0
          }}
        ></div>
      </div>
    )
  }
}
