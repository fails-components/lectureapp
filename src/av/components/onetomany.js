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
import { AVMediaPipe } from './mediapipe/index'
import { AVTransformStream } from './transformstream'

export class AVOneToMany extends AVTransformStream {
  constructor(args) {
    super({
      ...args,
      outputs: args.outputlevel,
      outputmain: args.outputlevelmain
    })
    this.outputlevelmain = args.outputlevelmain
    this.outputlevelmax = args.outputlevel[args.outputlevel.length - 1]
  }

  setMaxOutputLevel(outputlevelmax) {
    if (outputlevelmax >= 0 || outputlevelmax <= this.outputlevel.length - 1) {
      this.outputlevelmax = this.outputs[outputlevelmax]
    }
  }
}
export class AVOneFrameToManyScaler extends AVOneToMany {
  constructor(args) {
    super(args)
    this.outputwidth = args.outputwidth
    this.off = true
    this.backgroundOff = true
  }

  changeOff(off) {
    this.off = off
  }

  changeBackgroundRemover({ off, color, type }) {
    // TODO color
    this.backgroundOff = off
    if (!off) {
      if (!this.backgroundRemover) {
        const { backgroundRemover, backgroundRemoverConfig } =
          AVMediaPipe.getNewBackgroundRemover()
        this.backgroundRemover = backgroundRemover
        this.backgroundRemoverConfig = backgroundRemoverConfig
      }
      this.backgroundRemoverConfig({ color, type })
    }
  }

  async transform(frame) {
    // ok, we calculate aspect ratio first
    const origininvaspect = frame.displayHeight / frame.displayWidth
    const targetinvaspect = 9 / 16
    let visibleRect
    if (origininvaspect !== targetinvaspect) {
      // ok we need to crop
      visibleRect = {
        x: 0,
        width: Math.max(frame.displayWidth, 1),
        y: 0.5 * (frame.displayHeight - frame.displayWidth * targetinvaspect),
        height: Math.max(((frame.displayWidth * targetinvaspect) >> 1) << 1, 1)
      }
    }
    const resframe = {}
    if (this.off) {
      frame.close()
      return resframe
    }
    if (visibleRect?.width === 1 && visibleRect?.height === 1) {
      frame.close()
      return resframe
    }
    if (!this.backgroundOff) {
      const oldframe = frame
      const { frame: newframe } = await this.backgroundRemover(oldframe)
      frame = newframe
      // oldframe.close() // the object is transfered and closed
    }
    for (const out of this.outputs) {
      if (typeof out === 'number' && out > this.outputlevelmax) continue // outlevel seems to be suspended

      // ok now we do the math and scale the frame
      const targetwidth = Math.min(this.outputwidth[out], frame.displayWidth)

      // eslint-disable-next-line no-undef
      resframe[out] = new VideoFrame(frame, {
        visibleRect,
        displayWidth: targetwidth,
        displayHeight: Math.max(((targetwidth * targetinvaspect) >> 1) << 1, 1)
      })
    }
    frame.close()
    return resframe
  }
}

export class AVOneToManyCopy extends AVOneToMany {
  constructor(args) {
    super(args)
    this.muted = true
  }

  changeMute(muted) {
    this.muted = muted
  }

  async transform(frame) {
    const resframe = {}
    if (this.muted) return resframe

    for (const out of this.outputs) {
      if (out > this.outputlevelmax) continue // outlevel seems to be suspended

      // ok now we do the math and scale the frame
      // eslint-disable-next-line no-undef
      resframe[out] = frame.clone()
    }
    frame.close()
    return resframe
  }
}
