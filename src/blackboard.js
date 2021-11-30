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
  NetworkSource,
  NetworkSink,
  Dispatcher,
  Collection,
  MemContainer,
  DrawObjectGlyph,
  DrawObjectPicture
} from '@fails-components/data'
import { SHA1 } from 'jshashes'
import Color from 'color'

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js'
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.entry'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker

window.addEventListener('contextmenu', function (e) {
  e.preventDefault()
  e.stopPropagation()
  return false
})

export class SVGWriting extends Component {
  render() {
    /* { color:  this.state.workcolor, alpha: , objnum: this.state.workobjnum ,
                 path: path ,
                 startradius: this.state.workstartradius, endpoint: {x: wx-sx, y: wy-sy },
                endradius: this.curpenwidth   } */
    // <svg viewBox="-20 -20 40 40" width="100%" height="100%">
    // console.log(this.props.glyph);
    const glyph = this.props.glyph
    const viewbox =
      Math.round(glyph.workarea.left) +
      ' ' +
      Math.round(glyph.workarea.top) +
      ' ' +
      Math.round(glyph.workarea.right - glyph.workarea.left) +
      ' ' +
      Math.round(glyph.workarea.bottom - glyph.workarea.top) +
      ' '
    // svgscale={this.svgscale} pixelwidth={this.pixelwidth}
    // console.log("svgscale",this.props.svgscale);
    // console.log("pixelwidth",this.props.pixelwidth);
    const style = {
      position: 'absolute',
      zIndex: this.props.zIndex,
      left:
        Math.round(
          ((glyph.workarea.left + glyph.startpoint.x) * this.props.pixelwidth) /
            this.props.svgscale
        ) + 'px',
      width:
        Math.round(
          ((glyph.workarea.right - glyph.workarea.left) *
            this.props.pixelwidth) /
            this.props.svgscale
        ) + 'px',
      top:
        Math.round(
          ((glyph.workarea.top + glyph.startpoint.y) * this.props.pixelwidth) /
            this.props.svgscale
        ) + 'px',
      height:
        Math.round(
          ((glyph.workarea.bottom - glyph.workarea.top) *
            this.props.pixelwidth) /
            this.props.svgscale
        ) + 'px',
      pointerEvents: 'none'
    }
    // console.log("tyle",style);
    // console.log("workarea",glyph.workarea);

    return (
      <svg viewBox={viewbox} style={style}>
        <circle
          cx={0}
          cy={0}
          r={glyph.startradius}
          stroke='none'
          fill={glyph.color}
          fillOpacity={glyph.alpha}
        ></circle>
        {glyph.endpoint && (
          <circle
            cx={glyph.endpoint.x}
            cy={glyph.endpoint.y}
            r={glyph.endradius}
            stroke='none'
            fill={glyph.color}
            fillOpacity={glyph.alpha}
          ></circle>
        )}

        {glyph.path && (
          <path
            d={glyph.path}
            stroke='none'
            fill={glyph.color}
            fillOpacity={glyph.alpha}
          ></path>
        )}
      </svg>
    )
  }
}

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
      if (
        Color(this.props.backcolor).isLight() &&
        Color(glyph.color).luminosity() > 0.9
      ) {
        stroke = 'black'
        // console.log("stroke changed to black");
      } /* else if (
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

    const style = {
      position: 'absolute',
      zIndex: this.props.zIndex,
      left:
        Math.round(
          ((glyph.area.left + sx) * this.props.pixelwidth) / glyph.svgscale
        ) + 'px',
      width:
        Math.round(
          ((glyph.area.right - glyph.area.left) * this.props.pixelwidth) /
            glyph.svgscale
        ) + 'px',
      top:
        Math.round(
          ((glyph.area.top + sy) * this.props.pixelwidth) / glyph.svgscale
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

    return (
      <svg viewBox={viewbox} style={style}>
        {pathstring && (
          <path
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
    this.setState({ fogpos: fogpos })
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
    const style = {
      position: 'absolute',
      zIndex: this.props.zIndex,
      left: this.props.x + 'px',
      top: this.props.y + 'px',
      userSelect: 'none',
      pointerEvents: 'none'
    }

    if (this.props.width) style.width = this.props.width + 'px'
    if (this.props.height) style.height = this.props.height + 'px'

    return (
      <img
        src={this.props.url}
        alt={this.props.uuid}
        style={style}
        onLoad={this.imageLoaded}
      ></img>
    )
  }
}

export class BackgroundPDFPage extends Component {
  constructor(props) {
    super(props)
    this.state = {}
    this.canvas = React.createRef()
  }

  componentDidMount() {
    this.renderPage()
  }

  componentDidUpdate() {
    this.renderPage()
  }

  async renderPage() {
    // if (this.state.rendered) return;
    if (
      this.state.page === this.props.page &&
      this.state.bbwidth === this.props.bbwidth
    )
      return

    if (!this.canvas.current) return
    if (this.inrendering) return
    this.inrendering = true

    const canvas = this.canvas.current

    const page = this.props.page
    const bbwidth = this.props.bbwidth
    // console.log("props page",this.props.page);

    // console.log("page height debug ",this.props.bbwidth , this.props.page.height);
    console.log(
      'getvp width bbwidth',
      page.pageobj.getViewport({ scale: 1.0 }).width,
      bbwidth
    )
    const viewport = page.pageobj.getViewport({
      scale: bbwidth / page.pageobj.getViewport({ scale: 1.0 }).width
    })
    console.log('viewport', viewport)

    canvas.height = viewport.height
    canvas.width = viewport.width

    const context = canvas.getContext('2d')

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    }
    context.clearRect(0, 0, canvas.width, canvas.height)

    // console.log("render page before ", page.pagenum);
    const renderTask = page.pageobj.render(renderContext)
    try {
      await renderTask.promise
      console.log('Render pdf page ', page.pagenum)
      this.inrendering = false

      this.setState({ page: page, bbwidth: bbwidth })
    } catch (error) {
      console.log('problem pdf page render', error)
      this.inrendering = false
    }
  }

  render() {
    const style = {
      position: 'absolute',
      zIndex: this.props.zIndex,
      left: 0 + 'px',
      top:
        (this.props.page.from - this.props.ystart) * this.props.bbwidth + 'px',
      userSelect: 'none',
      pointerEvents: 'none'
    }

    return (
      <canvas
        ref={this.canvas}
        key={this.props.page.pagenum + 'cpage'}
        style={style}
      >
        {' '}
      </canvas>
    )
  }
}

export class BackgroundPDF extends Component {
  constructor(props) {
    super(props)
    this.state = {}
  }

  async loadPDF() {
    if (this.props.url !== this.state.url) {
      try {
        // ok we have to load
        const pdf = await pdfjs.getDocument(this.props.url).promise
        // console.log("pdf", pdf);
        if (pdf) this.pdf = pdf
        // now we have the pdf, we have to get information about the available pages
        let pageinfo = []
        for (let pagenum = 1; pagenum <= pdf.numPages; pagenum++) {
          const helpfunc = async (pn) => {
            const page = await pdf.getPage(pn)
            const dimen = page.getViewport({ scale: 2000 })

            return {
              pagenum: pn,
              pageobj: page,
              height: dimen.height / dimen.width
            }
          }
          pageinfo.push(helpfunc(pagenum))
        }
        pageinfo = await Promise.all(pageinfo)
        // perfect now we can calculate from tos
        let curpos = 0
        for (let pidx = 0; pidx < pageinfo.length; pidx++) {
          pageinfo[pidx].from = curpos
          curpos += pageinfo[pidx].height
          pageinfo[pidx].to = curpos
        }
        this.setState({ pageinfo: pageinfo, url: this.props.url })
      } catch (error) {
        console.log('loadPDF failed', error)
      }
    }
  }

  componentDidMount() {
    this.loadPDF()
  }

  render() {
    this.loadPDF()

    const pages = this.state.pageinfo

    let curpages = []
    // console.log("background pdf render", pages);
    if (pages) {
      // console.log("pages",pages);
      // console.log("ystart, yend",this.props.ystart, this.props.yend );

      curpages = pages.filter(
        (el) =>
          !(
            (el.from > this.props.yend && el.to > this.props.yend) ||
            (el.from < this.props.ystart && el.to < this.props.ystart)
          )
      )

      // console.log("curpages",curpages);
      curpages = curpages.map((el) => (
        <BackgroundPDFPage
          page={el}
          ystart={this.props.ystart}
          key={el.pagenum + 'page'}
          bbwidth={this.props.bbwidth}
          zIndex={this.props.zIndex}
        ></BackgroundPDFPage>
      ))
    }

    return <div>{curpages}</div>
  }
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
    this.workobj = {}

    this.preworkobj = {}

    this.addpictimage = React.createRef()
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

    this.incomdispatcher = new Dispatcher()
    this.incomdispatcher.addSink(this) // we also want to draw everything
    this.collection = new Collection(function (id, data) {
      return new MemContainer(id, data)
    }, {})
    this.incomdispatcher.addSink(this.collection)

    this.networkreceive = new NetworkSource(this.incomdispatcher)

    this.lastbbtemp = null

    this.lastrenderprops = {}

    this.lastrpd = Date.now()

    // stage.addChild(this.blackboardtemp);

    this.pathstarted = this.pathupdated = false

    this.stage = props.stage

    this.stepDrawVersion = this.stepDrawVersion.bind(this)
    this.renderObjectsWithCache = this.renderObjectsWithCache.bind(this)
    this.renderObjectsWithoutCache = this.renderObjectsWithoutCache.bind(this)
    this.renderFilter = this.renderFilter.bind(this)
    console.log('Blackboard start up completed!')
    this.updateObjects = this.updateObjects.bind(this)
    this.updateObjectsId = setInterval(this.updateObjects, 40)
    this.isdirty = false
  }

  updateObjects() {
    if (this.isdirty) {
      this.setState(this.stepDrawVersion)
      this.isdirty = false
    }
    if (this.objdirty) {
      this.setState({
        objects: this.work.objects.concat()
      })
      this.objdirty = false
    }
  }

  componentDidUpdate(prevprops) {
    if (
      !isNaN(this.props.pageoffset) &&
      prevprops.pageoffset !== this.props.pageoffset
    ) {
      this.checkRedraw()
    }
  }

  toolbox() {
    if (this.props.notepadscreen && this.props.notepadscreen.toolbox)
      return this.props.notepadscreen.toolbox.current
  }

  scrollheight() {
    return this.props.bbheight / this.props.bbwidth
  }

  curPictAspect() {
    let aspect = 1
    if (this.addpictimage.current) aspect = this.addpictimage.current.Aspect()
    return aspect
  }

  setScrollOffset(scrolloffset) {
    this.setState({ scrolloffset: scrolloffset })
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
        pictinfo.mimetype
      )

      this.work.objects.push(addpict)

      this.setState({ objects: this.work.objects.concat() })
    }

    // resubmitpath
  }

  stepDrawVersion(state) {
    return { drawversion: state.drawversion + 1 }
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
      if (this.toolbox() && now - this.lastrpd > 200) {
        // this is quite expensive, do not do this during a redraw, but this is never a redraw
        this.lastrpd = now
        this.toolbox().reportDrawPos(
          x,
          y - this.state.curscrollpos - this.state.scrolloffset
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
      // console.log("scrollboard",y,this.state.scrolloffset);
      let newpos = /* this.curscrollpos+ */ y
      if (newpos < 0) newpos = 0
      this.setState({ curscrollpos: newpos })
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
    }
    if (x !== 0 || y !== 0 || this.forceredraw) {
      this.checkRedraw()
    }
  }

  calcCurpos() {
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
    return this.state.curscrollpos + pageoffset + this.state.scrolloffset
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

  getCalcScrollPos() {
    return this.state.curscrollpos + this.state.scrolloffset
  }

  receiveData(data) {
    // console.log("receivedata!");

    // console.log("Blackboard receive data",data);
    this.networkreceive.receiveData(data)
  }

  replaceData(data, callback) {
    if (data.data) {
      this.collection.replaceStoredData(data.number, data.data) // also do this only if the container is non empty
      console.log('replace data', data.number /* , data */)
      if (data.number === 'command') {
        const cs = this.collection.commandcontainer.getCurCommandState()
        if (callback) callback(cs) // calls the outgoing dispatcher
        console.log('replace data command' /*, cs */)
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
      this.setState({
        cursor: {
          mode: 'drawing',
          size: Math.max(args.size, 4),
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
    }
  }

  cursor() {
    if (!this.state.cursor) return 'auto'
    if (this.state.cursor.mode === 'laserpointer') return 'none'
    if (this.state.cursor.mode === 'picture') return 'crosshair'
    if (this.state.cursor.mode !== 'drawing') return 'auto'
    const circleradius = this.state.cursor.size * 0.5
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
            zIndex={el.preview ? 10 : 50}
            predraw={el.preview}
          ></SVGWriting2>
        )
      } else if (el.type === 'image') {
        rendercache = (
          <ImageHelper
            x={el.posx * this.props.bbwidth}
            y={el.posy * this.props.bbwidth}
            zIndex={el.preview ? 10 : 50}
            width={el.width * this.props.bbwidth}
            height={el.height * this.props.bbwidth}
            url={el.url}
            uuid={el.uuid}
            key={key}
          ></ImageHelper>
        )
      } else {
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
    /*   const wobj = []
    for (const prop in this.workobj) {
      if (!this.preworkobj[prop]) {
        const key = 'work' + prop
        let rendercache = this.workobj[prop].getRenderCache(key)
        if (!rendercache || !usecache) {
          rendercache = (
            <SVGWriting2
              glyph={this.workobj[prop]}
              backcolor={this.props.backcolor}
              pixelwidth={this.props.bbwidth}
              zIndex={50}
              predraw={true}
              key={key}
            >
              {' '}
            </SVGWriting2>
          )
          this.workobj[prop].setRenderCache(key, rendercache)
        }

        wobj.push(rendercache)
      }
    } */

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
            zIndex={50}
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
        style={{
          backgroundColor: this.props.backcolor,
          width: '100%',
          height: '100%',
          cursor: cursor,
          overscrollBehavior: 'none',
          touchAction: 'none'
        }}
      >
        {this.state.bgpdf && (
          <BackgroundPDF
            url={this.state.bgpdf}
            ystart={ystart}
            yend={yend}
            bbwidth={this.props.bbwidth}
            zIndex={9}
          >
            {' '}
          </BackgroundPDF>
        )}
        {!this.state.redrawing && (
          <span style={stylespan}>
            {written}
            {pwobj}
            {this.props.addpict && (
              <ImageHelper
                x={this.props.addpict.posx * this.props.bbwidth}
                y={this.props.addpict.posy * this.props.bbwidth}
                zIndex={50}
                width={this.props.addpict.width * this.props.bbwidth}
                height={this.props.addpict.height * this.props.bbwidth}
                url={this.props.addpict.url}
                uuid={this.props.addpict.uuid}
                ref={this.addpictimage}
              ></ImageHelper>
            )}

            <SVGSpotlight
              ref={this.spotlight}
              bbwidth={this.props.bbwidth}
              zIndex={51}
            ></SVGSpotlight>
          </span>
        )}
      </div>
    )
  }
}

export class BlackboardNotepad extends Component {
  constructor(
    props // (stage, width, height,backcolor, notepadscreen)
  ) {
    super(props)
    // interactive class
    this.state = { addpictmode: 0 }

    this.curkeyscroll = 0

    this.realblackboard = React.createRef()

    this.outgodispatcher = new Dispatcher()
    // this.outgodispatcher.blocked = true // we block initially, not any more

    const locnotepadscreen = this.props.notepadscreen
    this.networksender = new NetworkSink(function (data) {
      locnotepadscreen.netSend('drawcommand', data)
    })
    this.outgodispatcher.addSink(this.networksender)

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

    this.interactive = true
    // props.stage.interactive=true;

    this.mousepathstarted = false

    this.lastkeyscrolltime = Date.now()

    this.rightmousescroll = false
    this.rightmousescrollx = 0
    this.rightmousescrolly = 0

    // properties of the current tool
    this.toolcolor = 0
    this.toolsize = 10
    this.tooltype = 0

    this.addpictmode = 0 // stage of adding picture
    this.addpictuuid = null
    this.addpictsprite = null

    this.pointerdown = this.pointerdown.bind(this)
    this.pointermove = this.pointermove.bind(this)
    this.pointerup = this.pointerup.bind(this)
    this.wheel = this.wheel.bind(this)
    this.curPictAspect = this.curPictAspect.bind(this)
    this.calcAddPictSize = this.calcAddPictSize.bind(this)
    this.processEvent = this.processEvent.bind(this)
    this.processPointerReject = this.processPointerReject.bind(this)

    this.pointerRejectInterval = setInterval(this.processPointerReject, 100)

    this.mainDiv = React.createRef()
  }

  preventDefault(e) {
    // work around for apple ios
    e.preventDefault()
  }

  setblocked(isblocked) {
    if (this.outgodispatcher) {
      this.outgodispatcher.blocked = isblocked
      console.log('dispatcher blocked', this.outgodispatcher.blocked)
    }
  }

  toolbox() {
    if (this.props.notepadscreen && this.props.notepadscreen.toolbox)
      return this.props.notepadscreen.toolbox.current
  }

  confirmbox() {
    if (this.props.notepadscreen && this.props.notepadscreen.confirmbox)
      return this.props.notepadscreen.confirmbox.current
  }

  curPictAspect() {
    if (this.realblackboard && this.realblackboard.current)
      return this.realblackboard.current.curPictAspect()
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
    // this.scrolloffset=scrolloffset; // I believe we will need this for incoming pointer events no it is already delegated to realblackboard uff
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

  addUndo(objid, storagenum) {
    if (objid && Number.isInteger(storagenum)) {
      if (this.toolbox()) {
        this.toolbox().setCanUndo(true)
      }
      this.undostack.push({ objid: objid, storagenum: storagenum })
    }
    if (this.undostack.length > 20) this.undostack.shift()
  }

  undo() {
    if (this.undostack.length > 0) {
      const element = this.undostack.pop()
      this.outgodispatcher.deleteObject(
        null,
        element.objid,
        null,
        element.storagenum
      )
      if (this.undostack.length === 0 && this.toolbox()) {
        this.toolbox().setCanUndo(false)
      }
    }
  }

  checkPalmReject(event) {
    const now = event.timeStamp
    // detect if device really reports values that made sense, for example wacom tells nonsense
    if (this.lastpalmw !== event.width || this.lastpalmh !== event.height) {
      this.lastpalmw = event.width
      this.lastpalmh = event.height

      if (event.width * event.height > 45 * 45) {
        console.log('palm detected', event.width, event.height)
        return true
      } else {
        // console.log('nopalm detected', event.width, event.height)
      }
    }
    if (
      now - this.lastTouchTime < 500 &&
      event.pointerId !== this.lastTouchPointerId
    ) {
      // preparation for better palm detection, off for now
      const x = event.clientX - this.lastTouchPos.x
      const y = -(event.clientY - this.lastTouchPos.y)
      const degrees = (Math.atan2(y, x) * 180) / Math.PI
      const distance = Math.sqrt(x * x + y * y)
      const palmdegreemin = -90
      const palmdegreemax = 0

      if (
        distance * window.devicePixelRatio > 200 &&
        degrees > palmdegreemin &&
        degrees < palmdegreemax
      ) {
        console.log('degree palm rejection', distance, degrees)
        return true
      } // else console.log('degree debug', distance, degrees, x, y)
    }

    if (
      now - this.lastPenEvent < 5 * 1000 ||
      this.lastPenEvent + 500 > now /* || !event.isPrimary */
    ) {
      console.log('pen blocks touch')
      return true // no touchy touchy
    }
    return false
  }

  processPointerReject() {
    this.pointerrejectcheck = this.pointerrejectcheck.filter((el) => {
      if (el.time - 600 > this.lastTouchTime) return false
      if (el.check && el.check > 6) return false
      if (!el.check) el.check = 1
      else el.check++
      if (this.checkPalmReject(el.event)) {
        console.log('palm object dismissed retro active')
        this.outgodispatcher.deleteObject(null, el.objid, null, el.storagenum)
        delete this.pointerdraw[el.event.pointerId]
        delete this.pointerobjids[el.event.pointerId]
        delete this.pointerobjnum[el.event.pointerId]
        delete this.pointerstoragenum[el.event.pointerId]
        return false
      } else return true
    }, this)
    // if (this.pointerrejectcheck.length > 0)
    //  console.log('pPR size', this.pointerrejectcheck.length)
  }

  async pointerdown(event) {
    console.log('pointerdown', event)
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
    }

    if (this.laserpointer && this.addpictmode === 0) return

    const pos = { x: event.clientX, y: event.clientY }
    this.rightmousescroll = false

    if (event.pointerId in this.pointerdraw === true) {
      // finish stale paths
      const objid = this.pointerobjids[event.pointerId]
      this.outgodispatcher.finishPath(null, objid, null)
      if (this.realblackboard && this.realblackboard.current)
        this.realblackboard.current.preFinishPath(null, objid, null)

      delete this.pointerdraw[event.pointerId]
      delete this.pointerobjids[event.pointerId]
      delete this.pointerobjnum[event.pointerId]
      delete this.pointerstoragenum[event.pointerId]
    }

    if (event.pointerId in this.pointerdraw === false) {
      this.pointerdraw[event.pointerId] = 1

      if (this.addpictmode !== 0) {
        switch (this.addpictmode) {
          case 4:
            // this.addpictsprite.
            // this.addpictsprite.position=pos;
            this.setState({
              addpictposx: pos.x / this.props.bbwidth,
              addpictposy: pos.y / this.props.bbwidth + this.getCalcScrollPos(),
              // addpictmode: 3 /* for drawing */
              addpictmode: 2 /* for drawing */
            })
            // this.addpictmode = 3
            this.lastpictmovetime = now
            // break
            // case 3:
            this.addpictmode = 2
            // this.setState({ addpictmode: 2 })
            this.addPictureMovePos({ x: pos.x + 200, y: pos.y + 200 }, true)

            break
          default:
            // do nothing
            break
        }
      } else {
        // console.log( "startpath check",pos.x,this.props.bbwidth,pos.y,this.props.bbwidth );
        // console.log("startpath tool check", this.toolcolor, this.toolsize,this.props.bbwidth);
        // ok we have to generate an objid
        this.objnum++
        this.pointerobjnum[event.pointerId] = this.objnum
        this.lastpos[event.pointerId] = pos
        const objid = this.calcObjId(event.pointerId)
        this.pointerobjids[event.pointerId] = objid
        this.pointerstoragenum[event.pointerId] = Math.floor(
          pos.y / this.props.bbwidth + this.getCalcScrollPos()
        )
        // console.log("objid",objid);
        this.outgodispatcher.startPath(
          null,
          objid,
          null,
          pos.x / this.props.bbwidth,
          pos.y / this.props.bbwidth + this.getCalcScrollPos(),
          this.tooltype,
          Color(this.toolcolor).rgbNumber(),
          (this.toolsize / this.props.bbwidth) * this.props.devicePixelRatio,
          event.pressure
        )
        if (this.realblackboard && this.realblackboard.current)
          this.realblackboard.current.preStartPath(
            null,
            objid,
            null,
            pos.x / this.props.bbwidth,
            pos.y / this.props.bbwidth + this.getCalcScrollPos(),
            this.tooltype,
            Color(this.toolcolor).rgbNumber(),
            (this.toolsize / this.props.bbwidth) * this.props.devicePixelRatio,
            event.pressure
          )
        if (event.pointerType === 'touch') {
          this.pointerrejectcheck.push({
            time: event.timeStamp,
            objid: this.pointerobjids[event.pointerId],
            event: event,
            storagenum: this.pointerstoragenum[event.pointerId]
          })
        }

        // console.log("props.devicePixelRatio", this.props.devicePixelRatio);

        this.mousepathstarted = true
        // console.log("mousedownbb");
      }
    }
  }

  rightdown(event) {
    // console.log("rightdown1");

    this.rightmousescrollx = event.screenX
    this.rightmousescrolly = event.screenY
    this.rightmousescroll = true
    this.rightmousescrollpos = this.getCalcScrollPos()
    // console.log("rightdown");
    this.mouseidentifier = null
  }

  calcAddPictSize(state, pos) {
    const aspectratio = this.curPictAspect()
    let nx = pos.x / this.props.bbwidth - state.addpictposx
    let ny =
      pos.y / this.props.bbwidth + this.getCalcScrollPos() - state.addpictposy
    if (nx === 0) nx = 0.001
    if (ny === 0) ny = 0.001
    if (nx > ny) {
      nx = ny * aspectratio
    } else {
      ny = nx / aspectratio
    }
    return { nx: nx, ny: ny }
  }

  addPictureMovePos(pos, reactivate) {
    this.setState((state) => {
      const size = this.calcAddPictSize(state, pos)
      if (reactivate) {
        this.confirmbox().reactivate({
          x: state.addpictposx + /* this.state.addpictwidth */ size.nx,
          y:
            state.addpictposy +
            /* this.state.addpictheight */ size.ny -
            this.getCalcScrollPos()
        })
      } else {
        this.confirmbox().setPosition({
          x: state.addpictposx + /* this.state.addpictwidth */ size.nx,
          y:
            state.addpictposy +
            /* this.state.addpictheight */ size.ny -
            this.getCalcScrollPos()
        })
      }
      return { addpictwidth: size.nx, addpictheight: size.ny }
    })
  }

  fogHandle(x, y, pointerid, now) {
    const newtime = now

    if (!this.fogtime[pointerid]) {
      this.fogtime[pointerid] = newtime
      this.lastfogpos[pointerid] = { x: x, y: y }
      return
    }

    const timeelapsed = (newtime - this.fogtime[pointerid]) / 1000
    if (timeelapsed > 0.05) {
      //
      this.fogtime[pointerid] = newtime

      /*  const lfp = this.lastfogpos[pointerid]
      let distance = 0
      if (lfp) distance = (x - lfp.x) * (x - lfp.x) + (y - lfp.y) * (y - lfp.y)
      this.lastfogpos[pointerid] = { x: x, y: y }

      const velocity = Math.sqrt(distance / timeelapsed / timeelapsed) // this is velocity squared
      if (!this.fogmeanvel[pointerid]) this.fogmeanvel[pointerid] = 0
      this.fogmeanvel[pointerid] =
        this.fogmeanvel[pointerid] * 0.66 + 0.33 * velocity */

      /* console.log('fog ' + this.fogmeanvel[pointerid], timeelapsed, velocity)
      console.log(
        'FoG scrolloffset',
        y,
        this.state.curscrollpos,
        this.state.scrolloffset
      ) */
      this.props.notepadscreen.reportFoG(x, y, this.clientId)
      if (this.realblackboard && this.realblackboard.current)
        this.realblackboard.current.preReceiveFoG({
          x: x,
          y: y,
          clientid: this.clientId
        })

      /*  if (this.fogmeanvel[pointerid] > 0.7) {
        this.fogontime = newtime
        this.props.notepadscreen.reportFoG(x, y, this.clientId)
        if (this.realblackboard && this.realblackboard.current)
          this.realblackboard.current.preReceiveFoG({
            x: x,
            y: y,
            clientid: this.clientId
          })
      } else {
        if (this.fogontime && newtime - this.fogontime > 2000) {
          this.fogontime = null
          this.props.notepadscreen.reportFoG(null, null, this.clientId)
          if (this.realblackboard && this.realblackboard.current)
            this.realblackboard.current.preReceiveFoG({
              x: null,
              y: null,
              clientid: this.clientId
            })
        } else if (this.fogontime) {
          this.props.notepadscreen.reportFoG(x, y, this.clientId)
          if (this.realblackboard && this.realblackboard.current)
            this.realblackboard.current.preReceiveFoG({
              x: x,
              y: y,
              clientid: this.clientId
            })
        }
      } */
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
        // console.log("distance check,",distance,pos.x,pos.y,pos.x/this.props.bbwidth,pos.y/this.props.bbwidth+this.getCurScrollPos()  );
        this.outgodispatcher.addToPath(
          null,
          objid,
          null,
          pos.x / this.props.bbwidth,
          pos.y / this.props.bbwidth + this.getCalcScrollPos(),
          mevent.pressure
        )
        if (this.realblackboard && this.realblackboard.current)
          // preview
          this.realblackboard.current.preAddToPath(
            null,
            objid,
            null,
            pos.x / this.props.bbwidth,
            pos.y / this.props.bbwidth + this.getCalcScrollPos(),
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
  }

  pointermove(event) {
    const now = event.timeStamp
    /* console.log("pointermove",event);
        console.log("pointerId:",event.pointerId,
                "pointerType",event.pointerType,
                "isPrimary",event.isPrimary,
                "width",event.width,
                "height",event.height,
                "button",event.button,
                "cX",event.clientX,
                "cY",event.clientY); */

    if (!this.rightmousescroll) {
      if (event.pointerId in this.pointerdraw === true && !this.laserpointer) {
        if (event.pointerType === 'touch') {
          if (this.checkPalmReject(event)) {
            // dismiss object
            console.log('palm object dismissed')
            this.outgodispatcher.deleteObject(
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
        }
        if (event.pointerType === 'pen' /* || event.pointerType === 'mouse' */)
          // also applies to mouse, behaviour of some wacom tablet in the not windows ink mode
          // no is not true in this case it is a mixure of mouse and touch events emulating the pen
          // this would not work
          this.lastPenEvent = now
        // if (event.pointerType === 'touch') {
        // always use writing pos for orientation
        this.lastTouchPos = { x: event.clientX, y: event.clientY }
        this.lastTouchTime = now
        this.lastTouchPointerId = event.pointerId
        // }
        /* console.log("pointerdraw", this.pointerdraw[event.pointerId]);
           console.log("last pos",this.lastpos );
           console.log("pointer id", event.pointerId);
           console.log("lastpos",this.lastpos[event.pointerId]); */
        this.pointerdraw[event.pointerId]++
        if (typeof event.nativeEvent.getCoalescedEvents === 'function') {
          // are coalesced events supported, yes now process them all
          const coalevents = event.nativeEvent.getCoalescedEvents()
          coalevents.forEach(this.processEvent)
          this.pointerdraw[event.pointerId] += coalevents.length
        }
        this.processEvent(event)
      } else if (this.addpictmode !== 0) {
        const pos = { x: event.clientX, y: event.clientY }
        if (now - this.lastpictmovetime > 25) {
          // console.log('createmousemovement', pos)
          switch (this.addpictmode) {
            case 4:
              this.setState({
                addpictposx: pos.x / this.props.bbwidth,
                addpictposy:
                  pos.y / this.props.bbwidth + this.getCalcScrollPos()
              })
              break
            case 3:
              this.addPictureMovePos(pos)
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
        // console.log("Fog out BB",pos.x,this.props.bbwidth,pos.y,this.props.bbwidth,event.data,this);
        if (this.laserpointer)
          this.fogHandle(
            pos.x / this.props.bbwidth,
            pos.y / this.props.bbwidth + this.getCalcScrollPos(),
            event.pointerId,
            now
          )
      }
      // console.log("mousemove");
    } else {
      this.outgodispatcher.scrollBoard(
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
      // console.log("rightmove");
    }
  }

  pointerup(event) {
    if (event.button === 2 && event.pointerType === 'mouse') {
      this.rightup(event)
      return
    }
    /*
    if (
      event.pointerType === 'touch' &&
      Date.now() - this.lastPenEvent < 5 * 1000
    )
      return // no touchy touchy
    */ // this is handled in pointer down already !, would otherwise result in stale drawings...

    const pos = { x: event.clientX, y: event.clientY }

    if (event.pointerId in this.pointerdraw === true) {
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
      /* console.log('pu event', event)
      console.log(
        'pointerup',
        pos.x,
        pos.y,
        pos.x / this.props.bbwidth,
        pos.y / this.props.bbwidth + this.getCalcScrollPos()
      ) */
      if (event.clientX !== 0 && event.clientY !== 0) {
        this.outgodispatcher.addToPath(
          null,
          objid,
          null,
          pos.x / this.props.bbwidth,
          pos.y / this.props.bbwidth + this.getCalcScrollPos(),
          event.pressure
        )
        if (this.realblackboard && this.realblackboard.current)
          this.realblackboard.current.preAddToPath(
            null,
            objid,
            null,
            pos.x / this.props.bbwidth,
            pos.y / this.props.bbwidth + this.getCalcScrollPos(),
            event.pressure
          )
      }
      this.addUndo(objid, this.pointerstoragenum[event.pointerId])
      this.outgodispatcher.finishPath(null, objid, null)
      if (this.realblackboard && this.realblackboard.current)
        this.realblackboard.current.preFinishPath(null, objid, null)

      delete this.pointerdraw[event.pointerId]
      delete this.pointerobjids[event.pointerId]
      delete this.pointerobjnum[event.pointerId]
      delete this.pointerstoragenum[event.pointerId]
    }
  }

  wheel(event) {
    // console.log('wheel', event)
    if (event.deltaMode === 0) {
      this.scrollboardKeys(0, event.deltaY / this.props.bbwidth)
    }
  }

  rightup(event) {
    if (this.rightmousescroll) {
      this.outgodispatcher.scrollBoard(
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
    // console.log("rightup");
  }

  scrollboardTB(x, y, reference) {
    // console.log("scrollboardTB",x,y,reference);
    if (this.outgodispatcher)
      this.outgodispatcher.scrollBoard(null, this.clientId, 0, reference + y)
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.preScrollBoard(
        null,
        this.clientId,
        0,
        reference + y
      )
  }

  scrollboardKeys(x, y) {
    // console.log("scrollboardKeys",x,y,this.getCurScrollPos(),this.state.curkeyscroll);
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
    if (this.outgodispatcher)
      this.outgodispatcher.scrollBoard(null, this.clientId, 0, curkeyscroll)
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
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'laserpointer'
      })
  }

  deactivateLaserPointer() {
    if (this.laserpointer === true) {
      this.props.notepadscreen.reportFoG(null, null, this.clientId)
      if (this.realblackboard && this.realblackboard.current)
        this.realblackboard.current.preReceiveFoG({
          x: null,
          y: null,
          clientid: this.clientId
        })
      this.laserpointer = false
    }
  }

  setMenuMode() {
    this.saveLastCursorState()
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'menu'
      })
  }

  setPenTool(color, size) {
    this.laserpointer = false
    this.tooltype = 0
    this.toolsize = size
    this.toolcolor = color
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'drawing',
        size: size * this.props.devicePixelRatio,
        color: color
      })
    // console.log("sPT",this.tooltype, this.toolsize,this.toolcolor );
  }

  setMarkerTool(color, size) {
    this.laserpointer = false
    this.tooltype = 1
    this.toolsize = size
    this.toolcolor = color
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'drawing',
        size: size * this.props.devicePixelRatio,
        color: color,
        alpha: 0.3
      })
    // console.log("sMT",this.tooltype, this.toolsize,this.toolcolor );
  }

  setEraserTool(size) {
    this.laserpointer = false
    this.tooltype = 2
    this.toolsize = size
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'drawing',
        size: size * this.props.devicePixelRatio,
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
      this.realblackboard.current.state.cursor.mode !== 'menu'
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
    this.props.notepadscreen.pictButtonPressed()
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'picture'
      })
  }

  okButtonPressed() {
    if (this.addpictmode !== 0) {
      this.setblocked(false)
      this.objnum++
      // eslint-disable-next-line dot-notation
      this.pointerobjnum['picture'] = this.objnum

      const objid = this.calcObjId('picture')
      // todo report about new picture
      this.outgodispatcher.addPicture(
        null,
        objid,
        null,
        this.state.addpictposx,
        this.state.addpictposy,
        this.state.addpictwidth,
        this.state.addpictheight,
        this.state.addpictuuid
      )
      this.addUndo(objid, Math.floor(this.state.addpictposy))

      this.setState({
        addpictuuid: null,
        addpicturl: null,
        addpictheight: null,
        addpictwidth: null,
        addpictmode: 0
      })
      this.addpictmode = 0
      this.restoreLastCursorState()
      this.reactivateToolBox()
    }
  }

  cancelButtonPressed() {
    if (this.addpictmode !== 0) {
      this.setblocked(false)
      this.setState({
        addpictuuid: null,
        addpicturl: null,
        addpictheight: null,
        addpictwidth: null,
        addpictmode: 0
      })
      // todo report about new picture
      this.addpictmode = 0
      this.restoreLastCursorState()
      this.reactivateToolBox()
    }
  }

  reactivateToolBox() {
    console.log('reactivate Toolbox called BB!', this.toolbox())
    if (this.toolbox()) this.toolbox().reactivate()
  }

  enterAddPictureMode(uuid, url) {
    this.addpictmode = 4 // stage of adding picture
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.setcursor({
        mode: 'normal'
      })
    this.setState({
      addpictuuid: uuid,
      addpicturl: url,
      addpictheight: null,
      addpictwidth: 0.1,
      addpictmode: 4
    })
    // this.addpictsprite=PIXI.Sprite.fromImage((url));

    // this.addChild(this.addpictsprite);
  }

  receiveData(data) {
    if (typeof data.timeSet !== 'undefined') {
      if (data.timeSet) {
        // console.log('initialscroll', data)
        if (this.outgodispatcher)
          this.outgodispatcher.setTimeandScrollPos(data.time)
      }
    }
    // console.log("rcD",data);
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.receiveData(data)
  }

  receivePictInfo(data) {
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.receivePictInfo(data)
  }

  receiveBgpdfInfo(data) {
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.receiveBgpdfInfo(data)
  }

  replaceData(data) {
    const callback = (cs) => {
      if (this.outgodispatcher)
        this.outgodispatcher.setTimeandScrollPos(
          cs.time,
          cs.scrollx,
          cs.scrolly
        )
    }
    if (this.realblackboard && this.realblackboard.current)
      this.realblackboard.current.replaceData(data, callback)
  }

  getStartScrollboardTB() {
    if (this.realblackboard && this.realblackboard.current)
      return this.realblackboard.current.getCurScrollPos()
  }

  getCurScrollPos() {
    if (this.realblackboard && this.realblackboard.current)
      return this.realblackboard.current.getCurScrollPos()
  }

  getCalcScrollPos() {
    if (this.realblackboard && this.realblackboard.current)
      return this.realblackboard.current.getCalcScrollPos()
  }

  receiveFoG(data) {
    if (this.realblackboard && this.realblackboard.current)
      return this.realblackboard.current.receiveFoG(data)
  }

  render() {
    let addpict = null
    if (this.state.addpictuuid) {
      addpict = {
        uuid: this.state.addpictuuid,
        url: this.state.addpicturl,
        posx: this.state.addpictposx,
        posy: this.state.addpictposy,
        width: this.state.addpictwidth,
        height: this.state.addpictheight
      }
    } else {
      addpict = null
    }
    const addpictmessstyle = {
      position: 'absolute',
      top: '5px',
      left: '20px',
      color: 'red',
      textShadow: '0 0 3px #FF0000',
      zIndex: 200
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
        {this.state.addpictmode === 4 && (
          <div style={addpictmessstyle}>
            <h3> Select upper left corner of picture </h3>
          </div>
        )}
        {this.state.addpictmode === 3 && (
          <div style={addpictmessstyle}>
            <h3> Select lower right corner of picture</h3>
          </div>
        )}
        <Blackboard
          backcolor={this.props.backcolor}
          bbwidth={this.props.bbwidth}
          addpict={addpict}
          bbheight={this.props.bbheight}
          ref={this.realblackboard}
          notepadscreen={this.props.notepadscreen}
          isnotepad={true}
        ></Blackboard>
      </div>
    )
  }
}
