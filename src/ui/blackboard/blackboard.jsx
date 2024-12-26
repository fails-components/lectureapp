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
import {
  DrawObjectGlyph,
  DrawObjectPicture,
  DrawObjectForm
} from '@fails-components/data'

import Color from 'color'
import { MagicObject } from './magicobject'
import { ImageHelper } from './ImageHelper'
import { BackgroundPDF } from './backgroundpdf'
import { SVGWriting2, SVGSpotlight, FormHelper } from './helpers'

window.addEventListener('contextmenu', function (e) {
  e.preventDefault()
  e.stopPropagation()
  return false
})

function ToRGBANumber(color) {
  if (typeof color === 'number') return color // no need to convert
  const cobj = Color(color)
  return ((cobj.rgbNumber() >>> 0) | ((0xff * cobj.valpha) << 24)) >>> 0
}

export class Blackboard extends Component {
  constructor(
    props // (stage, width, height,backcolor, notepadscreen)
  ) {
    super(props)

    this.state = {}
    this.state.objects = []
    this.state.pathstarted = false
    this.state.curscrollpos = 0

    this.state.redrawing = false

    this.work = {} // handles drawing, now only objects
    this.work.objects = []
    this.copyobjts = [] // storage for objects during copying
    this.workobj = {}

    this.preworkobj = {}

    this.addformpictobj = React.createRef()
    this.spotlight = React.createRef()

    this.redrawing = false // not to be confused with the state

    this.recpathstarted = false

    this.replay = false // during a replay state updates are handled differently!

    this.lastpos = 0

    this.temppoints = []
    this.curcolor = 0 // properties of the drawing surface
    this.curpenwidth = 0
    this.curtype = 0

    this.rendermin = 0
    this.rendermax = props.bbheight / props.bbwidth
    this.forceredraw = false

    this.curkeyscroll = 0
    this.lastkeyscrolltime = 0

    this.pictures = {}

    this.notepadscreen = props.notepadscreen

    this.state.scrolloffset = 0
    this.state.drawversion = 0

    this.changeStorage()
    this.lastbbtemp = null

    this.lastrenderprops = {}

    this.lastrpd = Date.now()

    // stage.addChild(this.blackboardtemp);

    this.pathstarted = this.pathupdated = false

    this.stage = props.stage

    this.handleBBChannel = this.handleBBChannel.bind(this)

    this.stepDrawVersion = this.stepDrawVersion.bind(this)
    this.renderObjectsWithCache = this.renderObjectsWithCache.bind(this)
    this.renderObjectsWithoutCache = this.renderObjectsWithoutCache.bind(this)
    this.renderFilter = this.renderFilter.bind(this)
    console.log('Blackboard start up completed!')
    this.updateObjects = this.updateObjects.bind(this)
    this.changeMagic = this.changeMagic.bind(this)
    this.updateObjectsId = setInterval(this.updateObjects, 40)
    this.isdirty = false
  }

  changeStorage(prevstorage) {
    if (this.props.storage) {
      this.networkreceive = this.props.storage.networkreceive
      this.props.storage.incomdispatcher.addSink(this) // we also want to draw everything
      this.collection = this.props.storage.collection
    } else {
      this.networkreceive = undefined
      this.collection = undefined
      if (prevstorage) this.props.storage.incomdispatcher.removeSink(this)
    }
  }

  changeMagic() {
    this.isdirty = true
    if (this.magicobject) {
      const deletepos = this.magicobject.findCopyDeleteBoxPos()
      if (deletepos && this.currentSetDeletePos)
        this.currentSetDeletePos(deletepos)
    }
  }

  updateObjects() {
    if (this.isdirty) {
      this.setState(this.stepDrawVersion)
      this.isdirty = false
    }
    if (this.objdirty) {
      this.setState({
        objects: this.work.objects.concat(this.copyobjts)
      })
      this.objdirty = false
    }
  }

