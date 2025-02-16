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

import { SHA1 } from 'jshashes'
import React, { Component } from 'react'
import Color from 'color'
import { Blackboard } from './blackboard'
import { notebookEditPseudoAppid } from './jupyterhublet'

function ToRGBANumber(color) {
  if (typeof color === 'number') return color // no need to convert
  const cobj = Color(color)
  return ((cobj.rgbNumber() >>> 0) | ((0xff * cobj.valpha) << 24)) >>> 0
}

export class BlackboardNotepad extends Component {
  constructor(
    props // (stage, width, height,backcolor, notepadscreen)
  ) {
    super(props)
    // interactive class
    this.state = { addformpictmode: 0 }

    this.curkeyscroll = 0

    this.realblackboard = React.createRef()

    this.pointerobjids = {} // count obj
    this.pointerobjnum = {}
    this.pointerstoragenum = {}
    this.pointerdraw = {}
    this.pointerrejectcheck = []
    this.objnum = 1

    this.undostack = []

    this.lastpos = {}
    this.pictobjid = 0
    this.clientId = Math.random().toString(36).substr(2, 9) // randomly create clientId

    this.fogtime = {}
    // velocity handling
    this.lastfogpos = {}
    this.fogtime = {}
    this.fogmeanvel = {}

    this.svgscale = 2000 // should be kept constant

    this.interactive = true

    this.mousepathstarted = false

    this.lastkeyscrolltime = Date.now()

    this.rightmousescroll = false
    this.rightmousescrollx = 0
    this.rightmousescrolly = 0

    // properties of the current tool
    this.toolcolor = 0
    this.toolsize = 10
    this.tooltype = 0

    this.addformpictmode = 0 // stage of adding picture / form

    this.pointerdown = this.pointerdown.bind(this)
    this.pointermove = this.pointermove.bind(this)
    this.pointerup = this.pointerup.bind(this)
    this.wheel = this.wheel.bind(this)
    this.curFormPictAspect = this.curFormPictAspect.bind(this)
    this.calcAddFormPictSizeAndPos = this.calcAddFormPictSizeAndPos.bind(this)
    this.processEvent = this.processEvent.bind(this)
    this.processPointerReject = this.processPointerReject.bind(this)
    this.recycleObjId = this.recycleObjId.bind(this)
    this.scrollposListener = this.scrollposListener.bind(this)
    this.closeApp = this.closeApp.bind(this)
    this.submitAppPosition = this.submitAppPosition.bind(this)
    this.submitStateUpdate = this.submitStateUpdate.bind(this)
    this.addNewPicture = this.addNewPicture.bind(this)
    this.pointerRejectInterval = setInterval(this.processPointerReject, 100)

    this.mainDiv = React.createRef()

    this.palmPos = [
      { dmin: -90, dmax: 0, id: 0 }, // bottom right
      { dmin: -45, dmax: 45, id: 1 }, // middle right
      { dmin: 0, dmax: 90, id: 2 }, // top right
      { dmin: 90, dmax: 180, id: 3 }, // top left
      { dmin: 135, dmax: 180, dmin2: -180, dmax2: -135, id: 4 }, // middle left
      { dmin: -180, dmax: -90, id: 5 } // bottom left
    ]

    this.loadTouchConfig()
  }

  preventDefault(e) {
    // work around for apple ios
    e.preventDefault()
  }

  loadConfigFromStorage(prop, type, def) {
    let val = null
    if (window.localStorage) {
      val = window.localStorage.getItem(prop)
    }
    if (val == null) val = def
    this[prop] = type(val)
    if (this.toolbox()) this.toolbox().setBBConfig(prop, this[prop])
  }

  loadTouchConfig() {
    this.loadConfigFromStorage('touchOn', Boolean, true)
    this.loadConfigFromStorage('touchPenPrevent', Boolean, true)
    this.loadConfigFromStorage('touchContactArea', Boolean, true)
    this.loadConfigFromStorage('touchWrist', Boolean, true)
    this.loadConfigFromStorage(
      'touchWristPos',
      Number,
      0 /* for bottom right */
    )
  }

  pushTouchConfigToToolbox() {
    const tb = this.toolbox()
    if (tb) {
      tb.setBBConfig('touchOn', this.touchOn)
      tb.setBBConfig('touchPenPrevent', this.touchPenPrevent)
      tb.setBBConfig('touchContactArea', this.touchContactArea)
      tb.setBBConfig('touchWrist', this.touchWrist)
      tb.setBBConfig('touchWristPos', this.touchWristPos)
    }
  }

  saveConfig(prop, val) {
    if (window.localStorage) {
      window.localStorage.setItem(prop, val)
    }
    this[prop] = val
    if (this.toolbox()) this.toolbox().setBBConfig(prop, this[prop])
  }

  setblocked(isblocked) {
    if (this.props.outgoingsink) {
      this.props.outgoingsink.blocked = isblocked
      console.log('dispatcher blocked', this.props.outgoingsink.blocked)
    }
  }

  toolbox() {
    if (this.props.notepadscreen && this.props.notepadscreen.toolbox)
      return this.props.notepadscreen.toolbox.current
    return null
  }

  notetools() {
    if (this.props.notepadscreen?.getNoteTools)
      return this.props.notepadscreen.getNoteTools()
  }

  confirmbox() {
    if (this.props.notepadscreen && this.props.notepadscreen.confirmbox)
      return this.props.notepadscreen.confirmbox.current
    return null
  }

  originbox() {
    if (this.props.notepadscreen && this.props.notepadscreen.originbox)
      return this.props.notepadscreen.originbox.current
    return null
  }

