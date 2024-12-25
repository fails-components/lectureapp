import React, { Component } from 'react'
import { AVInterface } from '../av/avinterface.js'

export class AVVideoRender extends Component {
  constructor(args) {
    super(args)
    this.videoref = React.createRef()
    this.webworkid = AVInterface.interf.getNewId()
    this.srcwebworkid = null
    this.lastcanvas = null
    this.state = { wwidth: 100 }
    AVInterface.interf.registerForFinal(this, this.webworkid)
    AVInterface.worker.postMessage({
      task: 'newAVVideoRender',
      webworkid: this.webworkid
    })
    this.avinterf = AVInterface.interf // hold interface

    this.resizeeventlistener = this.resizeeventlistener.bind(this)
  }

  componentDidMount() {
    window.addEventListener('resize', this.resizeeventlistener)
    this.updateOffscreen()
    this.resizeeventlistener()
    this.outputStart().catch((error) => {
      console.log('Problem in outputStart', error)
    })
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeeventlistener)
    AVInterface.worker.postMessage({
      task: 'close',
      webworkid: this.webworkid
    })
    if (this.state.output) this.state.output.close()
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (!this.props.screenshare) {
      if (prevProps.videoid !== this.props.videoid && this.state.output) {
        this.state.output.setSrcId(this.props.videoid)
      }
    } else {
      if (
        prevProps.screenshareid !== this.props.screenshareid &&
        this.state.output
      ) {
        this.state.output.setSrcId(this.props.screenshareid)
      }
    }
    if (!prevState || prevState.output !== this.state.output) {
      this.state.output.setOutputRender(this)
    }

    this.updateOffscreen()
  }

  resizeeventlistener(e) {
    if (
      this.state.wwidth !== window.innerWidth ||
      this.state.wheight !== window.innerHeight
    ) {
      this.setState({
        wwidth: window.innerWidth,
        wheight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1
      })
      const width = this.props.width || 10
      AVInterface.worker.postMessage({
        task: 'AVVideoRenderSize',
        webworkid: this.webworkid,
        width: (window.innerWidth * width) / 100,
        devicePixelRatio: window.devicePixelRatio || 1
      })
    }
  }

  async outputStart() {
    try {
      const avinterf = AVInterface.getInterface()
      const outputobj = avinterf.openVideoOutput({
        screenshare: this.props.screenshare
      })

      let output = outputobj
      output = await output
      output.buildIncomingPipeline()
      if (this.props.videoid) output.setSrcId(this.props.videoid)
      output.setOutputRender(this)
      this.updateOffscreen()
      this.setState({ output })
    } catch (error) {
      console.log('outputStart failed', error)
    }
  }

  updateOffscreen() {
    if (this.videoref.current) {
      if (this.videoref.current !== this.lastcanvas) {
        this.lastcanvas = this.videoref.current
        this.offscreen = this.videoref.current.transferControlToOffscreen()
        this.updateOffScreenRender(this.offscreen)
      }
    }
  }

  updateOffScreenRender(offscreen) {
    AVInterface.worker.postMessage(
      {
        task: 'updateOffScreenRender',
        webworkid: this.webworkid,
        offscreen
      },
      [offscreen]
    )
  }

  render() {
    return (
      <canvas
        ref={this.videoref}
        style={{
          display: 'block',
          background: 'black',
          maxWidth: '100vw',
          maxHeight: '100vh'
        }}
      ></canvas>
    )
  }
}