  handleBBChannel(event) {
    const data = event.data
    const type = data.type
    switch (type) {
      case 'replaceData':
        {
          const callback = (cs) => {
            if (this.props.outgodispatcher)
              this.props.outgodispatcher.setTimeandScrollPos(
                cs.time,
                cs.scrollx,
                cs.scrolly
              )
            this.props.notepadscreen.setCommandState(cs)
          }
          this.replaceData(data.data, callback)
        }
        break
      case 'receiveData':
        if (typeof data.data.timeSet !== 'undefined') {
          if (data.data.timeSet) {
            // console.log('initialscroll', data)
            if (this.props.outgodispatcher)
              this.props.outgodispatcher.setTimeandScrollPos(data.data.time)
          }
        }
        this.networkreceive.receiveData(data.data)
        if (this.props.drawActivityMonitor) this.props.drawActivityMonitor()
        break
      case 'receivePictInfo':
        this.receivePictInfo(data.data)
        break
      case 'receiveFoG':
        this.receiveFoG(data.data)
        if (this.props.drawActivityMonitor) this.props.drawActivityMonitor()
        break
      default:
        throw new Error('Unknown bbchannel type ' + type)
    }
  }

  componentDidMount() {
    if (this.props.bbchannel) {
      this.props.bbchannel.onmessage = this.handleBBChannel
    }
  }

  /* componentWillUnmount()
  {
    if (this.props.bbchannel)
    {
    }

  } */

  componentDidUpdate(prevprops, prevState) {
    if (
      !isNaN(this.props.pageoffset) &&
      prevprops.pageoffset !== this.props.pageoffset
    ) {
      this.checkRedraw()
    }
    if (prevprops.storage !== this.props.storage) {
      this.changeStorage(prevprops.storage)
    }
  }

  componentWillUnmount() {
    this.networkreceive = undefined
    this.collection = undefined
    if (this.props.storage) this.props.storage.incomdispatcher.removeSink(this)
  }

  toolbox() {
    if (this.props.notepadscreen && this.props.notepadscreen.toolbox)
      return this.props.notepadscreen.toolbox.current
  }

  notetools() {
    if (this.props.notepadscreen?.getNoteTools)
      return this.props.notepadscreen.getNoteTools()
  }

  scrollheight() {
    return this.props.bbheight / this.props.bbwidth
  }

  curFormPictAspect() {
    let aspect = 1
    if (this.addformpictobj.current)
      aspect = this.addformpictobj.current.Aspect()
    return aspect
  }

  setScrollOffset(scrolloffset) {
    this.setState({ scrolloffset })
    // console.log('setScrollOffset', scrolloffset)
    this.scrollBoard(0, 'myself', 0, this.getCurScrollPos())
  }

  updateRenderArea(x, y) {
    this.rendermin = Math.min(y, this.rendermin)
    this.rendermax = Math.max(y, this.rendermax)
  }

  addPicture(time, objnum, curclient, x, y, width, height, uuid) {
    this.updateRenderArea(x, y)
    this.updateRenderArea(x + width, y + height)
    // console.log('addpicture', x, y, width, height, uuid)
    const pictinfo = this.pictures[uuid]
    // console.log('pictinfo', pictinfo)
    if (pictinfo) {
      const addpict = new DrawObjectPicture(objnum)

      addpict.addPicture(
        x,
        y,
        width,
        height,
        uuid,
        pictinfo.url,
        pictinfo.mimetype,
        pictinfo.urlthumb
      )

      this.work.objects.push(addpict)

      this.setState({ objects: this.work.objects.concat() })
    }

    // resubmitpath
  }

  addForm(
    time,
    objnum,
    curclient,
    x,
    y,
    width,
    height,
    type,
    bColor,
    fColor,
    lw
  ) {
    this.updateRenderArea(x, y)
    this.updateRenderArea(x + width, y + height)
    const addform = new DrawObjectForm(objnum)

    addform.addForm(x, y, width, height, type, bColor, fColor, lw)

    this.work.objects.push(addform)

    this.setState({ objects: this.work.objects.concat() })

    // resubmitpath
  }

  stepDrawVersion(state) {
    return { drawversion: state.drawversion + 1 }
  }

  turnOffMagic() {
    if (this.magicobject) {
      this.magicobject.cleanup()
      // TODO cleanup magicobject
      delete this.magicobject
      this.copyobjts = []
      this.objdirty = true
    }
  }