  copydeletebox() {
    if (this.props.notepadscreen && this.props.notepadscreen.copydeletebox)
      return this.props.notepadscreen.copydeletebox.current
    return null
  }

  curFormPictAspect() {
    if (this.realblackboard && this.realblackboard.current)
      return this.realblackboard.current.curFormPictAspect()
    return 1
  }

  scrollheight() {
    if (this.realblackboard && this.realblackboard.current)
      return this.realblackboard.current.scrollheight()
    return null
  }

  setScrollOffset(scrolloffset) {
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setScrollOffset(scrolloffset)
  }

  calcObjId(pointerId) {
    const res = parseInt(
      '0x' +
        new SHA1()
          .hex(
            this.clientId +
              this.pointerobjnum[pointerId].toString(36) +
              pointerId
          )
          .substr(0, 8)
    )
    return res
  }

  recycleObjId(oldid) {
    const res = parseInt(
      '0x' +
        new SHA1()
          .hex(
            this.clientId + oldid + Math.random().toString(36).substr(2, 9) // we need something random
          )
          .substr(0, 8)
    )
    return res
  }

  addUndo(objid, storagenum) {
    if (objid && Number.isInteger(storagenum)) {
      if (this.notetools()) {
        this.notetools().setCanUndo(true)
      }
      this.undostack.push({ objid, storagenum })
    }
    if (this.undostack.length > 20) this.undostack.shift()
  }

  undo() {
    if (this.undostack.length > 0) {
      const element = this.undostack.pop()
      this.props.outgoingsink.deleteObject(
        null,
        element.objid,
        null,
        element.storagenum
      )
      if (this.undostack.length === 0 && this.notetools()) {
        this.notetools().setCanUndo(false)
      }
    }
  }

  checkPalmReject(event) {
    const now = event.timeStamp
    // detect if device really reports values that made sense, for example wacom tells nonsense
    if (this.lastpalmw !== event.width || this.lastpalmh !== event.height) {
      this.lastpalmw = event.width
      this.lastpalmh = event.height

      if (event.width * event.height > 45 * 45 && this.touchContactArea) {
        console.log('palm detected contact area', event.width, event.height)
        return true
      } else {
        // console.log('nopalm detected', event.width, event.height)
      }
    }
    if (
      this.touchWrist &&
      ((now - this.lastTouchTime < 500 && now > this.lastTouchTime) ||
        (now < this.lastTouchTime && this.lastTouchTime - now < 500)) && // check if this works
      event.pointerId !== this.lastTouchPointerId
    ) {
      // preparation for better palm detection, off for now
      const x = event.clientX - this.lastTouchPos.x
      const y = -(event.clientY - this.lastTouchPos.y)
      const degrees = (Math.atan2(y, x) * 180) / Math.PI
      const distance = Math.sqrt(x * x + y * y)
      const palmPos = this.palmPos[this.touchWristPos]

      if (
        distance * window.devicePixelRatio > 200 &&
        ((degrees > palmPos.dmin && degrees < palmPos.dmax) ||
          (palmPos.dmin2 && degrees > palmPos.dmin2 && degrees < palmPos.dmax2))
      ) {
        console.log(
          'degree palm rejection',
          distance,
          degrees,
          window.devicePixelRatio
        )
        return true
      }
    }
    if (
      this.touchPenPrevent &&
      ((now > this.lastPenEvent && now - this.lastPenEvent < 5 * 1000) ||
        (now < this.lastPenEvent &&
          this.lastPenEvent - now < 2000)) /* || !event.isPrimary */
    ) {
      return true // no touchy touchy
    }
    return false
  }

  processPointerReject() {
    this.pointerrejectcheck = this.pointerrejectcheck.filter((el) => {
      if (el.time - 2000 > this.lastTouchTime) return false
      if (el.check && el.check > 20) return false
      if (!el.check) el.check = 1
      else el.check++
      if (this.checkPalmReject(el.event)) {
        console.log('palm object dismissed retro active')
        this.props.outgoingsink.deleteObject(
          null,
          el.objid,
          null,
          el.storagenum
        )
        delete this.pointerdraw[el.event.pointerId]
        delete this.pointerobjids[el.event.pointerId]
        delete this.pointerobjnum[el.event.pointerId]
        delete this.pointerstoragenum[el.event.pointerId]
        return false
      } else return true
    }, this)
  }

