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

export class ImageHelper extends Component {
  constructor(props) {
    super(props)
    this.imageLoaded = this.imageLoaded.bind(this)
    this.state = { height: 100, width: 100 }
  }

  imageLoaded(img) {
    this.setState({
      height: img.target.naturalHeight,
      width: img.target.naturalWidth
    })
  }

  Aspect() {
    return this.state.width / this.state.height
  }

  render() {
    let x = this.props.x
    let y = this.props.y
    let width
    let height
    let transform
    if (this.props.width) {
      width = Math.abs(this.props.width)
      if (this.props.width < 0) {
        transform = 'rotateY(180deg)'
        x -= width
      }
    }
    if (this.props.height) {
      height = Math.abs(this.props.height)
      if (this.props.height < 0) {
        transform = transform
          ? transform + ' rotateX(180deg)'
          : 'rotateX(180deg)'
        y -= height
      }
    }
    const style = {
      position: 'absolute',
      zIndex: this.props.zIndex,
      left: x + 'px',
      top: y + 'px',
      userSelect: 'none',
      pointerEvents: 'none',
      transform,
      backgroundImage: 'url(' + this.props.urlthumb + ')',
      backgroundSize: 'contain'
    }

    if (width) style.width = Math.abs(width) + 'px'
    if (height) style.height = Math.abs(height) + 'px'
    let classname = ''
    if (this.props.selected) classname += 'selectedImage'

    return (
      <img
        className={classname}
        src={this.props.url}
        alt={this.props.uuid}
        style={style}
        onLoad={this.imageLoaded}
      ></img>
    )
  }
}