  getMagicObjIds() {
    if (this.magicobject) return this.magicobject.getObjIds()
    else return []
  }

  startMagicPath(x, y, datatarget) {
    // TODO remove old selections
    this.turnOffMagic()
    this.magicobject = new MagicObject({
      changemagic: this.changeMagic,
      datatarget
    })
    this.magicobject.addPoint(x, y)
    this.isdirty = true
  }

  addToMagicPath(x, y) {
    const now = Date.now()
    if (this.magicobject) {
      this.magicobject.addPoint(x, y)
      this.isdirty = true
      if (now - this.lastrpd > 200) {
        // this is quite expensive, do not do this during a redraw, but this is never a redraw
        this.lastrpd = now
        if (this.toolbox())
          this.toolbox().reportDrawPos(
            x,
            y - this.state.curscrollpos - this.state.scrolloffset
          )

        if (this.props.reportDrawPosCB)
          this.props.reportDrawPosCB(
            x,
            (y - this.state.curscrollpos - this.state.scrolloffset) /
              this.scrollheight()
          )
      }
    }
  }

  finishMagic(setdeletepos) {
    // TODO selection stuff
    if (this.magicobject) {
      this.isdirty = true
      const magicobj = this.magicobject
      magicobj.activateInputHandling()
      setTimeout(() => {
        const objects = this.work.objects
        if (magicobj) {
          let selected = false
          for (const id in objects) {
            const obj = objects[id]
            selected = magicobj.testAndSelectDrawObject(obj) || selected
          }
          if (selected) {
            const deletepos = magicobj.findCopyDeleteBoxPos()
            this.currentSetDeletePos = setdeletepos
            if (deletepos) setdeletepos(deletepos)
            magicobj.activateMove()
          } else {
            this.turnOffMagic()
          }
        }
        this.isdirty = true
      }, 0)
      // delete this.magicobject
    }
  }

  copyMagic() {
    if (this.magicobject) {
      const magicobj = this.magicobject
      this.copyobjts = magicobj.copyObjsAndSelect()
      this.objdirty = true
    }
  }

  startPath(time, objnum, curclient, x, y, type, color, width, pressure) {
    // console.log("startPath",x,y,type,color,width, pressure);

    if (this.workobj[objnum]) {
      // in case of lost messages
      console.log('lost case', objnum)
    }

    this.workobj[objnum] = new DrawObjectGlyph(objnum)
    this.workobj[objnum].setPreview(true)
    this.work.objects.push(this.workobj[objnum]) // moved from finish path
    this.workobj[objnum].startPath(x, y, type, color, width, pressure)

    this.updateRenderArea(x, y)

    if (!this.redrawing) {
      this.isdirty = true
      this.objdirty = true
    }

    // }
    this.recpathstarted = true
    this.lastrender = Date.now()
  }

  preStartPath(time, objnum, curclient, x, y, type, color, width, pressure) {
    // console.log("startPath",x,y,type,color,width, pressure);

    if (this.preworkobj[objnum]) {
      // in case of lost messages
      console.log('lost case preview')
    }

    this.preworkobj[objnum] = new DrawObjectGlyph(objnum)
    this.preworkobj[objnum].startPath(x, y, type, color, width, pressure)

    this.setState({ fogpos: false })
    this.isdirty = true
    this.objdirty = true

    // }
    this.prerecpathstarted = true
    this.prelastrender = Date.now()
  }

  addToPath(time, objid, curclient, x, y, pressure) {
    if (this.workobj[objid]) {
      // TODO handle objid
      this.workobj[objid].addToPath(x, y, pressure)
      const now = Date.now()

      // console.log("addtopath rs",x,y,pressure);

      if (!this.redrawing && !this.preworkobj[objid]) {
        this.isdirty = true
        this.lastrender = now
      }

      this.updateRenderArea(x, y)
    }
    // console.log("addToPath",time,curclient,x,y,x*this.props.bbwidth,y*this.props.bbwidth);
  }