  async pointerdown(event) {
    console.log(
      'pointerdown pointerId:',
      event.pointerId,
      'pointerType',
      event.pointerType,
      'isPrimary',
      event.isPrimary,
      'width',
      event.width,
      'height',
      event.height,
      'button',
      event.button,
      'cX',
      event.clientX,
      'cY',
      event.clientY
    )
    if (event.button === 2 && event.pointerType === 'mouse') {
      this.rightdown(event)
      return
    }
    const now = event.timeStamp
    if (event.pointerType === 'pen') this.lastPenEvent = now

    if (event.pointerType === 'touch') {
      if (this.checkPalmReject(event)) {
        console.log('palm object rejected')
        return
      }
      if (!this.touchOn) return // touch is turned off!
    }

    if (this.laserpointer && this.addformpictmode === 0) return

    const pos = { x: event.clientX, y: event.clientY }

    this.rightmousescroll = false

    if (this.magictool && this.addformpictmode === 0) {
      console.log(
        'magic pointerdown pointerId:',
        event.pointerId,
        'pointerType',
        event.pointerType,
        'isPrimary',
        event.isPrimary,
        'width',
        event.width,
        'height',
        event.height,
        'button',
        event.button,
        'cX',
        event.clientX,
        'cY',
        event.clientY
      )
      if (this.props.informDraw) this.props.informDraw()
      this.magicpointerid = event.pointerId
      if (this.copydeletebox()) this.copydeletebox().deactivate()
      const nt = this.notetools()
      if (nt) {
        nt.setCanTooltip(false)
      }
      const tb = this.toolbox()
      if (tb) {
        tb.deactivate()
      }
      if (this.realblackboard && this.realblackboard.current) {
        this.realblackboard.current.startMagicPath(
          pos.x / this.props.bbwidth,
          pos.y / this.props.bbwidth + this.calcCurpos(),
          {
            // datatarget
            sink: this.props.outgoingsink,
            newobjid: (oldid) => this.recycleObjId(oldid),
            deselect: () => {
              if (this.realblackboard && this.realblackboard.current)
                this.realblackboard.current.turnOffMagic()

              if (this.copydeletebox()) this.copydeletebox().deactivate()
            }
          }
        )
      }
      return
    }

    if (event.pointerId in this.pointerdraw === true) {
      // finish stale paths
      const objid = this.pointerobjids[event.pointerId]
      this.props.outgoingsink.finishPath(null, objid, null)
      if (this.realblackboard && this.realblackboard.current)
        this.realblackboard.current.preFinishPath(null, objid, null)

      delete this.pointerdraw[event.pointerId]
      delete this.pointerobjids[event.pointerId]
      delete this.pointerobjnum[event.pointerId]
      delete this.pointerstoragenum[event.pointerId]
    }

    if (event.pointerId in this.pointerdraw === false) {
      this.pointerdraw[event.pointerId] = 1
      if (this.props.informDraw) this.props.informDraw()

      if (this.addformpictmode !== 0) {
        switch (this.addformpictmode) {
          case 4:
            this.setState({
              addformpictposx: pos.x / this.props.bbwidth,
              addformpictposy: pos.y / this.props.bbwidth + this.calcCurpos(),
              addformpictheight: 200 / this.props.bbwidth,
              addformpictwidth: 200 / this.props.bbwidth,
              addformpictmode: 2 /* for drawing */
            })
            this.lastpictmovetime = now
            this.addformpictmode = 2
            this.addFormPictureMovePos({
              pos: { x: pos.x + 200, y: pos.y + 200 },
              reactivate: true,
              corner: 'rightBottom'
            })
            this.addFormPictureMovePos({
              pos: { x: pos.x, y: pos.y },
              reactivate: true,
              corner: 'leftTop'
            })

            break
          default:
            // do nothing
            break
        }
      } else {
        if (this.notetools()) {
          this.notetools().setCanTooltip(false)
        }
        // ok we have to generate an objid
        this.objnum++
        this.pointerobjnum[event.pointerId] = this.objnum
        this.lastpos[event.pointerId] = pos
        const objid = this.calcObjId(event.pointerId)
        this.pointerobjids[event.pointerId] = objid
        this.pointerstoragenum[event.pointerId] = Math.floor(
          pos.y / this.props.bbwidth + this.calcCurpos()
        )
        this.props.outgoingsink.startPath(
          null,
          objid,
          null,
          pos.x / this.props.bbwidth,
          pos.y / this.props.bbwidth + this.calcCurpos(),
          this.tooltype,
          Color(this.toolcolor).rgbNumber(),
          this.toolsize / this.svgscale,
          event.pressure
        )
        if (this.realblackboard && this.realblackboard.current)
          this.realblackboard.current.preStartPath(
            null,
            objid,
            null,
            pos.x / this.props.bbwidth,
            pos.y / this.props.bbwidth + this.calcCurpos(),
            this.tooltype,
            Color(this.toolcolor).rgbNumber(),
            this.toolsize / this.svgscale,
            event.pressure
          )
        if (event.pointerType === 'touch') {
          this.pointerrejectcheck.push({
            time: event.timeStamp,
            objid: this.pointerobjids[event.pointerId],
            event,
            storagenum: this.pointerstoragenum[event.pointerId]
          })
        }

        this.mousepathstarted = true
      }
    }
  }

  rightdown(event) {
    if (this.props.notesmode) return

    this.rightmousescrollx = event.screenX
    this.rightmousescrolly = event.screenY
    this.rightmousescroll = true
    this.rightmousescrollpos = this.calcCurpos()
    this.mouseidentifier = null
  }

  calcAddFormPictSizeAndPos(state, pos, corner) {
    const aspectratio = this.curFormPictAspect()
    switch (corner) {
      case 'rightBottom': {
        let nx = pos.x / this.props.bbwidth - state.addformpictposx
        let ny =
          pos.y / this.props.bbwidth + this.calcCurpos() - state.addformpictposy
        if (nx === 0) nx = 0.001
        if (ny === 0) ny = 0.001
        if (aspectratio) {
          const anx = Math.abs(nx)
          const any = Math.abs(ny)
          if (anx > any) {
            if (nx > 0) nx = any * aspectratio
            else nx = -any * aspectratio
          } else {
            if (ny > 0) ny = anx / aspectratio
            else ny = -anx / aspectratio
          }
          if (nx > 1.0) {
            const rescale = nx > 1.2 ? 0.8 / nx : 1.0 / nx
            nx *= rescale
            ny *= rescale
          }
        }
        return { addformpictwidth: nx, addformpictheight: ny }
      }
      case 'leftTop': {
        const npx = pos.x / this.props.bbwidth
        const npy = pos.y / this.props.bbwidth + this.calcCurpos()
        // old sizes

        return {
          addformpictposx: npx,
          addformpictposy: npy
        }
      }
      default:
        throw new Error('unknown corner')
    }
  }

