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

export class FloatingVideo extends Component {
  constructor(args) {
    super(args)
    this.lastdrpx = 0
    this.lastdrpy = 0
    this.state = { videoposx: 0, videoposy: 0 }
  }

  reportDrawPos(x, y) {
    // y should be already corrected by scrollheight!
    if (x > 0.4 && x < 0.6) return // do nothing we are far away from the corner
    if (y > 0.3 && y < 0.4) return // the same as for x

    // figure out if we are near
    if (y < 0.3 && this.state.videoposy === 0) {
      if (x < 0.3 && this.state.videoposx === 1)
        this.setState({ videoposx: 0, videoposy: 1 })
      else if (x > 0.7 && this.state.videoposx === 0)
        this.setState({ videoposx: 0, videoposy: 1 })
    }

    if (y > 0.4 && this.state.videoposy === 1) {
      // videoposy 0 is the default
      this.setState({ videoposx: 0, videoposy: 0 })
    }
  }

  render() {
    const style = {}
    if (this.state.videoposx) style.left = '0vw'
    else style.right = '0vw'

    if (this.state.videoposy) style.bottom = '0vh'
    else style.top = '0vh'

    style.zIndex = 199
    style.position = 'absolute'
    style.overflow = 'hidden'
    return (
      <div className='p-shadow-5 m-0 buttonbarparent' style={style}>
        {this.props.children}
      </div>
    )
  }
}