  preAddToPath(time, objid, curclient, x, y, pressure) {
    if (this.preworkobj[objid]) {
      // TODO handle objid
      this.preworkobj[objid].addToPath(x, y, pressure)

      // console.log("addtopath rs",x,y,pressure);
      const now = Date.now()

      if (this.state.fogpos) this.setState({ fogpos: false })
      this.isdirty = true
      if (now - this.lastrpd > 200) {
        // this is quite expensive, do not do this during a redraw, but this is never a redraw
        this.lastrpd = now
        if (this.toolbox())
          this.toolbox().reportDrawPos(
            x,
            y - this.state.curscrollpos - this.state.scrolloffset
          )
        if (this.props.reportDrawPosCB)
          this.props.reportDrawPosCB(
            x,
            (y - this.state.curscrollpos - this.state.scrolloffset) /
              this.scrollheight()
          )
      }

      // this.updateRenderArea(x, y)
    }
    // console.log("addToPath",time,curclient,x,y,x*this.props.bbwidth,y*this.props.bbwidth);
  }

  finishPath(time, objid, curclient) {
    if (this.workobj[objid]) {
      this.workobj[objid].finishPath()
      this.workobj[objid].setPreview(false)
      delete this.workobj[objid]
      /* if (this.preworkobj[objid])
        console.log(
          'finish pathdelay',
          (Date.now() - this.preworkobj[objid].finishtime) / 1000,
          'seconds'
        ) */
      delete this.preworkobj[objid] // also remove preview

      if (!this.redrawing) {
        this.isdirty = true
      }
    }
    this.recpathstarted = false // tracks the process outside the state
  }

  preFinishPath(time, objid, curclient) {
    if (this.preworkobj[objid]) {
      this.preworkobj[objid].finishPath()
      // this.preworkobj[objid].finishtime = Date.now()
      // this.work.objects.push(this.workobj[objid])
      // delete this.workobj[objid]

      if (!this.redrawing) {
        if (this.state.fogpos) this.setState({ fogpos: false })
        this.isdirty = true
      }
    }
    this.prerecpathstarted = false // tracks the process outside the state */
  }

  deleteObject(time, objnum, curclient, storagenum) {
    // not very efficient, if multiple deleteObjects are present
    // optimize later?
    this.work.objects = this.work.objects.filter((el) => el.objid !== objnum)
    delete this.preworkobj[objnum] // also remove preview

    if (!this.redrawing) {
      this.isdirty = true
      this.objdirty = true
    }
  }

  moveObject(time, objnum, curclient, x, y) {
    if (!this.work.objects) return
    this.work.objects.forEach((el) => {
      if (el.objid === objnum) {
        el.moveObject(x, y)
      }
    })

    if (!this.redrawing) {
      this.isdirty = true
      this.objdirty = true
    }
  }

  scrollBoard(time, clientnum, x, y) {
    if (this.myclientnum && clientnum === this.myclientnum) return // only scrolls from other people
    if (x !== 0) {
      // implement
    }

    if (y !== 0 && true) {
      // console.log('scrollboard', y, this.state.scrolloffset)
      let newpos = /* this.curscrollpos+ */ y
      if (newpos < 0) newpos = 0
      this.setState({ curscrollpos: newpos })
      if (this.props.scrollposListener) this.props.scrollposListener(newpos)
    }
    if (x !== 0 || y !== 0 || this.forceredraw) {
      this.checkRedraw()
    }
  }

  preScrollBoard(time, clientnum, x, y) {
    if (x !== 0) {
      // implement
    }

    if (y !== 0 && true) {
      this.myclientnum = clientnum
      // console.log("scrollboard",y,this.state.scrolloffset);
      let newpos = /* this.curscrollpos+ */ y
      if (newpos < 0) newpos = 0
      this.setState({ curscrollpos: newpos })
      if (this.props.scrollposListener) this.props.scrollposListener(newpos)
    }
    if (x !== 0 || y !== 0 || this.forceredraw) {
      this.checkRedraw()
    }
  }