  addFormPictureMovePos({ pos, reactivate, corner }) {
    this.setState((state) => {
      const retstate = this.calcAddFormPictSizeAndPos(state, pos, corner)
      let task
      if (reactivate) {
        task = 'reactivate'
      } else {
        task = 'setPosition'
      }
      const addformpictposx = retstate.addformpictposx || state.addformpictposx
      const addformpictposy = retstate.addformpictposy || state.addformpictposy
      const addformpictheight =
        retstate.addformpictheight || state.addformpictheight
      const addformpictwidth =
        retstate.addformpictwidth || state.addformpictwidth
      let box
      box = this.confirmbox()
      if (box)
        box[task]({
          x: addformpictposx + addformpictwidth,
          y: addformpictposy + addformpictheight - this.calcCurpos()
        })

      box = this.originbox()
      if (box)
        box[task]({
          x: addformpictposx,
          y: addformpictposy - this.calcCurpos()
        })

      return retstate
    })
  }

  reportFoG(x, y, clientid) {
    this.props.bbchannel.postMessage({
      command: 'FoG',
      data: { x, y, clientid }
    })
  }

  fogHandle(x, y, pointerid, now) {
    const newtime = now

    if (!this.fogtime[pointerid]) {
      this.fogtime[pointerid] = newtime
      this.lastfogpos[pointerid] = { x, y }
      return
    }

    const timeelapsed = (newtime - this.fogtime[pointerid]) / 1000
    if (timeelapsed > 0.05) {
      //
      this.fogtime[pointerid] = newtime

      this.reportFoG(x, y, this.clientId)
      if (this.realblackboard && this.realblackboard.current)
        this.realblackboard.current.preReceiveFoG({
          x,
          y,
          clientid: this.clientId
        })
    }
  }

  processEvent(mevent) {
    const pos = { x: mevent.clientX, y: mevent.clientY }

    const lastpos = this.lastpos[mevent.pointerId]
    if (lastpos) {
      const distance =
        (lastpos.x - pos.x) * (lastpos.x - pos.x) +
        (lastpos.y - pos.y) * (lastpos.y - pos.y)
      if (distance > 0) {
        const objid = this.pointerobjids[mevent.pointerId]
        this.props.outgoingsink.addToPath(
          null,
          objid,
          null,
          pos.x / this.props.bbwidth,
          pos.y / this.props.bbwidth + this.calcCurpos(),
          mevent.pressure
        )
        if (this.realblackboard && this.realblackboard.current)
          // preview
          this.realblackboard.current.preAddToPath(
            null,
            objid,
            null,
            pos.x / this.props.bbwidth,
            pos.y / this.props.bbwidth + this.calcCurpos(),
            mevent.pressure
          )
        this.lastpos[mevent.pointerId] = pos
      }
    }
  } // end process event

  componentDidMount() {
    // work around for apple ios
    this.mainDiv.current.addEventListener(
      'touchmove',
      this.preventDefault,
      false
    )
    this.mainDiv.current.addEventListener('touchup', this.preventDefault, false)
    this.mainDiv.current.addEventListener(
      'touchdown',
      this.preventDefault,
      false
    )
  }

  pointermove(event) {
    const now = event.timeStamp
    if (event.pointerType === 'pen' /* || event.pointerType === 'mouse' */)
      // also applies to mouse, behaviour of some wacom tablet in the not windows ink mode
      // no is not true in this case it is a mixure of mouse and touch events emulating the pen
      // this would not work
      this.lastPenEvent = now

    if (!this.rightmousescroll) {
      if (
        (event.pointerId in this.pointerdraw === true ||
          (this.magictool && event.pointerId === this.magicpointerid)) &&
        !this.laserpointer
      ) {
        if (event.pointerType === 'touch') {
          if (this.checkPalmReject(event) && !this.magictool) {
            // dismiss object
            console.log('palm object dismissed')
            this.props.outgoingsink.deleteObject(
              null,
              this.pointerobjids[event.pointerId],
              null,
              this.pointerstoragenum[event.pointerId]
            )
            delete this.pointerdraw[event.pointerId]
            delete this.pointerobjids[event.pointerId]
            delete this.pointerobjnum[event.pointerId]
            delete this.pointerstoragenum[event.pointerId]

            return
          }
          if (!this.touchOn) return // touch turned off
        }

        // if (event.pointerType === 'touch') {
        // always use writing pos for orientation
        this.lastTouchPos = { x: event.clientX, y: event.clientY }
        this.lastTouchTime = now
        this.lastTouchPointerId = event.pointerId
        // }
        if (this.magictool) {
          const pos = { x: event.clientX, y: event.clientY }
          if (this.realblackboard && this.realblackboard.current)
            this.realblackboard.current.addToMagicPath(
              pos.x / this.props.bbwidth,
              pos.y / this.props.bbwidth + this.calcCurpos()
            )
        } else {
          this.pointerdraw[event.pointerId]++
          if (typeof event.nativeEvent.getCoalescedEvents === 'function') {
            // are coalesced events supported, yes now process them all
            const coalevents = event.nativeEvent.getCoalescedEvents()
            coalevents.forEach(this.processEvent)
            this.pointerdraw[event.pointerId] += coalevents.length
          }
          this.processEvent(event)
        }
      } else if (this.addformpictmode !== 0) {
        const pos = { x: event.clientX, y: event.clientY }
        if (now - this.lastpictmovetime > 25) {
          // console.log('createmousemovement', pos)
          switch (this.addformpictmode) {
            case 4:
              this.setState({
                addformpictposx: pos.x / this.props.bbwidth,
                addformpictposy: pos.y / this.props.bbwidth + this.calcCurpos()
              })
              break
            case 3:
              this.addFormPictureMovePos({ pos, corner: 'rightBottom' })
              break
            default:
              break
          }
          this.lastpictmovetime = Date.now()
        }
      } /* if (!this.mousepathstarted) */ else if (
        this.pointerdraw &&
        Object.keys(this.pointerdraw).length === 0 &&
        Object.getPrototypeOf(this.pointerdraw) === Object.prototype
      ) {
        if (event.pointerType === 'touch' && now - this.lastPenEvent < 5 * 1000)
          return // no touchy touchy  // this is handled in pointer down already, no it is not in this case

        const pos = { x: event.clientX, y: event.clientY }
        if (this.laserpointer)
          this.fogHandle(
            pos.x / this.props.bbwidth,
            pos.y / this.props.bbwidth + this.calcCurpos(),
            event.pointerId,
            now
          )
      }
    } else {
      this.props.outgoingsink.scrollBoard(
        null,
        this.clientId,
        0,
        this.rightmousescrollpos +
          (-event.screenY + this.rightmousescrolly) / this.props.bbwidth
      )
      if (this.realblackboard && this.realblackboard.current)
        this.realblackboard.current.preScrollBoard(
          null,
          this.clientId,
          0,
          this.rightmousescrollpos +
            (-event.screenY + this.rightmousescrolly) / this.props.bbwidth
        )
    }
  }

