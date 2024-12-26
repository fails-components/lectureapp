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
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  '../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url
).href

export class BackgroundPDFPage extends Component {
  constructor(props) {
    super(props)
    this.state = {}
    this.canvas = React.createRef()
  }

  componentDidMount() {
    this.renderPage()
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      prevProps.page !== this.props.page ||
      prevProps.bbwidth !== this.props.bbwidth
    ) {
      this.renderPage()
    }
    if (prevState.page !== this.state.page && prevState.page) {
      prevState.page.pageobj.cleanup()
    }
  }

  componentWillUnmount() {
    if (this.state.page) {
      this.state.page.pageobj.cleanup()
    }
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

    const viewport = page.pageobj.getViewport({
      scale: bbwidth / page.pageobj.getViewport({ scale: 1.0 }).width
    })

    canvas.height = viewport.height
    canvas.width = viewport.width

    const context = canvas.getContext('2d')

    const renderContext = {
      canvasContext: context,
      viewport
    }
    context.clearRect(0, 0, canvas.width, canvas.height)

    // console.log("render page before ", page.pagenum);
    const renderTask = page.pageobj.render(renderContext)
    try {
      await renderTask.promise
      this.inrendering = false

      // this.setState({ page, bbwidth })
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
        if (this.pdf) {
          this.pdf.destroy()
          delete this.pdf
        }
        const pdf = await pdfjs.getDocument(this.props.url).promise
        // console.log("pdf", pdf);
        if (pdf) this.pdf = pdf
        else {
          this.setState({ pageinfo: [], url: 'failed' })
          console.log('got no pdf document')
          return
        }
        // now we have the pdf, we have to get information about the available pages
        let pageprom = []
        this.setState({ pageinfo: [], url: this.props.url })
        const ypos = (this.props.yend + this.props.ystart) * 0.5
        const pages = new Array(pdf.numPages)
          .fill(null)
          .map((el, index) => index + 1)
        pages.sort(
          (a, b) => Math.abs(a * 1.414 - ypos) - Math.abs(b * 1.414 - ypos)
        )
        for (const pagenum of pages) {
          const helpfunc = async (pn) => {
            try {
              const page = await pdf.getPage(pn)
              const dimen = page.getViewport({ scale: 2000 })

              this.setState((state, props) => {
                const newpageinfo = state.pageinfo.map((el) => el)
                newpageinfo[pn - 1] = {
                  pagenum: pn,
                  pageobj: page,
                  height: dimen.height / dimen.width
                }
                // perfect now we can calculate from tos
                let curpos = 0
                for (let pidx = 0; pidx < newpageinfo.length; pidx++) {
                  if (newpageinfo[pidx]) {
                    newpageinfo[pidx].from = curpos
                    curpos += newpageinfo[pidx].height
                    newpageinfo[pidx].to = curpos
                  } else {
                    curpos += 1.414 // assume A4 for empty
                  }
                }
                return { pageinfo: newpageinfo }
              })
            } catch (error) {
              console.log('Problem loading page ', pagenum, ':', error)
            }
          }
          pageprom.push(helpfunc(pagenum))
        }
        pageprom = await Promise.all(pageprom)
      } catch (error) {
        console.log('loadPDF failed', error)
        this.setState({ url: 'failed' })
      }
    }
  }

  componentDidMount() {
    this.loadPDF().catch((error) =>
      console.log('initial load pdf problem:', error)
    )
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.url !== prevProps.url) {
      this.loadPDF().catch((error) => console.log('load pdf problem:', error))
    }
  }

  componentWillUnmount() {
    if (this.pdf) {
      this.pdf.destroy()
      delete this.pdf
    }
  }

  render() {
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
      curpages = curpages
        .filter((el) => !!el)
        .map((el) => (
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