  calcCurpos(curscrollpos) {
    // console.log("calcCurpos pre",this.props.pageoffsetabsolute, this.props.pageoffset );
    if (this.props.pageoffsetabsolute) return this.props.pageoffset
    let pageoffset = 0
    if (this.props.pageoffset) pageoffset = this.props.pageoffset
    /* console.log(
      'calcCurpos',
      this.state.curscrollpos + pageoffset + this.state.scrolloffset,
      this.state.curscrollpos,
      pageoffset,
      this.state.scrolloffset
    ) */
    return (
      (curscrollpos || this.state.curscrollpos) +
      pageoffset +
      this.state.scrolloffset
    )
  }

  checkRedraw() {
    if (
      this.collection.suggestRedraw(
        this.rendermin,
        this.rendermax,
        this.calcCurpos(),
        this.calcCurpos() + this.scrollheight()
      ) ||
      this.forceredraw
    ) {
      // console.log("check redraw start 2");

      this.doRedraw()
    }
  }

  doRedraw() {
    this.forceredraw = false
    this.rendermin = this.rendermax =
      this.state.curscrollpos + this.state.scrolloffset
    // this.clear();
    this.work.objects = []
    this.setState({ objects: [], pathstarted: false, redrawing: true })
    console.log('Redraw!')
    this.redrawing = true // not to be confused with the state
    this.collection.redrawTo(
      this,
      this.calcCurpos() - 1.5,
      this.calcCurpos() + this.scrollheight() + 1.5
    )
    this.redrawing = false
    this.setState({ redrawing: false, objects: [...this.work.objects] })

    console.log('redraw done')
  }

  getCurScrollPos() {
    return this.state.curscrollpos
  }

  replaceData(data, callback) {
    if (data.data) {
      this.collection.replaceStoredData(data.number, data.data) // also do this only if the container is non empty
      console.log('replace data', data.number /* , data */)
      if (data.number === 'command') {
        const cs = this.collection.commandcontainer.getCurCommandState()
        if (callback) callback(cs) // calls the outgoing dispatcher
        if (cs.scrollx || cs.scrolly)
          this.scrollBoard(cs.time, 'data', cs.scrollx, cs.scrolly)
      }
    }
    this.rendermin = Math.min(data.number, this.rendermin)
    this.rendermax = Math.max(data.number + 1, this.rendermax)
    if (data.last) {
      this.rendermin = this.rendermax =
        this.state.curscrollpos + this.state.scrolloffset
      // this.clear();

      this.work.objects = [] // clear them
      this.setState((state) => ({
        objects: [...this.work.objects],
        pathstarted: false
      })) // flushForRedraw
      this.recpathstarted = false
      this.setState({ redrawing: true })
      this.redrawing = true // not to be confused with the state
      this.collection.redrawTo(
        this,
        this.calcCurpos() - 1.5,
        this.calcCurpos() + this.scrollheight() + 1.5
      )
      this.redrawing = false // not to be confused with the state
      this.setState({ redrawing: false, objects: [...this.work.objects] })

      console.log('Redraw! replace Data')
    }
  }

  receivePictInfo(data) {
    // console.log('receivepictureinfo', data)
    this.pictures[data.uuid] = data
  }

  receiveBgpdfInfo(data) {
    // console.log('receivebgpdfinfo', data)
    if (data.none) this.setState({ bgpdf: null })
    else if (data.url) this.setState({ bgpdf: data.url })
  }

  receiveFoG(data) {
    if (data.clientid === this.clientid) return
    let fogpos = {}
    if (!data.x && !data.y) fogpos = false
    else {
      fogpos = { x: data.x, y: data.y /* +state.curscrollpos */ }
    }
    if (this.spotlight.current) this.spotlight.current.setFogpos(fogpos)
  }

  preReceiveFoG(data) {
    if (data.clientid) this.clientid = data.clientid
    let fogpos = {}
    if (!data.x && !data.y) fogpos = false
    else {
      fogpos = { x: data.x, y: data.y /* +state.curscrollpos */ }
    }
    if (this.spotlight.current) this.spotlight.current.setFogpos(fogpos)
  }