  async pointerup(event) {
    if (event.button === 2 && event.pointerType === 'mouse') {
      this.rightup(event)
      return
    }
    const pos = { x: event.clientX, y: event.clientY }

    if (event.pointerId === this.magicpointerid && this.magictool) {
      console.log(
        'magic pointerup pointerId:',
        event.pointerId,
        'pointerType',
        event.pointerType,
        'isPrimary',
        event.isPrimary,
        'width',
        event.width,
        'height',
        event.height,
        'button',
        event.button,
        'cX',
        event.clientX,
        'cY',
        event.clientY
      )
      const nt = this.notetools()
      if (nt) {
        nt.setCanTooltip(true)
      }
      const tb = this.toolbox()
      if (tb) {
        tb.reactivate()
      }
      delete this.magicpointerid
      if (this.realblackboard && this.realblackboard.current) {
        await this.realblackboard.current.finishMagic((pos) => {
          if (this.copydeletebox())
            this.copydeletebox().reactivate({
              x: pos.x,
              y: pos.y - this.calcCurpos()
            })
        })
      }
    } else if (event.pointerId in this.pointerdraw === true) {
      if (this.notetools()) {
        this.notetools().setCanTooltip(true)
      }
      const objid = this.pointerobjids[event.pointerId]
      console.log(
        'pointerup pointerId:',
        event.pointerId,
        'pointerType',
        event.pointerType,
        'isPrimary',
        event.isPrimary,
        'width',
        event.width,
        'height',
        event.height,
        'button',
        event.button,
        'cX',
        event.clientX,
        'cY',
        event.clientY
      )
      if (event.clientX !== 0 && event.clientY !== 0) {
        this.props.outgoingsink.addToPath(
          null,
          objid,
          null,
          pos.x / this.props.bbwidth,
          pos.y / this.props.bbwidth + this.calcCurpos(),
          event.pressure
        )
        if (this.realblackboard && this.realblackboard.current)
          this.realblackboard.current.preAddToPath(
            null,
            objid,
            null,
            pos.x / this.props.bbwidth,
            pos.y / this.props.bbwidth + this.calcCurpos(),
            event.pressure
          )
      }
      this.addUndo(objid, this.pointerstoragenum[event.pointerId])
      this.props.outgoingsink.finishPath(null, objid, null)
      if (this.realblackboard && this.realblackboard.current)
        this.realblackboard.current.preFinishPath(null, objid, null)

      delete this.pointerdraw[event.pointerId]
      delete this.pointerobjids[event.pointerId]
      delete this.pointerobjnum[event.pointerId]
      delete this.pointerstoragenum[event.pointerId]
    }
  }

  wheel(event) {
    if (this.props.reportScroll) {
      this.props.reportScroll(event.deltaY / this.props.bbwidth)
    }
    if (event.deltaMode === 0) {
      this.scrollboardKeys(0, event.deltaY / this.props.bbwidth)
    }
  }

  rightup(event) {
    if (this.rightmousescroll) {
      this.props.outgoingsink.scrollBoard(
        null,
        this.clientId,
        0,
        this.rightmousescrollpos +
          (-event.screenY + this.rightmousescrolly) / this.props.bbwidth
      )
      if (this.realblackboard && this.realblackboard.current)
        this.realblackboard.current.preScrollBoard(
          null,
          this.clientId,
          0,
          this.rightmousescrollpos +
            (-event.screenY + this.rightmousescrolly) / this.props.bbwidth
        )
      this.rightmousescroll = false
    }
  }

  scrollboardTB(x, y, reference) {
    if (this.props.outgoingsink)
      this.props.outgoingsink.scrollBoard(null, this.clientId, 0, reference + y)
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.preScrollBoard(
        null,
        this.clientId,
        0,
        reference + y
      )
  }

