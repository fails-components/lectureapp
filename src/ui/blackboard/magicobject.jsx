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

import React from 'react'

export class MagicObject {
  constructor(args) {
    this.points = []
    this.pathdirty = true
    this.svgscale = 2000 // should be kept constant
    this.isvgscale = 1 / this.svgscale
    this.mw = 5
    this.changemagic = args.changemagic
    this.datatarget = args.datatarget

    this.bbwidth = 2000

    this.ref = React.createRef()
    this.svgref = React.createRef()

    this.selectedObj = []

    this.inputhandling = false
    this.lastinputhandling = false

    this.pointerdown = this.pointerdown.bind(this)
    this.pointerup = this.pointerup.bind(this)
    this.pointermove = this.pointermove.bind(this)
  }

  activateMove() {
    this.moveison = true
  }

  activateInputHandling() {
    this.inputhandling = true
  }

  testAndSelectDrawObject(obj) {
    const obarea = obj.getArea()
    if (!this.rectInterSectiontest(obarea)) {
      return false
    }
    if (obj.doPointTest(this)) {
      obj.select()
      this.selectedObj.push(obj)
      return true
    } else {
      return false
    }
  }

  getObjIds() {
    return this.selectedObj.map((el) => ({
      objid: el.objid,
      storagenum: el.storagenum()
    }))
  }

  copyObjsAndSelect() {
    const oldSelectedObjs = this.selectedObj
    const shift = { x: 0.01, y: 0.01 }
    this.selectedObj = oldSelectedObjs.map((el) => {
      return el.copyAndDeselect(this.datatarget, shift)
    })

    this.spx += ((this.preshift?.x ?? 0) + shift.x) * this.svgscale
    this.spy += ((this.preshift?.y ?? 0) + shift.y) * this.svgscale
    this.preshift = null
    this.pathdirty = true

    this.changemagic()
    return this.selectedObj
  }

  cleanup() {
    this.selectedObj.forEach((el) => el.deselect())

    this.selectedObj = []
  }

  rectInterSectiontest(area) {
    const myarea = {
      left: (this.area.left + this.spx) * this.isvgscale,
      right: (this.area.right + this.spx) * this.isvgscale,
      top: (this.area.top + this.spy) * this.isvgscale,
      bottom: (this.area.bottom + this.spy) * this.isvgscale
    }
    if (myarea.left === myarea.right || myarea.top === myarea.bottom)
      return false

    if (area.left >= myarea.right || myarea.left >= area.right) return false

    if (area.top >= myarea.bottom || myarea.top >= area.bottom) return false
    return true
  }

  pointTest(point) {
    const px = point.x - this.spx
    const py = point.y - this.spy
    if (this.ref.current && this.svgref.current) {
      const sp = this.svgref.current.createSVGPoint() // it say it is deprecated, but chrome does not support the alternative
      sp.x = px
      sp.y = py
      return this.ref.current.isPointInFill(sp)
    } else return false
  }

  addPoint(x, y) {
    this.pathdirty = true

    // the following lines rescale at the borders
    const margin = 0.02
    const marginscale = 2.5
    let wx = x
    if (wx > 1 - margin)
      wx = marginscale * wx + (1 - marginscale) * (1 - margin)
    else if (wx < margin) wx = marginscale * wx + (1 - marginscale) * margin

    const px = wx * this.svgscale
    const py = y * this.svgscale
    this.points.push({ x: px, y: py })
    if (!this.area) {
      this.area = {
        left: -this.mw,
        right: +this.mw,
        top: -this.mw,
        bottom: -this.mw
      }
      this.spx = px
      this.spy = py
    } else {
      const ws = this.area
      this.area = {
        left: Math.min(px - this.spx - 2 * this.mw, ws.left),
        right: Math.max(px - this.spx + 2 * this.mw, ws.right),
        top: Math.min(py - this.spy - 2 * this.mw, ws.top),
        bottom: Math.max(py - this.spy + 2 * this.mw, ws.bottom)
      }
    }
  }

  buildPath() {
    const strings = []
    if (this.points.length < 1) this.svgpath = null

    let firstpoint = null
    if (this.points && this.points.length > 0) firstpoint = this.points[0]

    const sx = firstpoint ? firstpoint.x : 0
    const sy = firstpoint ? firstpoint.y : 0

    strings.push(
      'M' +
        (this.points[0].x - sx).toFixed(2) +
        ',' +
        (this.points[0].y - sy).toFixed(2) +
        ' '
    )
    for (let i = 1; i < this.points.length; i++) {
      const cp = this.points[i]
      strings.push(
        'L' + (cp.x - sx).toFixed(2) + ',' + (cp.y - sy).toFixed(2) + ' '
      )
    }
    strings.push('Z')
    this.svgpath = strings.join('')

    this.pathdirty = false
  }