  setcursor(args) {
    if (args.mode === 'drawing') {
      const svgscale = 2000
      this.setState({
        cursor: {
          mode: 'drawing',
          size: Math.max(args.size, (4 * svgscale) / this.props.bbwidth),
          color: args.color,
          alpha: args.alpha
        }
      })
    } else if (args.mode === 'picture') {
      this.setState({
        cursor: { mode: 'picture' }
      })
    } else if (args.mode === 'laserpointer') {
      this.setState({
        cursor: { mode: 'laserpointer' }
      })
    } else if (args.mode === 'menu') {
      this.setState({
        cursor: { mode: 'menu' }
      })
    } else if (args.mode === 'magic') {
      this.setState({
        cursor: { mode: 'magic' }
      })
    }
  }

  cursor() {
    if (!this.state.cursor) return 'auto'
    if (this.state.cursor.mode === 'laserpointer') return 'none'
    if (this.state.cursor.mode === 'picture') return 'crosshair'
    if (this.state.cursor.mode === 'magic') {
      return ['crosshair']
    }
    if (this.state.cursor.mode !== 'drawing') return 'auto'
    const svgscale = 2000
    const circleradius =
      (this.state.cursor.size * 0.5 * this.props.bbwidth) / svgscale
    let color = this.state.cursor.color

    if (typeof color === 'string' || color instanceof String)
      color = color.replace('#', '%23')

    let alpha = 1.0
    if (this.state.cursor.alpha) alpha = this.state.cursor.alpha

    const vw = 2.1 * circleradius
    const vh = 2.1 * circleradius
    const vbx1 = -1.05 * circleradius
    const vby1 = -1.05 * circleradius
    return [
      `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${vw}" height="${vh}" viewBox="${vbx1} ${vby1} ${vw} ${vh}"><circle cx="0" cy="0" r="${circleradius}" style="fill:${color};fill-opacity:${alpha};stroke:black"/></svg>') ${circleradius} ${circleradius}`,
      'crosshair'
    ]
  }

  renderObjectsWithCache(el) {
    return this.renderObjects(true, el)
  }

  renderObjectsWithoutCache(el) {
    return this.renderObjects(false, el)
  }

  renderObjects(usecache, el) {
    let zindex = el.preview ? 10 : 50
    if (this.props.zOffset) zindex += this.props.zOffset
    const key = el.objid
    let rendercache = el.getRenderCache(key)
    if (!rendercache || !usecache) {
      if (el.type === 'glyph') {
        rendercache = (
          <SVGWriting2
            glyph={el}
            key={key}
            backcolor={this.props.backcolor}
            pixelwidth={this.props.bbwidth}
            zIndex={zindex}
            predraw={el.preview}
          ></SVGWriting2>
        )
      } else if (el.type === 'image') {
        let ox = 0
        let oy = 0
        if (el.preshift) {
          ox = el.preshift.x
          oy = el.preshift.y
        }
        rendercache = (
          <ImageHelper
            selected={el.isSelected()}
            x={(el.posx + ox) * this.props.bbwidth}
            y={(el.posy + oy) * this.props.bbwidth}
            zIndex={zindex}
            width={el.width * this.props.bbwidth}
            height={el.height * this.props.bbwidth}
            url={el.url}
            urlthumb={el.urlthumb}
            uuid={el.uuid}
            key={key}
          ></ImageHelper>
        )
      } else if (el.type === 'form') {
        let ox = 0
        let oy = 0
        if (el.preshift) {
          ox = el.preshift.x
          oy = el.preshift.y
        }
        rendercache = (
          <FormHelper
            selected={el.isSelected()}
            x={(el.posx + ox) * this.props.bbwidth}
            y={(el.posy + oy) * this.props.bbwidth}
            zIndex={zindex}
            width={el.width * this.props.bbwidth}
            height={el.height * this.props.bbwidth}
            type={el.formtype}
            bColor={el.bColor}
            fColor={el.fColor}
            lw={el.lw * this.props.bbwidth}
            key={key}
          ></FormHelper>
        )
      } else {
        console.log('unknown drawing', el)
        rendercache = <React.Fragment key={key}></React.Fragment>
      }
      // console.log('cache miss')
      el.setRenderCache(key, rendercache)
      // console.log('cache miss fix ', el)
    }
    return rendercache
  }

