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
import { AVSink } from './sink'

export class AVFrameSceneChange extends AVSink {
  constructor(args) {
    super(args)
    // TODO add detection parameters
    this.lastRefFrame = new Uint8Array(0)
    this.workCanvas = new OffscreenCanvas(160, 120)
    this.workContext = this.workCanvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true
    })
    const now = Date.now()
    this.lastMinorReport = now
    this.lastMajorReport = now
  }

  async process(frame) {
    if (
      frame.displayWidth !== this.workCanvas.width ||
      frame.displayHeight !== this.workCanvas.height
    ) {
      this.workCanvas.width = frame.displayWidth
      this.workCanvas.height = frame.displayHeight
    }
    this.workContext.drawImage(
      frame,
      0,
      0,
      frame.displayWidth,
      frame.displayHeight
    )
    frame.close()
    // scaling!
    const imagdata = this.workContext.getImageData(
      0,
      0,
      this.workCanvas.width,
      this.workCanvas.height
    )

    this.lastFrame = this.workFrame

    this.workFrame = imagdata.data
    if (this.lastRefFrame.byteLength !== this.workFrame.byteLength) {
      await this.majorChange()
      return
    }

    const { deviation } = this.calcChanges(this.lastRefFrame, this.workFrame)
    if (deviation > 0.05) this.majorChange()
    const { deviation: lastframedeviation, maxdeviation } = this.calcChanges(
      this.lastFrame,
      this.workFrame
    )
    if (lastframedeviation > 0.02 || maxdeviation > 0.1)
      this.reportMinorChange()
  }

  majorChange() {
    this.lastRefFrame = this.workFrame
    this.workFrame = undefined
    const now = Date.now()
    if (now - this.lastMajorReport < 8000) return // only record sheets, sitting for more than 8 s
    this.lastMajorReport = now
    // TODO clone the picture and convert to picture
  }

  reportMinorChange() {
    const now = Date.now()
    this.lastMinorReport = now
    // TODO implement
  }

  get minorReportTime() {
    return this.lastMinorReport
  }

  calcChanges(frame1, frame2) {
    if (!frame1 || !frame2) return { deviation: undefined }
    let sqrs = 0
    let max = 0
    for (let i = 0; i < frame1.byteLength; i++) {
      const diff = frame1[i] - frame2[i]
      sqrs += diff * diff
      max = Math.max(max, Math.abs(diff))
    }
    return {
      deviation: Math.sqrt(sqrs) / frame1.byteLength,
      maxdeviation: max / 255
    }
  }

  async close() {}
}
