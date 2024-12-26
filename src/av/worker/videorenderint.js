export class AVVideoRenderInt {
  constructor(args) {
    this.webworkid = args.webworkid
    this.offscreen = null
  }

  updateOffScreenRender(offscreen) {
    this.offscreen = offscreen
    this.ctx = offscreen.getContext('2d')
  }

  updateRenderSize(args) {
    console.log('updateRenderSize', args)
    if (this.offscreen) {
      this.offscreen.width = args.width // * args.devicePixelRatio
    }
  }
}
