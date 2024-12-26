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
import Color from 'color'

export class SVGWriting2 extends Component {
  render() {
    /* { color:  this.state.workcolor, alpha: , objnum: this.state.workobjnum ,
                 path: path ,
                 startradius: this.state.workstartradius, endpoint: {x: wx-sx, y: wy-sy },
                endradius: this.curpenwidth   } */
    // <svg viewBox="-20 -20 40 40" width="100%" height="100%">
    // console.log(this.props.glyph);
    const glyph = this.props.glyph
    const viewbox =
      Math.round(glyph.area.left) +
      ' ' +
      Math.round(glyph.area.top) +
      ' ' +
      Math.round(glyph.area.right - glyph.area.left) +
      ' ' +
      Math.round(glyph.area.bottom - glyph.area.top) +
      ' '

    let stroke = 'none'
    let classname = ''

    let scolor = glyph.color
    let alpha = 1
    if (glyph.gtype === 1) alpha = 0.3
    else if (glyph.gtype === 2) {
      // console.log("Eraser",this.props.backcolor);
      scolor = this.props.backcolor
      alpha = 0.95
    }
    if (glyph.gtype === 0) {
      //  console.log('color check', glyph.color, this.props.backcolor)
      if (Color(this.props.backcolor).isLight()) {
        if (Color(glyph.color).luminosity() > 0.9) {
          stroke = 'black'
          // console.log("stroke changed to black");
        } else if (Color(glyph.color).luminosity() > 0.5) {
          scolor = Color(glyph.color).darken(0.3).hex()
        }
      }
      /* else if (
        Color(this.props.backcolor).isDark() &&
        Color(glyph.color).luminosity() < 0.2
      ) {
        stroke = 'white'
      } */
    }

    let firstpoint = null
    if (glyph.pathpoints && glyph.pathpoints.length > 0)
      firstpoint = glyph.pathpoints[0]

    const pathstring = glyph.SVGPath()
    const sx = firstpoint ? firstpoint.x : 0
    const sy = firstpoint ? firstpoint.y : 0

    let ox = 0
    let oy = 0
    if (glyph.preshift) {
      ox = glyph.preshift.x
      oy = glyph.preshift.y
    }
    const style = {
      position: 'absolute',
      zIndex: this.props.zIndex,
      left:
        Math.round(
          ((glyph.area.left + sx) * this.props.pixelwidth) / glyph.svgscale +
            ox * this.props.pixelwidth
        ) + 'px',
      width:
        Math.round(
          ((glyph.area.right - glyph.area.left) * this.props.pixelwidth) /
            glyph.svgscale
        ) + 'px',
      top:
        Math.round(
          ((glyph.area.top + sy) * this.props.pixelwidth) / glyph.svgscale +
            oy * this.props.pixelwidth
        ) + 'px',
      height:
        Math.round(
          ((glyph.area.bottom - glyph.area.top) * this.props.pixelwidth) /
            glyph.svgscale
        ) + 'px',
      pointerEvents: 'none' // deactive this option , if you like to pick an svg element by cursor for debugging
    }

    if (this.props.preview) stroke = 'purple'
    if (this.props.predraw) stroke = 'cyan'
    if (glyph.isSelected()) {
      stroke = null
      classname += 'selectedPath'
    }

    return (
      <svg viewBox={viewbox} style={style}>
        {pathstring && (
          <path
            className={classname}
            d={pathstring}
            stroke={stroke}
            fill={scolor}
            fillOpacity={alpha}
          ></path>
        )}
      </svg>
    )
  }
}

export class SVGSpotlight extends Component {
  constructor(args) {
    super(args)
    this.state = { fogpos: false }
    this.fogCheck = this.fogCheck.bind(this)
    this.lastfogtime = Date.now()
    window.setInterval(this.fogCheck, 1000)
  }

  fogCheck() {
    if (this.state.fogpos && Date.now() - this.lastfogtime > 5 * 1000)
      this.setState({ fogpos: false })
  }

  setFogpos(fogpos) {
    this.lastfogtime = Date.now()
    this.setState({ fogpos })
  }

  render() {
    if (!this.state.fogpos) return <React.Fragment></React.Fragment>
    const x = this.state.fogpos.x * this.props.bbwidth
    const y = this.state.fogpos.y * this.props.bbwidth
    const viewbox = '0 0 20 20'
    const style = {
      position: 'absolute',
      zIndex: this.props.zIndex,
      left: x,
      width: '1.2vw',
      top: y,
      height: '1.2vw',
      cursor: 'none',
      pointerEvents: 'none'
    }

    return (
      <svg viewBox={viewbox} style={style} className='spotlight'>
        <defs>
          <radialGradient id='laserGradient'>
            <stop offset='10%' stopColor='gold' />
            <stop offset='95%' stopColor='red' />
          </radialGradient>
        </defs>
        <circle cx='10' cy='10' r='10' fill="url('#laserGradient')" />
      </svg>
    )

    /* return  <svg viewBox={viewbox}  style={style} >
            <defs>
            <radialGradient id="grad1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" style="stop-color:rgb(255,0,0);
                stop-opacity:1" />
                <stop offset="100%" style="stop-color:rgb(255,255,255);stop-opacity:0" />
            </radialGradient>
            </defs>
            <ellipse cx="25" cy="25" rx="25" ry="25" fill="url(#grad1)" />
        </svg> */
  }
}

export class FormHelper extends Component {
  Aspect() {
    if (this.props.type === 3) return 1
    else return undefined
  }