  scrollboardKeys(x, y) {
    if (this.props.notesmode) return
    const time = Date.now()

    let resetkeyscroll = null

    if (time - this.lastkeyscrolltime > 1000) {
      // This prevents weird effects
      // if network has a hickup
      resetkeyscroll = this.getCurScrollPos()
    }

    this.lastkeyscrolltime = time

    let curkeyscroll = this.curkeyscroll
    if (resetkeyscroll) curkeyscroll = resetkeyscroll

    curkeyscroll += y
    if (curkeyscroll <= 0) curkeyscroll = 0.0001
    if (this.props.outgoingsink)
      this.props.outgoingsink.scrollBoard(null, this.clientId, 0, curkeyscroll)
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.preScrollBoard(
        null,
        this.clientId,
        0,
        curkeyscroll
      )
    this.curkeyscroll = curkeyscroll
  }

  activateLaserPointer() {
    this.laserpointer = true
    this.magictool = false
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'laserpointer'
      })
  }

  deactivateLaserPointer() {
    if (this.laserpointer === true) {
      this.reportFoG(null, null, this.clientId)
      if (this.realblackboard && this.realblackboard.current)
        this.realblackboard.current.preReceiveFoG({
          x: null,
          y: null,
          clientid: this.clientId
        })
      this.laserpointer = false
    }
  }

  deselectOldTool() {
    if (this.magictool && this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.turnOffMagic()
    if (this.copydeletebox()) this.copydeletebox().deactivate()
    if (this.addformpictmode > 0) {
      this.addformpictmode = 0
      this.setState({
        addformpictuuid: undefined,
        addformpicturl: undefined,
        addformpicturlthumb: undefined,
        addformpictmode: 0,
        addformpictformtype: undefined
      })
      this.deactivateUtilBoxes()
    }
    this.laserpointer = false
    this.magictool = false
  }

  setMenuMode() {
    this.saveLastCursorState()
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'menu'
      })
  }

  deleteMagicButtonPressed() {
    if (this.magictool && this.realblackboard && this.realblackboard.current) {
      const magicobjids = this.realblackboard.current.getMagicObjIds()
      this.realblackboard.current.turnOffMagic()
      for (let pos = 0; pos < magicobjids.length; pos++) {
        const element = magicobjids[pos]
        this.props.outgoingsink.deleteObject(
          null,
          element.objid,
          null,
          element.storagenum
        )
      }
    }
  }

  copyMagicButtonPressed() {
    if (this.magictool && this.realblackboard && this.realblackboard.current) {
      this.realblackboard.current.copyMagic()
    }
  }

  setMagicTool() {
    this.deselectOldTool()
    this.undostack = []
    if (this.notetools()) {
      this.notetools().setCanUndo(false)
    }
    this.magictool = true
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'magic'
      })
  }

  updateToolProps({ size, lw, color, bordercolor, fillcolor }) {
    if (this.state.addformpictmode !== 0 && (bordercolor || fillcolor || lw)) {
      this.setState((state) => {
        const nstate = {}
        if (bordercolor) nstate.addformpictbColor = bordercolor
        if (fillcolor) nstate.addformpictfColor = fillcolor
        if (lw) nstate.addformpictlw = lw
        return nstate
      })
    }

    if (this.state.addformpictmode === 0) {
      this.toolsize = size || this.toolsize

      this.toolcolor = color || this.toolcolor
    }
    if (
      this.realblackboard &&
      this.realblackboard.current &&
      this.addformpictmode === 0 &&
      (size || color)
    )
      this.realblackboard.current.setcursor({
        mode: 'drawing',
        size: this.toolsize,
        color: this.toolcolor
      })
  }

  setPenTool(color, size) {
    this.deselectOldTool()
    this.tooltype = 0
    this.toolsize = size
    this.toolcolor = color
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'drawing',
        size,
        color
      })
    // console.log("sPT",this.tooltype, this.toolsize,this.toolcolor );
  }

  setFormTool({ type, bColor, lw, fColor, lastdrawx, lastdrawy }) {
    this.saveLastCursorState()
    this.deselectOldTool()
    this.addformpictmode = 2 // stage of adding picture
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'normal'
      })

    this.lastpictmovetime = Date.now()

    let sugposx
    let sugposy
    if (lastdrawx) {
      sugposx = lastdrawx + 0.01
      if (sugposx < 0.025) sugposx = 0.05
      if (sugposx > 0.95) sugposx = 0.85
    }

    if (lastdrawy) {
      sugposy = lastdrawy + 0.01
      if (sugposy < 0.025) sugposy = 0.05
      if (sugposy > this.scrollheight() - 0.05)
        sugposy = this.scrollheight() - 0.1
    }

    this.setState((state) => {
      const posx = state.addformpictposx || sugposx || 0.3
      const posy =
        state.addformpictposy ||
        sugposy + this.getCurScrollPos() ||
        0.1 + this.getCurScrollPos()
      let height = state.addformpictheight || 0.1
      let width = state.addformpictwidth || 0.1
      if (type === 3) width = height = (width + height) * 0.5
      this.addFormPictureMovePos({
        pos: {
          x: (posx + width) * this.props.bbwidth,
          y: (posy + height - this.getCurScrollPos()) * this.props.bbwidth
        },
        reactivate: true,
        corner: 'rightBottom'
      })
      this.addFormPictureMovePos({
        pos: {
          x: posx * this.props.bbwidth,
          y: (posy - this.getCurScrollPos()) * this.props.bbwidth
        },
        reactivate: true,
        corner: 'leftTop'
      })

      return {
        addformpictfColor: fColor,
        addformpictbColor: bColor,
        addformpictlw: lw,
        addformpictuuid: undefined,
        addformpicturl: undefined,
        addformpicturlthumb: undefined,
        addformpictposx: posx,
        addformpictposy: posy,
        addformpictheight: height,
        addformpictwidth: width,
        addformpictmode: 2,
        addformpictformtype: type
      }
    })
  }

  scrollposListener(scrollpos) {
    if (this.addformpictmode === 2) {
      const posx = this.state.addformpictposx || 0.3
      const posy =
        this.state.addformpictposy || 0.1 + this.calcCurpos(scrollpos)
      const height = this.state.addformpictheight || 0.1
      const width = this.state.addformpictwidth || 0.1

      let box = this.confirmbox()
      if (box)
        box.setPosition({
          x: posx + width,
          y: posy + height - this.calcCurpos(scrollpos)
        })

      box = this.originbox()
      if (box)
        box.setPosition({
          x: posx,
          y: posy - this.calcCurpos(scrollpos)
        })
    }
  }

  setMarkerTool(color, size) {
    this.deselectOldTool()
    this.tooltype = 1
    this.toolsize = size
    this.toolcolor = color
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'drawing',
        size,
        color,
        alpha: 0.3
      })
    // console.log("sMT",this.tooltype, this.toolsize,this.toolcolor );
  }

  setEraserTool(size) {
    this.deselectOldTool()
    this.tooltype = 2
    this.toolsize = size
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'drawing',
        size,
        color: this.props.backcolor
      })
    // console.log("sET",this.tooltype, this.toolsize,this.toolcolor );
  }

  arrangeButtonPressed() {
    this.setblocked(true)
    this.props.notepadscreen.arrangeButtonPressed()
  }

  saveLastCursorState() {
    if (
      this.realblackboard &&
      this.realblackboard.current &&
      this.realblackboard.current.state.cursor &&
      this.realblackboard.current.state.cursor.mode !== 'picture' &&
      this.realblackboard.current.state.cursor.mode !== 'menu' &&
      this.realblackboard.current.state.cursor.mode !== 'normal'
    )
      this.beforepictcursor = this.realblackboard.current.state.cursor
  }

  restoreLastCursorState() {
    if (
      this.realblackboard &&
      this.realblackboard.current &&
      this.beforepictcursor
    ) {
      this.realblackboard.current.setcursor(this.beforepictcursor)
    }
  }

  pictButtonPressed() {
    this.setblocked(true)
    this.saveLastCursorState()
    this.deselectOldTool()
    this.props.notepadscreen.pictButtonPressed()
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'picture'
      })
  }

  ipynbButtonPressed() {
    // may be do something else
    this.props.notepadscreen.ipynbButtonPressed()
  }

  addNewPicture(x, y, width, height, sha) {
    this.objnum++
    // eslint-disable-next-line dot-notation
    this.pointerobjnum['newpicture'] = this.objnum
    const objid = this.calcObjId('newpicture')
    this.props.outgoingsink.addPicture(
      undefined,
      objid,
      undefined,
      x,
      y,
      width,
      height,
      sha
    )
  }

  okButtonPressed() {
    if (this.addformpictmode !== 0) {
      this.setblocked(false)
      this.objnum++
      // eslint-disable-next-line dot-notation
      this.pointerobjnum['picture'] = this.objnum

      const objid = this.calcObjId('picture')
      // todo report about new picture
      if (this.state.addformpictformtype) {
        this.props.outgoingsink.addForm(
          undefined,
          objid,
          undefined,
          this.state.addformpictposx,
          this.state.addformpictposy,
          this.state.addformpictwidth,
          this.state.addformpictheight,
          this.state.addformpictformtype,
          ToRGBANumber(this.state.addformpictbColor),
          ToRGBANumber(this.state.addformpictfColor),
          this.state.addformpictlw / this.svgscale
        )
      } else {
        this.props.outgoingsink.addPicture(
          undefined,
          objid,
          undefined,
          this.state.addformpictposx,
          this.state.addformpictposy,
          this.state.addformpictwidth,
          this.state.addformpictheight,
          this.state.addformpictuuid
        )
      }
      if (this.toolbox())
        this.toolbox().reportDrawPos(
          this.state.addformpictposx + 0.01,
          this.state.addformpictposy + 0.01 - this.getCurScrollPos()
        )
      this.addUndo(objid, Math.floor(this.state.addformpictposy))

      this.setState({
        addformpictuuid: undefined,
        addformpicturl: undefined,
        addformpicturlthumb: undefined,
        addformpictposx: undefined,
        addformpictposy: undefined,
        addformpictheight: undefined,
        addformpictwidth: undefined,
        addformpictformtype: undefined,
        addformpictmode: 0
      })
      this.addformpictmode = 0
      this.restoreLastCursorState()
      this.deactivateUtilBoxes()
      this.reactivateToolBox()
    }
  }

  cancelButtonPressed() {
    if (this.addformpictmode !== 0) {
      this.setblocked(false)
      this.setState({
        addformpictuuid: undefined,
        addformpicturl: undefined,
        addformpicturlthumb: undefined,
        addformpictheight: undefined,
        addformpictwidth: undefined,
        addformpictposx: undefined,
        addformpictposy: undefined,
        addformpictformtype: undefined,
        addformpictmode: 0
      })
      // todo report about new picture
      this.addformpictmode = 0
      this.restoreLastCursorState()
      this.deactivateUtilBoxes()
      this.reactivateToolBox()
    }
  }

  deactivateUtilBoxes() {
    if (this.confirmbox()) this.confirmbox().deactivate()
    if (this.originbox()) this.originbox().deactivate()
  }

  reactivateToolBox() {
    console.log('reactivate Toolbox called BB!', this.toolbox())
    if (this.toolbox()) this.toolbox().reactivate()
  }

  enterAddPictureMode(uuid, url, urlthumb) {
    this.addformpictmode = 4 // stage of adding picture
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'normal'
      })
    this.setState({
      addformpictuuid: uuid,
      addformpicturl: url,
      addformpicturlthumb: urlthumb,
      addformpictposx: 0.3,
      addformpictposy: 0.3 + this.getCurScrollPos(),
      addformpictheight: null,
      addformpictwidth: 0.1,
      addformpictmode: 4,
      addformpictformtype: undefined
    })
  }

  onAppStart(id, sha, appid) {
    const scrollheight = this.scrollheight()
    if (appid === notebookEditPseudoAppid) {
      this.props.outgoingsink.startApp(
        undefined /* time */,
        0.1,
        Math.min(9 / 16, this.scrollheight()) * 0.1 + this.getCurScrollPos(),
        0.8,
        Math.min(9 / 16, this.scrollheight()) * 0.8, // typical screen ration
        id,
        sha,
        appid
      )
      return
    }
    this.props.outgoingsink.startApp(
      undefined /* time */,
      0.15,
      scrollheight * 0.3 + this.getCurScrollPos(),
      0.25,
      scrollheight * 0.5,
      id,
      sha,
      appid
    )
  }

  closeApp() {
    this.props.outgoingsink.closeApp(undefined /* time */)
  }

  submitAppPosition(x, y, width, height, deactivate) {
    this.props.outgoingsink.moveApp(
      undefined /* time */,
      x,
      y,
      width,
      height,
      deactivate
    )
  }

  submitStateUpdate(update) {
    this.props.outgoingsink.dataApp(undefined /* time */, update)
  }

  receivePictInfo(data) {
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.receivePictInfo(data)
  }

  receiveIpynbInfo(data) {
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.receiveIpynbInfo(data)
  }

  receiveBgpdfInfo(data) {
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.receiveBgpdfInfo(data)
  }

  getStartScrollboardTB() {
    if (this.realblackboard && this.realblackboard.current)
      return this.realblackboard.current.getCurScrollPos()
  }

  getCurScrollPos() {
    if (this.realblackboard && this.realblackboard.current)
      return this.realblackboard.current.getCurScrollPos()
  }

  calcCurpos(curscrollpos) {
    if (this.realblackboard && this.realblackboard.current)
      return this.realblackboard.current.calcCurpos(curscrollpos)
  }

  doRedraw(data) {
    if (this.realblackboard && this.realblackboard.current)
      return this.realblackboard.current.doRedraw()
  }

  render() {
    let addformpict
    if (this.state.addformpictuuid || this.state.addformpictformtype) {
      addformpict = {
        uuid: this.state.addformpictuuid,
        formType: this.state.addformpictformtype,
        lw: (this.state.addformpictlw * this.props.bbwidth) / this.svgscale,
        url: this.state.addformpicturl,
        urlthumb: this.state.addformpicturlthumb,
        posx: this.state.addformpictposx,
        posy: this.state.addformpictposy,
        width: this.state.addformpictwidth,
        height: this.state.addformpictheight
      }
      if (this.state.addformpictbColor) {
        addformpict.bColor = ToRGBANumber(this.state.addformpictbColor)
      }
      if (this.state.addformpictfColor) {
        addformpict.fColor = ToRGBANumber(this.state.addformpictfColor)
      }
    } else {
      addformpict = undefined
    }
    const addformpictmessstyle = {
      position: 'absolute',
      top: '5px',
      left: '20px',
      color: 'red',
      textShadow: '0 0 3px #FF0000',
      zIndex: 1202
    }
    return (
      <div
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
        ref={this.mainDiv}
        onPointerDown={this.pointerdown}
        onPointerMove={this.pointermove}
        onPointerUp={this.pointerup}
        onPointerLeave={this.pointerup}
        onWheel={this.wheel}
      >
        {this.state.addformpictmode === 4 && (
          <div style={addformpictmessstyle}>
            <h3> Select upper left corner of picture </h3>
          </div>
        )}
        {this.state.addformpictmode === 3 && (
          <div style={addformpictmessstyle}>
            <h3> Select lower right corner of picture</h3>
          </div>
        )}
        <Blackboard
          backcolor={this.props.backcolor}
          backclass={this.props.backclass}
          bbchannel={this.props.bbchannel}
          outgodispatcher={this.outgodispatcher}
          reportDrawPosCB={this.props.reportDrawPosCB}
          bbwidth={this.props.bbwidth}
          addformpict={addformpict}
          bbheight={this.props.bbheight}
          storage={this.props.storage}
          ref={this.realblackboard}
          notepadscreen={this.props.notepadscreen}
          experimental={this.props.experimental}
          isnotepad={true}
          zOffset={this.props.notesmode ? 100 : undefined}
          notesmode={this.props.notesmode}
          pageoffset={this.props.pageoffset}
          pageoffsetabsolute={this.props.pageoffsetabsolute}
          scrollposListener={this.scrollposListener}
          drawActivityMonitor={this.props.drawActivityMonitor}
          makeAppletMaster={this.props.makeAppletMaster}
          screenShotSaver={this.props.screenShotSaver}
          addNewPicture={this.addNewPicture}
          closeApp={this.closeApp}
          submitAppPosition={this.submitAppPosition}
          submitStateUpdate={this.submitStateUpdate}
        ></Blackboard>
      </div>
    )
  }
}
