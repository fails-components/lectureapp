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
  process(inputs, outputs, parameters) {
    // if (!this.startnow) this.startnow = now
    // now -= this.startnow
    const out = new Float32Array(inputs[0].length * inputs[0][0].length)
    const input = inputs[0]

    let offset = 0
    const numberOfFrames = input[0].length
    const numberOfChannels = input.length

    for (let channels = 0; channels < input.length; channels++) {
      const src = input[channels]
      const arrview = new Float32Array(out.buffer, offset, src.length)
      offset += src.byteLength
      arrview.set(src)
    }

    this.port.postMessage(
      {
        format: 'f32-planar',
        // eslint-disable-next-line no-undef
        sampleRate,
        numberOfFrames,
        numberOfChannels,
        // eslint-disable-next-line no-undef
        timestamp: Math.floor(currentTime * 1000 * 1000),
        data: out
      },
      [out.buffer]
    )
    return true
  }
}

registerProcessor('BufferGrabber', BufferGrabber)