  render() {
    const width = Math.abs(this.props.width)
    const height = Math.abs(this.props.height)
    const style = {
      position: 'absolute',
      zIndex: this.props.zIndex,
      left: Math.round(this.props.x - 10) + 'px',
      top: Math.round(this.props.y - 10) + 'px',
      /* width: Math.round(width) + 'px',
      height: Math.round(height) + 'px', */
      userSelect: 'none',
      pointerEvents: 'none'
    }
    const viewbox =
      '0 0 ' + Math.round(width + 20) + ' ' + Math.round(height + 20) + ' '

    if (this.props.width) style.width = width + 20 + 'px'
    if (this.props.height) style.height = height + 20 + 'px'
    let classname = ''
    if (this.props.selected) classname += 'selectedForm'
    let form
    let helplines
    const stroke = Color(this.props.bColor).hex()
    const strokeAlpha = ((this.props.bColor & 0xff000000) >>> 24) / 255
    const strokeWidth = this.props.lw

    const alpha = ((this.props.fColor & 0xff000000) >>> 24) / 255
    const scolor = alpha > 0 ? Color(this.props.fColor).hex() : undefined

    if (this.props.width < 0)
      style.left = Math.round(this.props.x - 10 - width) + 'px'
    if (this.props.height < 0)
      style.top = Math.round(this.props.y - 10 - height) + 'px'
    // eslint-disable-next-line default-case
    switch (this.props.type) {
      case 1: // line
        {
          // Fix me!
          const x1 = this.props.width > 0 ? 10 : width + 10
          const y1 = this.props.height > 0 ? 10 : height + 10
          const x2 = this.props.width < 0 ? 10 : width + 10
          const y2 = this.props.height < 0 ? 10 : height + 10
          form = (
            <line
              x1={x1.toFixed(2)}
              y1={y1.toFixed(2)}
              x2={x2.toFixed(2)}
              y2={y2.toFixed(2)}
              stroke={stroke}
              strokeOpacity={strokeAlpha}
              strokeWidth={strokeWidth.toFixed(2)}
              fill={scolor}
              fillOpacity={scolor && alpha}
            />
          )
        }
        break
      case 2: // rectangle
        form = (
          <rect
            x={10}
            y={10}
            width={width.toFixed(2)}
            height={height.toFixed(2)}
            stroke={stroke}
            strokeOpacity={strokeAlpha}
            strokeWidth={strokeWidth.toFixed(2)}
            fill={scolor}
            fillOpacity={alpha}
          />
        )
        if (this.props.helplines) {
          helplines = (
            <React.Fragment>
              <line
                x1='10'
                y1='10'
                x2={(width + 10).toFixed(2)}
                y2={(height + 10).toFixed(2)}
                stroke='#fff'
                strokeDasharray='1,2'
              />
              <line
                x1='10'
                y2='10'
                x2={(width + 10).toFixed(2)}
                y1={(height + 10).toFixed(2)}
                stroke='#fff'
                strokeDasharray='1,2'
              />
            </React.Fragment>
          )
        }

        break
      case 3: // circle
        form = (
          <circle
            cx={(width * 0.5 + 10).toFixed(2)}
            cy={(height * 0.5 + 10).toFixed(2)}
            r={(width * 0.5).toFixed(2)}
            stroke={stroke}
            strokeOpacity={strokeAlpha}
            strokeWidth={strokeWidth}
            fill={scolor}
            fillOpacity={alpha}
          />
        )
        if (this.props.helplines)
          helplines = (
            <React.Fragment>
              <rect
                x='10'
                y='10'
                width={width.toFixed(2)}
                height={height.toFixed(2)}
                stroke='#fff'
                strokeDasharray='1,2'
                fill='none'
              />
              <line
                x1='10'
                y1={(height * 0.5 + 10).toFixed(2)}
                x2={(width + 10).toFixed(2)}
                y2={(height * 0.5 + 10).toFixed(2)}
                stroke='#fff'
                strokeDasharray='1,2'
              />
              <line
                x1={(width * 0.5 + 10).toFixed(2)}
                y1='10'
                x2={(width * 0.5 + 10).toFixed(2)}
                y2={(height + 10).toFixed(2)}
                stroke='#fff'
                strokeDasharray='1,2'
              />
            </React.Fragment>
          )

        break
      case 4:
        // ellipse
        form = (
          <ellipse
            cx={(width * 0.5 + 10).toFixed(2)}
            cy={(height * 0.5 + 10).toFixed(2)}
            rx={(width * 0.5).toFixed(2)}
            ry={(height * 0.5).toFixed(2)}
            stroke={stroke}
            strokeOpacity={strokeAlpha}
            strokeWidth={strokeWidth}
            fill={scolor}
            fillOpacity={alpha}
          />
        )
        if (this.props.helplines)
          helplines = (
            <React.Fragment>
              <rect
                x='10'
                y='10'
                width={width.toFixed(2)}
                height={height.toFixed(2)}
                stroke='#fff'
                strokeDasharray='1,2'
                fill='none'
              />
              <line
                x1='10'
                y1={(height * 0.5 + 10).toFixed(2)}
                x2={(width + 10).toFixed(2)}
                y2={(height * 0.5 + 10).toFixed(2)}
                stroke='#fff'
                strokeDasharray='1,2'
              />
              <line
                x1={(width * 0.5 + 10).toFixed(2)}
                y1='10'
                x2={(width * 0.5 + 10).toFixed(2)}
                y2={(height + 10).toFixed(2)}
                stroke='#fff'
                strokeDasharray='1,2'
              />
            </React.Fragment>
          )

        break
    }
    return (
      <svg viewBox={viewbox} style={style} className={classname}>
        {form}
        {helplines}
      </svg>
    )
  }
}
