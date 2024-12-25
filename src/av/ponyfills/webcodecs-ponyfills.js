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

let AudioData
let encoderPoly

const loadPolyfills = async () => {
  // eslint-disable-next-line no-constant-condition
  if (!('AudioData' in globalThis)) {
    encoderPoly = true
  } else {
    AudioData = globalThis.AudioData
  }
  if (encoderPoly) {
    const LibAVWebCodecs = await import('libavjs-webcodecs-polyfill')
    if (encoderPoly) {
      AudioData = LibAVWebCodecs.AudioData
    }
  }
}

loadPolyfills().catch((error) => {
  console.log('Problem loading AV polyfills', error)
})

export class MediaStreamTrackProcessor {
  constructor({ track, maxBufferSize, createVideoElement }) {
    // customDocument can be used in a worker, it should allow to create a video element
    this._track = track
    this._maxBufferSize = maxBufferSize || 10
    this._createVideoElement =
      createVideoElement ||
      (() => {
        return document.createElement('video')
      })
    if (track.kind === 'video') this._setupVideo()
    else if (track.kind === 'audio') this._setupAudio()
    this.outputQueue = []
    this.isPolyfill = true
    this._useTimeDelay = false
  }

  _setupAudio() {
    this.readable = new ReadableStream({
      start: async (controller) => {
        this.streamController = controller
        this.ac = new AudioContext({
          sampleRate: 48000,
          latencyHint: 'interactive',
          sinkId: { type: 'none' }
        })
        const stream = new MediaStream([this._track])
        this.tracknode = this.ac.createMediaStreamSource(stream)
        await this.ac.audioWorklet.addModule(
          new URL('./webcodecs-ponyfill-grabber.js', import.meta.url)
        )
        this.workletnode = new AudioWorkletNode(this.ac, 'BufferGrabber', {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          processorOptions: {
            /* pass this to the worklet */
          }
        })
        this.workletnode.port.onmessage = (message) => {
          this._enqueueAudio(message.data)
        }
        this.tracknode.connect(this.workletnode)
      },
      pull: async (controller) => {},
      cancel: (reason) => {
        if (this.queueEmptyRej) this.queueEmptyRej(reason)
        this.ac.close().catch((error) => {
          console.log(
            'MediaStreamTrackProcessor: Problem closing AudioContext',
            error
          )
        })
      }
    })
  }

  _requestVideoCallback(videoCallback) {
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      this.rvfcHandle = this.videoele.requestVideoFrameCallback(videoCallback)
    } else {
      // assumes getVideoPlaybackquality
      let oldqual = this.videoele?.getVideoPlaybackQuality()
      const oldtime = document.timeline.currentTime // 1 s delay
      const animHelper = (now) => {
        const newqual = this.videoele?.getVideoPlaybackQuality()
        // enable fall back mode for firefox
        if (
          !this._useTimeDelay &&
          newqual?.totalVideoFrames === 0 /* Firefox !!! */ &&
          now - oldtime > 40 + 1000
        ) {
          this._useTimeDelay = true
        }
        if (
          newqual?.totalVideoFrames - newqual?.droppedVideoFrames >
            oldqual?.totalVideoFrames - oldqual?.droppedVideoFrames ||
          (newqual?.totalVideoFrames === 0 /* Firefox !!! */ &&
            now - oldtime > 40 &&
            this._useTimeDelay)
        ) {
          // done submit
          videoCallback(now, {
            presentationTime: now,
            width: this.videoele.videoWidth,
            height: this.videoele.videoHeight
          })
          oldqual = newqual
          // oldtime = now
        } else {
          this.rvfcHandle = requestAnimationFrame(animHelper)
        }
      }
      this.rvfcHandle = requestAnimationFrame(animHelper)
    }
  }

  _setupVideo() {
    const videoCallback = (now, metadata) => {
      if (
        this.streamController.desiredSize != null &&
        this.streamController.desiredSize >= 0
      ) {
        this._enqueueVideo({ now, metadata })
        this._requestVideoCallback(videoCallback)
      } else delete this.rvfcHandle
    }
    this.readable = new ReadableStream({
      start: async (controller) => {
        this.streamController = controller
        this.videoele = this._createVideoElement()
        this.videoele.srcObject = new MediaStream([this._track]) // actually this shold be a stream not a track
        // TODO Capturing from video element, with requestVideoFrame or similar or polyfill

        this._requestVideoCallback(videoCallback)
        await this.videoele.play()
      },
      pull: async (controller) => {
        if (!this.rvfcHandle) this._requestVideoCallback(videoCallback)
      },
      cancel: async (reason) => {
        await this.videoele.pause()
        if ('cancelVideoFrameCallback' in HTMLVideoElement.prototype) {
          this.videoele.cancelVideoFrameCallback(this.videoele.rvfcHandle)
        }
      }
    })
  }

  _enqueueAudio(chunk) {
    // console.log('Audio chunk', chunk)
    // eslint-disable-next-line no-undef
    this.streamController.enqueue(new AudioData(chunk))
  }

  _enqueueVideo({ now, metadata }) {
    // console.log('SETUP video enqueue', now, metadata)
    try {
      // eslint-disable-next-line no-undef
      const frame = new VideoFrame(this.videoele, {
        timestamp: Math.floor(metadata.presentationTime * 1000),
        alpha: 'discard',
        visibleRect: {
          x: 0,
          y: 0,
          width: metadata.width,
          height: metadata.height
        }
      })
      this.streamController.enqueue(frame)
    } catch (error) {
      console.log('enqueue video problem')
    }
  }
}
