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

export class AVAudioOutput extends AudioWorkletProcessor {
  static framelength = 480

  constructor(args) {
    super(args)
    this.nextframes = []
    this.port.onmessage = (e) => {
      if (e.data?.frame) {
        if (this.nextframes.length > 5)
          console.log('audio overflow', this.nextframes.length)
        else this.nextframes.push(e.data.frame)
      }
    }
  }

  process(inputs, outputs, parameters) {
    let outputpos = 0
    while (outputpos < outputs[0][0].length) {
      if (!this.currentframe && this.nextframes.length > 0) {
        this.currentframe = this.nextframes.shift()
        this.currentframeOffset = 0
      }
      if (this.currentframe) {
        this.underflowmessage = false
        const cf = this.currentframe
        if (
          cf.format !== 'f32-planar' ||
          // eslint-disable-next-line no-undef
          cf.sampleRate !== sampleRate ||
          cf.numberOfChannels !== outputs[0].length
        ) {
          console.log('Incompatible audio input', cf, outputs)
          break
        }
        const toCopy = Math.min(
          cf.numberOfFrames - this.currentframeOffset,
          outputs[0][0].length - outputpos
        )
        // valid data we start, copying
        for (let chan = 0; chan < cf.numberOfChannels; chan++) {
          const destview = new Float32Array(
            outputs[0][chan].buffer,
            outputpos * 4,
            toCopy
          )
          const srcview = new Float32Array(
            cf.data[chan].buffer,
            this.currentframeOffset * 4,
            toCopy
          )
          destview.set(srcview)
        }
        this.currentframeOffset += toCopy
        outputpos += toCopy
        if (this.currentframeOffset === cf.numberOfFrames) {
          this.currentframeOffset = 0
          delete this.currentframe
        }
      } else {
        if (!this.underflowmessage) {
          console.log('audio underflow', this.nextframes.length)
          this.underflowmessage = true
        }
        break
      }
    }
    return true
  }
}

registerProcessor('AVAudioOutput', AVAudioOutput)