  renderFilter(el) {
    return !(el.objid in this.preworkobj)
  }

  render() {
    let zoffset = 0
    if (this.props.zOffset) zoffset += this.props.zOffset
    let cursor = 'auto'
    if (this.props.isnotepad) cursor = this.cursor()
    let usecache = true
    if (
      this.lastrenderprops.bbwidth !== this.props.bbwidth ||
      this.lastrenderprops.backcolor !== this.props.backcolor
    ) {
      usecache = false
    }
    this.lastrenderprops = {
      bbwidth: this.props.bbwidth,
      backcolor: this.props.backcolor
    }

    // console.log("render ob", this.state.objects);
    const written = this.state.objects
      .filter(this.renderFilter)
      .map(
        usecache ? this.renderObjectsWithCache : this.renderObjectsWithoutCache
      )

    const pwobj = []
    for (const prop in this.preworkobj) {
      const key = 'pre' + prop
      let rendercache = this.preworkobj[prop].getRenderCache(key)
      if (!rendercache || !usecache) {
        rendercache = (
          <SVGWriting2
            glyph={this.preworkobj[prop]}
            backcolor={this.props.backcolor}
            pixelwidth={this.props.bbwidth}
            zIndex={50 + zoffset}
            preview={true}
            key={key}
          >
            {' '}
          </SVGWriting2>
        )
        this.preworkobj[prop].setRenderCache(key, rendercache)
      }
      pwobj.push(rendercache)
    }

    const stylespan = {
      position: 'absolute',
      left: 0.0 * this.props.bbwidth + 'px',
      top: -this.calcCurpos() * this.props.bbwidth + 'px'
    }

    const ystart = this.calcCurpos()
    const yend = this.calcCurpos() + this.scrollheight()
    return (
      <div
        className={this.props.backclass}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          left: '0px',
          top: '0px',
          cursor,
          overscrollBehavior: 'none',
          touchAction: 'none',
          backgroundPosition: '0px ' + stylespan.top
        }}
        onWheel={(event) => {
          if (this.props.reportScroll) {
            this.props.reportScroll(event.deltaY / this.props.bbwidth)
          }
        }}
      >
        {this.state.bgpdf && (
          <BackgroundPDF
            url={this.state.bgpdf}
            ystart={ystart}
            yend={yend}
            bbwidth={this.props.bbwidth}
            zIndex={9 + zoffset}
          >
            {' '}
          </BackgroundPDF>
        )}
        {!this.state.redrawing && (
          <span style={stylespan}>
            {written}
            {pwobj}
            {this.props.addformpict?.url && (
              <ImageHelper
                x={this.props.addformpict.posx * this.props.bbwidth}
                y={this.props.addformpict.posy * this.props.bbwidth}
                zIndex={50 + zoffset}
                width={this.props.addformpict.width * this.props.bbwidth}
                height={this.props.addformpict.height * this.props.bbwidth}
                url={this.props.addformpict.url}
                uuid={this.props.addformpict.uuid}
                ref={this.addformpictobj}
              ></ImageHelper>
            )}
            {this.props.addformpict?.formType && (
              <FormHelper
                x={this.props.addformpict.posx * this.props.bbwidth}
                y={this.props.addformpict.posy * this.props.bbwidth}
                zIndex={50 + zoffset}
                width={this.props.addformpict.width * this.props.bbwidth}
                height={this.props.addformpict.height * this.props.bbwidth}
                type={this.props.addformpict.formType}
                bColor={ToRGBANumber(this.props.addformpict.bColor)}
                fColor={ToRGBANumber(this.props.addformpict.fColor)}
                lw={this.props.addformpict.lw}
                ref={this.addformpictobj}
                helplines={true}
              ></FormHelper>
            )}
            {this.magicobject &&
              this.magicobject.getRenderObject({
                zIndex: 51 + zoffset /* z Index */,
                pixelwidth: this.props.bbwidth
              })}

            <SVGSpotlight
              ref={this.spotlight}
              bbwidth={this.props.bbwidth}
              zIndex={51 + zoffset}
            ></SVGSpotlight>
          </span>
        )}
      </div>
    )
  }
}
