/*
    Fails Components (Fancy Automated Internet Lecture System - Components)
    Copyright (C)  2015-2017 (original FAILS), 
                   2021, 2023- (FAILS Components)  Marten Richter <marten.richter@freenet.de>

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

export class BufferGrabber extends AudioWorkletProcessor {
  static framelength = 480

  process(inputs, outputs, parameters) {
    // if (!this.startnow) this.startnow = now
    // now -= this.startnow
    let srcoffset = 0
    while (srcoffset !== inputs[0][0].length) {
      const numberOfChannels = inputs.length
      if (!this.curout) {
        this.curout = new Float32Array(
          inputs[0].length * BufferGrabber.framelength
        )
        this.curoutoffset = 0
        this.curoutobj = {
          format: 'f32-planar',
          // eslint-disable-next-line no-undef
          sampleRate,
          numberOfFrames: BufferGrabber.framelength,
          numberOfChannels,
          // eslint-disable-next-line no-undef
          timestamp: Math.floor(currentTime * 1000 * 1000), // should be adjusted?
          data: this.curout
        }
      }
      const input = inputs[0]

      let offset = this.curoutoffset

      const copylength = Math.min(
        input[0].length - srcoffset,
        BufferGrabber.framelength - this.curoutoffset
      )

      for (let channels = 0; channels < input.length; channels++) {
        const src = input[channels]
        const arrview = new Float32Array(
          this.curout.buffer,
          offset * 4,
          copylength
        )
        const srcview = new Float32Array(src.buffer, srcoffset * 4, copylength)
        offset += BufferGrabber.framelength
        arrview.set(srcview)
      }
      srcoffset += copylength
      this.curoutoffset += copylength

      if (BufferGrabber.framelength === this.curoutoffset) {
        this.port.postMessage(this.curoutobj, [this.curout.buffer])
        delete this.curoutobj
        delete this.curout
        delete this.curoutoffset
      }
    }
    return true
  }
}

registerProcessor('BufferGrabber', BufferGrabber)