  findCopyDeleteBoxPos() {
    // first identify, the area of the right edge
    if (this.points.length === 0) return null
    let left = this.points[0].x
    let right = this.points[0].x
    for (const pidx in this.points) {
      const point = this.points[pidx]
      left = Math.min(left, point.x)
      right = Math.max(right, point.x)
    }
    // ok we like to place the box with in 20 % of the left side
    left += (right - left) * 0.8
    let selpoint = null
    let top = 100000000
    let bottom = -10000000
    for (const pidx in this.points) {
      const point = this.points[pidx]
      if (point.x >= left && point.x <= right) {
        top = Math.min(top, point.y)
        bottom = Math.max(bottom, point.y)
      }
    }

    top += (bottom - top) * 0.8
    let selweight = -1
    for (const pidx in this.points) {
      const point = this.points[pidx]
      if (
        point.x >= left &&
        point.x <= right &&
        point.y >= top &&
        point.y <= bottom
      ) {
        const weight =
          (point.x - left) / (right - left) + (point.y - top) / (bottom - top)
        if (!selpoint) selpoint = point
        else if (weight > selweight) {
          selpoint = point
          selweight = weight
        }
      }
    }
    if (!selpoint) {
      console.log('no point for delete box?')
      return null
    }
    let ox = 0
    let oy = 0
    if (this.preshift && this.preshift.x && this.preshift.y) {
      ox = this.preshift.x
      oy = this.preshift.y
    }
    return {
      x: ox + selpoint.x * this.isvgscale,
      y: oy + selpoint.y * this.isvgscale
    }
  }

  pointerdown(event) {
    if (!this.moveison) return
    if (event && event.target && event.target.id !== 'theMagicPath') return // only if the path is hit, we will proceed, says joda
    if (this.svgref.current) {
      this.svgref.current.setPointerCapture(event.pointerId)
    }
    this.movemodeactiv = true
    this.moveid = event.pointerId
    this.movestartx = event.clientX
    this.movestarty = event.clientY
    this.lastmovetime = Date.now()
    event.stopPropagation()
  }

  pointermove(event) {
    if (!this.moveison) return
    // by pass for better smoothness
    const now = Date.now()
    if (
      this.movemodeactiv &&
      this.moveid === event.pointerId &&
      now - this.lastmovetime > 16
    ) {
      this.updatePreShift(
        (event.clientX - this.movestartx) / this.bbwidth,
        (event.clientY - this.movestarty) / this.bbwidth
      )
      this.lastmovetime = now
    }
    event.stopPropagation()
  }

  pointerup(event) {
    if (!this.moveison) return
    if (this.movemodeactiv && this.moveid === event.pointerId) {
      if (event.clientY)
        this.updatePreShift(
          (event.clientX - this.movestartx) / this.bbwidth,
          (event.clientY - this.movestarty) / this.bbwidth,
          true
        )
      this.movemodeactiv = false
      this.commitPreShift(this.datatarget)
    }
    event.stopPropagation()
  }

  updatePreShift(x, y, nochange) {
    this.pathdirty = true
    this.preshift = { x, y }
    this.selectedObj.forEach((el) => el.setPreshift(this.preshift))
    if (!nochange) this.changemagic()
  }

  commitPreShift() {
    this.points.forEach((el) => {
      el.x += this.preshift.x * this.svgscale
      el.y += this.preshift.y * this.svgscale
    })
    this.spx += this.preshift.x * this.svgscale
    this.spy += this.preshift.y * this.svgscale

    this.pathdirty = true
    this.selectedObj.forEach((el) => el.commitPreshift(this.datatarget))
    this.preshift = null
    this.changemagic()
  }

  getRenderObject(args) {
    if (
      this.pathdirty ||
      !this.jsxobj ||
      this.lastinputhandling !== this.inputhandling
    ) {
      if (this.pathdirty) this.buildPath()
      this.lastinputhandling = this.inputhandling
      let ox = 0
      let oy = 0
      if (args.pixelwidth) this.bbwidth = args.pixelwidth
      if (this.preshift && this.preshift.x && this.preshift.y) {
        ox = this.preshift.x * this.svgscale
        oy = this.preshift.y * this.svgscale
      }

      const viewbox =
        Math.round(this.area.left) +
        ' ' +
        Math.round(this.area.top) +
        ' ' +
        Math.round(this.area.right - this.area.left) +
        ' ' +
        Math.round(this.area.bottom - this.area.top) +
        ' '

      const style = {
        position: 'absolute',
        touchAction: 'none',
        zIndex: args.zIndex,
        left:
          Math.round(
            ((this.area.left + this.spx + ox) * args.pixelwidth) / this.svgscale
          ) + 'px',
        width:
          Math.round(
            ((this.area.right - this.area.left) * args.pixelwidth) /
              this.svgscale
          ) + 'px',
        top:
          Math.round(
            ((this.area.top + this.spy + oy) * args.pixelwidth) / this.svgscale
          ) + 'px',
        height:
          Math.round(
            ((this.area.bottom - this.area.top) * args.pixelwidth) /
              this.svgscale
          ) + 'px',
        pointerEvents: 'fill' // deactive this option , if you like to pick an svg element by cursor for debugging
      }
      const innerobject = (
        <path
          d={this.svgpath}
          ref={this.ref}
          id='theMagicPath'
          className='magicPath'
          stroke='#80ffff'
          strokeWidth={(this.mw * args.pixelwidth) / this.svgscale}
        ></path>
      )
      if (this.inputhandling)
        this.jsxobj = (
          <svg
            viewBox={viewbox}
            style={style}
            ref={this.svgref}
            onPointerDown={this.inputhandling && this.pointerdown}
            onPointerMove={this.inputhandling && this.pointermove}
            onPointerUp={this.inputhandling && this.pointerup}
          >
            {this.svgpath && innerobject}
          </svg>
        )
      else {
        style.pointerEvents = 'none'
        this.jsxobj = (
          <svg viewBox={viewbox} style={style} ref={this.svgref}>
            {this.svgpath && innerobject}
          </svg>
        )
      }
      return this.jsxobj
    } else return this.jsxobj
  }
}
