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
import {
  serialize as BSONserialize,
  deserialize as BSONdeserialize
} from 'bson'
// import * as LibAVWebCodecs from 'libavjs-webcodecs-polyfill'

let AudioDecoder
let AudioEncoder
let EncodedAudioChunk
let AudioData

let LibAVlib

const loadPolyfills = async () => {
  let decoderPoly = false
  let encoderPoly = false

  // eslint-disable-next-line no-constant-condition
  if (!('AudioDecoder' in globalThis)) {
    decoderPoly = true
  } else {
    decoderPoly = false
    AudioDecoder = globalThis.AudioDecoder
    EncodedAudioChunk = globalThis.EncodedAudioChunk
  }

  // eslint-disable-next-line no-constant-condition
  if (!('AudioEncoder' in globalThis)) {
    encoderPoly = true
  } else {
    encoderPoly = false
    AudioEncoder = globalThis.AudioEncoder
    AudioData = globalThis.AudioData
  }
  if (decoderPoly || encoderPoly) {
    if (!globalThis.LibAV)
      globalThis.LibAV = { /* getFiles, */ nolibavworker: true } // the imported lib needs this
    LibAVlib = await import('libav.js/dist/libav-4.8.6.0.1-opus.js')
    console.log('LibAV loaded', LibAVlib, globalThis.LibAV)
    const target = globalThis.LibAV.target()
    globalThis.LibAV.wasmurl = new URL(
      `../../node_modules/libav.js/dist/libav-${globalThis.LibAV.VER}-opus.${target}.wasm`,
      import.meta.url
    ).href
    globalThis.LibAV.toImport = new URL(
      `../../node_modules/libav.js/dist/libav-${globalThis.LibAV.VER}-opus.${target}.js`,
      import.meta.url
    ).href
    /* globalThis.LibAV.importedjs = await import(
      `../node_modules/libav.js/libav-${globalThis.LibAV.VER}-opus.${target}.js`
    ) */
    globalThis.LibAV.importedjs = await import(
      /* @vite-ignore */
      new URL(
        `../../node_modules/libav.js/dist/libav-${globalThis.LibAV.VER}-opus.${target}.js`,
        import.meta.url
      ).href
    )

    const LibAVWebCodecs = await import('libavjs-webcodecs-polyfill')
    console.log('Ponyfill loaded' /* , LibAVWebCodecs */)
    await LibAVWebCodecs.load({ polyfill: false })
    if (decoderPoly) {
      AudioDecoder = LibAVWebCodecs.AudioDecoder
      EncodedAudioChunk = LibAVWebCodecs.EncodedAudioChunk
    }
    if (encoderPoly) {
      AudioEncoder = LibAVWebCodecs.AudioEncoder
      AudioData = globalThis.AudioData
    }
  }
}

let scalabilityModeSupported = false
const scalabilityModes = []
if ('VideoEncoder' in globalThis) {
  // eslint-disable-next-line no-undef
  VideoEncoder.isConfigSupported({
    codec: 'avc1.420034', // aka h264, maybe add profile
    avc: {
      format: 'annexb'
    },
    framerate: 25,
    displayWidth: 1280,
    displayHeight: 720,
    width: 1280,
    height: 720,
    // hardwareAcceleration: 'prefer-hardware',
    bitrate: 2000000,
    scalabilityMode: 'L1T3',
    latencyMode: 'realtime'
  })
    .then(({ supported, config }) => {
      console.log('L1T3 mode supported', supported)
      if (supported) {
        scalabilityModeSupported = true
        scalabilityModes.push('L1T3')
      }
    })
    .catch((error) => {
      console.log('Testing encoder properties failed', error)
    })
  // eslint-disable-next-line no-undef
  VideoEncoder.isConfigSupported({
    codec: 'avc1.420034', // aka h264, maybe add profile
    avc: {
      format: 'annexb'
    },
    framerate: 25,
    displayWidth: 1280,
    displayHeight: 720,
    width: 1280,
    height: 720,
    // hardwareAcceleration: 'prefer-hardware',
    bitrate: 2000000,
    scalabilityMode: 'L1T2',
    latencyMode: 'realtime'
  })
    .then(({ supported, config }) => {
      console.log('L1T2 mode supported', supported)
      if (supported) {
        scalabilityModeSupported = true
        scalabilityModes.push('L1T2')
      }
    })
    .catch((error) => {
      console.log('Testing encoder properties failed', error)
    })
}
const AVComponentsLoaded = loadPolyfills().catch((error) => {
  console.log('Problem loading AV polyfills', error)
})

export const createEncodedAudioChunk = (input) => {
  const init = { ...input, transfer: [] }
  const data = init.data
  if (data) {
    if (data instanceof ArrayBuffer) {
      init.transfer.push(data)
    } else if (ArrayBuffer.isView(data)) {
      init.transfer.push(data.buffer)
    }
  }
  return new EncodedAudioChunk(init)
}

export const createAudioData = (input) => {
  return new AudioData(input)
}

class AVMediaPipe {
  static workerInternal_
  static finalReg_
  static mpworkid = 0
  static reqid = 0
  static requests = {}

  static get worker() {
    if (!AVMediaPipe.workerInternal_) {
      AVMediaPipe.workerInternal_ = new Worker(
        new URL('./avmediapipeworker.js', import.meta.url),
        {
          type: 'module'
        }
      )
      AVMediaPipe.workerInternal_.addEventListener(
        'message',
        AVMediaPipe.onMessage
      )
      AVMediaPipe.finalReg_ = new FinalizationRegistry((mpworkid) => {
        AVMediaPipe.worker.postMessage({
          task: 'cleanUpObject',
          mpworkid
        })
      })
    }
    return AVMediaPipe.workerInternal_
  }

  static onMessage({ data }) {
    const { requestid, frame } = data
    const request = AVMediaPipe.requests[requestid]
    if (request) {
      request({ frame })
      delete AVMediaPipe.requests[requestid]
    } else {
      console.log('MEDIA PIPE unknown request', requestid, AVMediaPipe.requests)
    }
  }

  static getNewBackgroundRemover() {
    const worker = AVMediaPipe.worker
    AVMediaPipe.mpworkid++
    const mpworkid = AVMediaPipe.mpworkid
    worker.postMessage({
      task: 'openAVBackgroundRemover',
      mpworkid
    })
    const backgroundRemover = (frame) => {
      const requestid = AVMediaPipe.reqid++ + '_' + mpworkid
      worker.postMessage(
        {
          task: 'processFrame',
          frame,
          mpworkid,
          requestid
        },
        [frame]
      )
      return new Promise((resolve) => {
        AVMediaPipe.requests[requestid] = resolve
      })
    }
    const backgroundRemoverConfig = ({ color, type }) => {
      worker.postMessage({
        task: 'changeConfig',
        color,
        mpworkid,
        type
      })
    }
    AVMediaPipe.finalReg_.register(backgroundRemover, mpworkid)
    return { backgroundRemover, backgroundRemoverConfig }
  }
}

class AVCodec {
  constructor(args) {
    this.write = this.write.bind(this)
    this.startReadable = this.startReadable.bind(this)
    this.pullReadable = this.pullReadable.bind(this)
    this.closeWritable = this.closeWritable.bind(this)
    this.newPendingWrit = this.newPendingWrit.bind(this)

    this.highWaterMarkReadable = args?.highWaterMarkReadable || 2
    this.highWaterMarkWritable = args?.highWaterMarkWritable || 2

    this.writable = new WritableStream(
      {
        start(controller) {},
        write: this.write,
        close: this.closeWritable,
        abort(reason) {}
      },
      { highWaterMark: this.highWaterMarkWritable }
    )
    this.readable = new ReadableStream(
      {
        start: this.startReadable,
        pull: this.pullReadable
      },
      { highWaterMark: this.highWaterMarkReadable }
    )
  }

  close() {
    if (this.codec) {
      this.codec.close()
      delete this.codec
    }
  }

  startReadable(controller) {
    this.readableController = controller
  }

  async closeWritable(controller) {
    await this.codec.flush()
    this.codec.close()
  }

  pullReadable(controller) {
    this.checkResPendingWrit()
  }

  checkResPendingWrit() {
    if (
      (this.readableController && this.readableController.desiredSize <= 0) ||
      this.codecFull() ||
      !this.readableController
    ) {
      return
    }

    if (this.pendingwrit) {
      this.pendingwrit.resolve()
      this.pendingwrit = null
    }
  }

  async write(chunk) {
    if (!chunk) return
    if (!this.codec) return
    if (this.codec.state === 'closed') {
      await this.recreateCodec()
    }
    if (this.codecOnWrite) this.codecOnWrite(chunk)

    const codecprom = this.codecProcess(chunk)

    if (
      (this.readableController && this.readableController.desiredSize <= 0) ||
      this.codecFull() ||
      !this.readableController
    ) {
      const readprom = new Promise(this.newPendingWrit)
      await readprom
    }
    await codecprom
  }

  newPendingWrit(resolve, reject) {
    if (this.pendigwrit) throw new Error('No more then one pending writ')
    if (
      (this.readableController && this.readableController.desiredSize <= 0) ||
      this.codecFull() ||
      !this.readableController
    ) {
      this.pendingwrit = { resolve, reject }
    } else resolve()
  }
}

class AVEncoder extends AVCodec {
  constructor(args) {
    super(args)
    this.curcodec = null
    this.lastDecConf = null
  }

  async recreateCodec() {
    this.cur = {}
  }

  codecFull() {
    return this.codec?.encodeQueueSize > 2
  }

  async output(frame, mdata) {
    const metadata = mdata
    if (metadata.decoderConfig) {
      // check if we should remove the decoderConfig
      if (!this.lastDecConf) {
        this.lastDecConf = metadata.decoderConfig
      } else {
        const kold = Object.keys(this.lastDecConf)
        const knew = Object.keys(metadata.decoderConfig)
        let unequal = false

        if (kold.length !== knew.length) {
          unequal = true
        }

        for (const key of kold) {
          if (key !== 'description') {
            if (this.lastDecConf[key] !== metadata.decoderConfig[key]) {
              unequal = true
              break
            }
          } else {
            const bufferOld =
              this.lastDecConf[key].buffer || this.lastDecConf[key]
            const bufferNew =
              metadata.decoderConfig[key].buffer || metadata.decoderConfig[key]
            if (!bufferOld !== !bufferNew) {
              unequal = true
              break
            }
            if (bufferOld.byteLength !== bufferNew.byteLength) {
              unequal = true
              break
            } else {
              const uOld = new Uint8Array(bufferOld)
              const uNew = new Uint8Array(bufferNew)
              for (let i = 0; i < bufferOld.byteLength; i++) {
                if (uOld[i] !== uNew[i]) {
                  unequal = true
                  break
                }
              }
            }
          }
        }
        if (!unequal) {
          delete metadata.decoderConfig
        }
      }
    }
    this.checkResPendingWrit()
    if (this.readableController)
      this.readableController.enqueue({ frame, metadata })
  }
}

export class AVVideoEncoder extends AVEncoder {
  constructor(args) {
    super(args)

    this.type = 'video'

    this.bitrate = args.bitrate
    this.framerate = args.framerate
    this.output = this.output.bind(this)
    this.recreateCodec().catch((error) => {
      console.log('Problem loading VideoEncoder', error)
    })
  }

  async recreateCodec() {
    await super.recreateCodec()
    await AVComponentsLoaded
    this.lastkeyframetime = 0
    // eslint-disable-next-line no-undef
    this.codec = new VideoEncoder({
      output: this.output,
      error(error) {
        console.log('video encoder error', error.name, error.message)
      }
    })
  }

  async codecProcess(chunk) {
    let keyFrame = false
    /* console.log(
      'codec process',
      chunk.timestamp,
      this.lastkeyframetime + 3000_000
    ) */
    if (
      chunk.timestamp > this.lastkeyframetime + 3000_000 ||
      Math.abs(chunk.timestamp - this.lastkeyframetime) > 4000_0000
    ) {
      keyFrame = true
      this.lastkeyframetime = chunk.timestamp
    }
    this.codec.encode(chunk, { keyFrame })
    chunk.close()
  }

  codecOnWrite(chunk) {
    if (
      chunk.displayHeight !== this.cur.displayHeight ||
      chunk.displayWidth !== this.cur.displayWidth ||
      chunk.codedHeight !== this.cur.height ||
      chunk.codedWidth !== this.cur.width
    ) {
      this.curcodec = 'avc1.42402A'
      const config = {
        codec: this.curcodec /* 'avc1.420034' */, // aka h264, maybe add profile
        avc: { format: 'annexb' },
        framerate: this.framerate,
        displayWidth: chunk.displayWidth,
        displayHeight: chunk.displayHeight,
        width: chunk.displayWidth,
        height: chunk.displayHeight,
        // hardwareAcceleration: 'prefer-hardware',
        bitrate: this.bitrate,
        latencyMode: 'realtime'
      }
      if (scalabilityModeSupported) {
        if (scalabilityModes.includes('L1T3')) config.scalabilityMode = 'L1T3'
        else if (scalabilityModes.includes('L1T2'))
          config.scalabilityMode = 'L1T2'
      }
      this.codec.configure(config)
      this.lastDecConf = null
      console.log('codec state', this.codec.state)
      this.cur.displayHeight = chunk.displayHeight
      this.cur.displayWidth = chunk.displayWidth
      this.cur.height = chunk.codedHeight
      this.cur.width = chunk.codedWidth
    }
  }
}

export class AVAudioEncoder extends AVEncoder {
  constructor(args) {
    super(args)
    this.type = 'audio'

    this.bitrate = args.bitrate

    this.output = this.output.bind(this)
    this.recreateCodec().catch((error) => {
      console.log('Problem creating codec', error)
    })
  }

  async recreateCodec() {
    console.log('recreateCodec Encoder')
    await super.recreateCodec()
    await AVComponentsLoaded
    // eslint-disable-next-line no-undef
    this.codec = new AudioEncoder({
      output: this.output,
      error(error) {
        console.log('audio encoder error', error.name, error.message)
      }
    })
  }

  async codecProcess(chunk) {
    this.codec.encode(chunk)
    chunk.close()
  }

  codecOnWrite(chunk) {
    if (
      chunk.sampleRate !== this.cur.sampleRate ||
      chunk.numberOfChannels !== this.cur.numberOfChannels
    ) {
      this.curcodec = 'opus'
      console.log('configure Encoder')
      this.codec.configure({
        codec: this.curcodec /* 'opus' */, // aka opus
        format: 'opus',
        sampleRate: chunk.sampleRate,
        numberOfChannels: chunk.numberOfChannels,
        bitrate: this.bitrate,
        latencyMode: 'realtime'
      })
      console.log('audio codec state', this.codec.state)
      this.cur.sampleRate = chunk.sampleRate
      this.cur.numberOfChannels = chunk.numberOfChannels
      this.lastDecConf = null
    }
  }
}

export class AVDecoder extends AVCodec {
  constructor(args) {
    super(args)

    this.output = this.output.bind(this)
    this.codecOnWrite = this.codecOnWrite.bind(this)
  }

  async recreateCodec() {
    this.configured = false
  }

  codecFull() {
    return this.codec?.decodeQueueSize > 2
  }

  output(frame) {
    this.checkResPendingWrit()
    this.readableController.enqueue(frame)
  }

  codecOnWrite(chunk) {
    if (!chunk) console.log('no chunk to codecOnWrite Decoder')
    if (!chunk.metadata) console.log('debug metadata', chunk)
    if (
      !this.configured &&
      chunk.metadata &&
      chunk.metadata.decoderConfig &&
      chunk.metadata.decoderConfig.codec
    ) {
      console.log('codecOnWrite', chunk)
      this.codecConfigure(chunk)
      this.configured = true
    }
  }

  async codecProcess(chunk) {
    try {
      if (this.configured) this.codec.decode(chunk.frame)
      else console.log('codecProcess without configure')
    } catch (error) {
      console.log('codec Process error:', error)
    }
  }
}

export class AVVideoDecoder extends AVDecoder {
  constructor(args) {
    super(args)
    this.type = 'video'
    this.recreateCodec().catch((error) => {
      console.log('Problem loading VideoDecoder', error)
    })
  }

  async recreateCodec() {
    await super.recreateCodec()
    await AVComponentsLoaded
    // eslint-disable-next-line no-undef
    this.codec = new VideoDecoder({
      output: this.output,
      error(error) {
        console.log('video decoder error', error)
      }
    })
  }

  codecConfigure(chunk) {
    this.codec.configure({
      codec: chunk.metadata.decoderConfig.codec,
      optimizeForLatency: true
    })
  }
}

export class AVAudioDecoder extends AVDecoder {
  constructor(args) {
    super(args)
    this.type = 'audio'
    this.recreateCodec().catch((error) => {
      console.log('Problem loading VideoDecoder', error)
    })
  }

  async recreateCodec() {
    await super.recreateCodec()
    await AVComponentsLoaded
    // eslint-disable-next-line no-undef
    this.codec = new AudioDecoder({
      output: this.output,
      error(error) {
        console.log('audio decoder error', error)
      }
    })
  }

  codecConfigure(chunk) {
    this.codec.configure({
      codec: chunk.metadata.decoderConfig.codec,
      sampleRate: chunk.metadata.decoderConfig.sampleRate, // may be move to metadata, but later
      numberOfChannels: chunk.metadata.decoderConfig.numberOfChannels
      // do not add description as this signals ogg.
    })
  }
}

export class AVSink {
  constructor(args) {
    this.write = this.write.bind(this)
    this.closeWritable = this.closeWritable.bind(this)

    this.highWaterMarkWritable = args?.highWaterMarkWritable || 2

    this.writable = new WritableStream(
      {
        start(controller) {},
        write: this.write,
        close: this.closeWritable,
        abort(reason) {}
      },
      { highWaterMark: this.highWaterMarkWritable }
    )
  }

  async closeWritable(controller) {
    if (this.close) await this.close()
  }

  async write(chunk) {
    if (!chunk) return
    await this.process(chunk)
  }
}

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

export class AVTransformStream {
  // note actually a transform stream would be more suitable, but it is not available in firefox
  constructor(args) {
    this.write = this.write.bind(this)

    if (args && args.outputs) {
      this.outputs = args.outputs
      this.outputmain = args.outputmain
      this.multipleout = true
    } else {
      this.outputs = [1]
      this.outputmain = 1
      this.multipleout = false
    }

    this.startReadable = this.startReadable.bind(this)
    this.pullReadable = this.pullReadable.bind(this)
    this.newPendingWrit = this.newPendingWrit.bind(this)

    this.highWaterMarkReadable = args?.highWaterMarkReadable || 2
    this.highWaterMarkWritable = args?.highWaterMarkWritable || 2

    this.resetOutput()

    this.writable = new WritableStream(
      {
        start(controller) {},
        write: this.write,
        close(controller) {},
        abort(reason) {}
      },
      { highWaterMark: this.highWaterMarkWritable }
    )
  }

  setSkipframeCallback(callback) {
    this.informSkipframe = callback
  }

  resetInput() {
    if (this.pendigwrit) {
      const res = this.pendigwrit.resolve
      delete this.pendingwrit
      res(true) // means skip = true
    }
  }

  resetOutput() {
    if (this.multipleout) {
      const oldreadableController = this.readableController
      this.readable = {}
      this.readableController = {}
      for (const out of this.outputs) {
        this.readable[out] = new ReadableStream(
          {
            start: (controller) => this.startReadable(controller, out),
            pull: (controller) => this.pullReadable(controller, out)
          },
          { highWaterMark: this.highWaterMarkReadable }
        )
      }
      for (const out of this.outputs) {
        if (oldreadableController && oldreadableController[out]) {
          try {
            oldreadableController[out].close()
          } catch (error) {
            console.log('problem close resetOutput:', error)
          }
        }
      }
    } else {
      const oldreadableController = this.readableController
      this.readable = new ReadableStream(
        {
          start: this.startReadable,
          pull: this.pullReadable
        },
        { highWaterMark: this.highWaterMarkReadable }
      )
      if (oldreadableController)
        try {
          oldreadableController.close()
        } catch (error) {
          console.log('problem close resetOutput:', error)
        }
    }
  }

  async write(chunk) {
    // console.log('AVTransform write chunk', this.constructor.name, chunk)
    const finalchunk = await this.transform(chunk)

    if (!finalchunk) return

    let controller
    if (this.multipleout) controller = this.readableController[this.outputmain]
    else controller = this.readableController

    if ((controller && controller.desiredSize <= 0) || !controller) {
      // console.log('block output ')
      const readprom = new Promise(this.newPendingWrit)
      const skip = await readprom
      if (skip) return // we should skip, due to resetInput
    }
    if (!this.multipleout) {
      if (Array.isArray(finalchunk)) {
        finalchunk.forEach((el) => {
          this.readableController.enqueue(el)
        })
      } else {
        this.readableController.enqueue(finalchunk)
      }
    } else {
      for (const out of this.outputs) {
        const curchunk = finalchunk[out]
        if (
          this.readableController[out].desiredSize <= 0 &&
          out !== this.outputmain
        ) {
          // console.log('skip output ', out)
          if (this.informSkipframe) this.informSkipframe(out)
          continue
        }
        if (curchunk) {
          if (Array.isArray(curchunk)) {
            curchunk.forEach((el) => {
              this.readableController[out].enqueue(el)
            })
          } else {
            this.readableController[out].enqueue(curchunk)
          }
        }
      }
    }
  }

  enqueueChunk(chunk) {
    this.readableController.enqueue(chunk)
  }

  newPendingWrit(resolve, reject) {
    if (this.pendigwrit) throw new Error('No more then one pending writ')
    if (
      (this.readableController && this.readableController.desiredSize <= 0) ||
      !this.readableController
    ) {
      this.pendingwrit = { resolve, reject }
    } else resolve()
  }

  startReadable(controller, out) {
    if (typeof out === 'undefined') this.readableController = controller
    else this.readableController[out] = controller
  }

  pullReadable(controller, out) {
    if (controller.desiredSize <= 0) return

    if (this.pendingwrit && (!out || out === this.outputmain)) {
      this.pendingwrit.resolve()
      this.pendingwrit = null
    }
  }
}

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
        height: Math.max(frame.displayWidth * targetinvaspect, 1)
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

export class AVEncrypt extends AVTransformStream {
  constructor(args) {
    super(args)
    this.key = null
    this.keyindex = null
    this.keyStore = args.keyStore
  }

  async transform(chunk) {
    // ok chunk is a video frame

    // 96 bits iv as recommend by specification

    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))

    const plaindata = new ArrayBuffer(chunk.frame.byteLength)
    chunk.frame.copyTo(plaindata)

    const keystore = this.keyStore

    const curkeyid = await keystore.getCurKeyId()
    if (curkeyid !== this.keyindex && chunk.frame.type === 'key') {
      // we only change the key on keyframes!
      this.key = await keystore.getKey(curkeyid)
      this.keyindex = curkeyid
    }

    const rec = false // fix e2e to true for now

    const encdata = globalThis.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      rec ? this.key.rec : this.key.e2e,
      plaindata
    )

    const encryptedchunk = {
      metadata: {
        ...chunk.metadata
      },
      framedata: {
        timestamp: chunk.frame.timestamp,
        duration: chunk.frame.duration,
        key: chunk.frame.type === 'key'
      },
      iv,
      keyindex: this.keyindex, // identify current key
      rec, // recording or not
      data: await encdata
    }

    return encryptedchunk
  }

  setKey(key) {
    this.newkey = key
  }

  static generateKey() {
    return globalThis.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    )
  }
}

export class AVDecrypt extends AVTransformStream {
  constructor(args) {
    super(args)
    this.key = null
    this.keyindex = null
    this.chunkMaker = args.chunkMaker
    this.keyStore = args.keyStore
  }

  async transform(chunk) {
    // ok chunk is encrypted data
    try {
      if (this.skipToKeyFrame) {
        if (!chunk.framedata.key) {
          // skip
          return null
        } else this.skipToKeyFrame = false
      }
      const keystore = this.keyStore

      if (chunk.keyindex !== this.keyindex) {
        console.log('AVDecrypt getKey', chunk.keyindex, this.keyindex)
        this.key = await keystore.getKey(chunk.keyindex)
        console.log('AVDecrypt getKey after', chunk.keyindex, this.keyindex)
        this.keyindex = chunk.keyindex
      }

      const decdata = globalThis.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: chunk.iv
        },
        chunk.rec ? this.key.rec : this.key.e2e,
        chunk.data
      )

      const decryptedchunk = {
        metadata: {
          ...chunk.metadata
        },
        // eslint-disable-next-line no-undef
        frame: this.chunkMaker({
          type: chunk.framedata.key ? 'key' : 'delta',
          timestamp: chunk.framedata.timestamp.toString(),
          duration: chunk.framedata.duration,
          data: await decdata
        })
      }
      if (this.storedDecoderConfig) {
        if (!decryptedchunk.metadata.decoderConfig)
          decryptedchunk.metadata.decoderConfig = this.storedDecoderConfig
        delete this.storedDecoderConfig
      }
      return decryptedchunk
    } catch (error) {
      console.log('AVDecrypt error', error)
      console.log('Debug AVDecrypt', chunk)
      if (chunk.metadata && chunk.metadata.decoderConfig)
        this.storedDecoderConfig = chunk.metadata.decoderConfig
      this.skipToKeyFrame = true
      return undefined
    }
  }

  setKey(key) {
    this.newkey = key
  }
}

export class BsonFramer extends AVTransformStream {
  reset() {
    this.resetOutput()
    this.resetInput()
  }

  async transform(chunk) {
    const bson = BSONserialize(chunk)
    const hdrlen = 6
    const headerbuffer = new ArrayBuffer(hdrlen)
    const hdrdv = new DataView(headerbuffer)
    let hdrpos = 0
    hdrdv.setUint32(hdrpos, bson.length + 6)
    hdrpos += 4
    hdrdv.setUint16(hdrpos, 0)
    return [headerbuffer, bson]
  }
}

export class AVFramer extends AVTransformStream {
  constructor(args) {
    super(args)
    this.type = args.type
    this.messages = {}
  }

  reset() {
    this.resetOutput()
  }

  resendConfigs() {
    for (const task in this.messages) {
      this.sendBson(this.messages[task])
    }
  }

  sendDecoderConfig(config) {
    const task = { task: 'decoderconfig', data: config }
    this.messages[task.task] = task
    this.sendBson(task)
  }

  sendBson(tosend) {
    const bson = BSONserialize(tosend)
    const hdrlen = 6
    const headerbuffer = new ArrayBuffer(hdrlen)
    const hdrdv = new DataView(headerbuffer)
    let hdrpos = 0
    hdrdv.setUint32(hdrpos, bson.length + 6)
    hdrpos += 4
    hdrdv.setUint16(hdrpos, 0)
    this.enqueueChunk(headerbuffer)
    this.enqueueChunk(bson)
  }

  async transform(chunk) {
    const framedata = chunk.framedata
    const data = chunk.data
    const metadata = chunk.metadata
    let hdrlen = 2 + 4 + 8 + 2 + 1 + 1

    let hdrflags1 = 0

    // hdrflags 1 begin
    if (framedata.key) hdrflags1 |= 1
    if (metadata.svc && typeof metadata.svc.temporalLayerId !== 'undefined') {
      hdrflags1 |= 1 << 1
      hdrlen += 4
    }
    if (metadata && metadata.decoderConfig) {
      console.log('deconfig', metadata.decoderConfig)
      this.sendDecoderConfig(metadata.decoderConfig)
    }
    if (chunk.iv) {
      hdrflags1 |= 1 << 2
      hdrlen += chunk.iv.length + 1
    }
    if (chunk.rec) hdrflags1 |= 1 << 3
    // hdrflags 1 end
    const payloadlen = data.byteLength
    const headerbuffer = new ArrayBuffer(hdrlen)
    const hdrdv = new DataView(headerbuffer)
    let hdrpos = 0
    hdrdv.setUint32(hdrpos, payloadlen)
    hdrpos += 4
    hdrdv.setUint16(hdrpos, hdrlen) // if hdr len is zero, it is a BSON config message, codec change for example, or authorization
    hdrpos += 2
    hdrdv.setUint16(hdrpos, framedata.duration)
    hdrpos += 2
    hdrdv.setBigInt64(hdrpos, BigInt(framedata.timestamp))
    hdrpos += 8
    hdrdv.setUint8(hdrpos, hdrflags1)
    hdrpos += 1
    hdrdv.setUint8(hdrpos, chunk.keyindex & 0xff)
    hdrpos += 1
    if (metadata.svc && typeof metadata.svc.temporalLayerId !== 'undefined') {
      hdrdv.setUint32(hdrpos, metadata.svc.temporalLayerId)
      hdrpos += 4
    }
    if (chunk.iv) {
      hdrdv.setUint8(hdrpos, chunk.iv.length)
      hdrpos += 1
      for (let p = 0; p < chunk.iv.length; p++) {
        hdrdv.setUint8(hdrpos, chunk.iv[p])
        hdrpos += 1
      }
    }
    if (hdrpos !== hdrlen)
      throw new Error(
        'faulty header length calculation ' + hdrpos + 'vs. ' + hdrlen
      )
    return [headerbuffer, data]
  }
}

export class BasicDeframer extends AVTransformStream {
  reset() {
    this.chunkqueue = []
    this.readpos = 0
    this.output = null
    this.error = undefined
  }

  readData(which) {
    let wlen = 0
    let wobj = null
    switch (which) {
      case 'header':
        wlen = this.output.hdrlen
        wobj = this.output.header
        break
      case 'bson':
        wlen = this.output.bsonlen
        wobj = this.output.bson
        break
      case 'payload':
        wlen = this.output.payloadlen
        wobj = this.output.payload
        break
      default:
        throw new Error('Unsupported')
    }
    if (wlen === 0 || this.chunkqueue.length === 0) return true // already done or no more chunks
    if (wlen < 0) {
      console.log('deframer errored wlen 1', wlen)
      this.error = 'wlen'
      return false
    }

    // if we have no header read in yet
    if (!wobj) {
      if (this.chunkqueue[0].byteLength - this.readpos >= wlen) {
        wobj = new Uint8Array(
          this.chunkqueue[0].buffer,
          this.readpos + this.chunkqueue[0].byteOffset,
          wlen
        )
        this.readpos += wlen
        wlen = 0
        if (this.readpos === this.chunkqueue[0].length) {
          this.chunkqueue.shift()
          this.readpos = 0
        }
      } else {
        // console.log('wlen', wlen, which)
        if (wlen > 10000000 || wlen < 0) {
          // Limit 10 MB
          console.log('deframer errored wlen 2', wlen)
          this.error = 'wlen'
          return false
        }
        wobj = new Uint8Array(new ArrayBuffer(wlen))
      }
    }
    while (this.chunkqueue.length > 0 && wlen > 0) {
      const chunk = this.chunkqueue[0]
      const tocopy = Math.min(chunk.byteLength - this.readpos, wlen)
      const dv = new Uint8Array(chunk.buffer, this.readpos + chunk.byteOffset)
      const hdr = new Uint8Array(wobj.buffer, wobj.byteLength - wlen)
      for (let i = 0; i < tocopy; i++) {
        hdr[i] = dv[i]
      }
      this.readpos += tocopy
      wlen -= tocopy
      if (this.readpos === chunk.byteLength) {
        this.chunkqueue.shift()
        this.readpos = 0
      }
    }
    // ok the header is ready

    switch (which) {
      case 'header':
        this.output.hdrlen = wlen
        this.output.header = wobj
        break
      case 'bson':
        this.output.bsonlen = wlen
        this.output.bson = wobj
        break
      case 'payload':
        this.output.payloadlen = wlen
        this.output.payload = wobj
        break
      default:
        throw new Error('Unsupported')
    }
    return true
  }
}

export class BsonDeFramer extends BasicDeframer {
  constructor(args) {
    super(args)

    this.reset()
  }

  async transform(chunk) {
    if (this.error) {
      console.log('skipdeframer BsonDeframer errored stream')
      return
    }
    if (!ArrayBuffer.isView(chunk)) {
      this.chunkqueue.push(new Uint8Array(chunk))
    } else this.chunkqueue.push(chunk)

    const toreturn = []
    while (this.chunkqueue.length > 0) {
      if (!this.output) {
        while (this.chunkqueue[0].byteLength - this.readpos < 6) {
          if (this.chunkqueue.length < 2) return toreturn // we can not proceed insufficient data available
          const chunka = this.chunkqueue[0]
          const chunkb = this.chunkqueue[1]
          const reschunk = new ArrayBuffer(
            this.chunkqueue[0].byteLength -
              this.readpos +
              this.chunkqueue[1].byteLength
          )
          const srca = new Uint8Array(
            chunka.buffer,
            this.readpos + chunka.byteOffset,
            chunka.byteLength - this.readpos
          )
          const srcb = chunkb
          const fdest = new Uint8Array(reschunk)
          for (let i = 0; i < srca.length; i++) {
            fdest[i] = srca[i]
          }
          const dest2 = new Uint8Array(reschunk, srca.length)
          for (let i = 0; i < srcb.length; i++) {
            dest2[i] = srcb[i]
          }
          this.chunkqueue[1] = fdest
          this.chunkqueue.shift()
          this.readpos = 0
          // console.log('rechunk', chunka, chunkb, reschunk)
        }
        const dvhdr = new DataView(
          this.chunkqueue[0].buffer,
          this.readpos + this.chunkqueue[0].byteOffset
        )
        this.output = {
          payloadlen: dvhdr.getUint32(0),
          hdrlen: dvhdr.getUint16(4)
        }

        if (this.output.hdrlen === 0) {
          // console.log('bson detected')
          // we have a bson
          this.output.hdrlen = 6
          this.output.bsonlen = this.output.payloadlen - 6
          this.output.payloadlen = 0
        }
      }
      // now we process the pending reads
      if (!this.readData('header')) return toreturn
      if (this.output.bsonlen) {
        if (!this.readData('bson')) return toreturn
      } else throw new Error('only bson data expected')

      if (
        this.output.hdrlen === 0 &&
        this.output.payloadlen === 0 &&
        (!this.output.bsonlen || this.output.bsonlen === 0)
      ) {
        // ok we have something
        if (this.output.bson) {
          toreturn.push(BSONdeserialize(this.output.bson))
          this.output = null // we are ready for next packet
        }
      } else break // not enough data
    }
    return toreturn
  }
}

export class AVDeFramer extends BasicDeframer {
  constructor(args) {
    super({ ...args, highWaterMarkWritable: 10 })
    // this.type = args.type

    this.reset()

    this.inspectframe = null
  }

  setFrameInspector(inspector) {
    this.inspectframe = inspector
  }

  async transform(chunk) {
    if (this.error) {
      console.log('skipdeframer errored stream')
      return
    }
    if (!ArrayBuffer.isView(chunk)) {
      this.chunkqueue.push(new Uint8Array(chunk))
    } else this.chunkqueue.push(chunk)

    const toreturn = []
    while (this.chunkqueue.length > 0) {
      if (!this.output) {
        while (this.chunkqueue[0].byteLength - this.readpos < 6) {
          if (this.chunkqueue.length < 2) return toreturn // we can not proceed insufficient data available
          const chunka = this.chunkqueue[0]
          const chunkb = this.chunkqueue[1]
          const reschunk = new ArrayBuffer(
            this.chunkqueue[0].byteLength -
              this.readpos +
              this.chunkqueue[1].byteLength
          )
          const srca = new Uint8Array(
            chunka.buffer,
            this.readpos + chunka.byteOffset,
            chunka.byteLength - this.readpos
          )
          const srcb = chunkb
          const fdest = new Uint8Array(reschunk)
          for (let i = 0; i < srca.length; i++) {
            fdest[i] = srca[i]
          }
          /* console.log(
            'reschunk len',
            this.chunkqueue[0].byteLength -
              this.readpos +
              this.chunkqueue[1].byteLength,
            this.chunkqueue[0].byteLength,
            this.readpos,
            this.chunkqueue[1].byteLength,
            this.chunkqueue[0],
            this.chunkqueue[1]
          ) */
          const dest2 = new Uint8Array(reschunk, srca.length)
          for (let i = 0; i < srcb.length; i++) {
            dest2[i] = srcb[i]
          }
          this.chunkqueue[1] = fdest
          this.chunkqueue.shift()
          this.readpos = 0
          // console.log('rechunk', chunka, chunkb, reschunk)
        }
        const dvhdr = new DataView(
          this.chunkqueue[0].buffer,
          this.readpos + this.chunkqueue[0].byteOffset
        )
        this.output = {
          payloadlen: dvhdr.getUint32(0),
          hdrlen: dvhdr.getUint16(4)
        }

        if (this.output.hdrlen === 0) {
          console.log('bson detected')
          // we have a bson
          this.output.hdrlen = 6
          this.output.bsonlen = this.output.payloadlen - 6
          this.output.payloadlen = 0
        }
      }
      // now we process the pending reads
      if (!this.readData('header')) return toreturn
      if (this.output.bsonlen) {
        if (!this.readData('bson')) return toreturn
      } else {
        if (!this.readData('payload')) return toreturn
      }

      if (
        this.output.hdrlen === 0 &&
        this.output.payloadlen === 0 &&
        (!this.output.bsonlen || this.output.bsonlen === 0)
      ) {
        // ok we have something
        if (this.output.bson) {
          this.processBSON(this.output.bson)
          this.output = null // we are ready for next packet
        } else {
          const result = this.processHeader(this.output.header)
          result.data = this.output.payload
          this.output = null // we are ready
          if (this.inspectframe) this.inspectframe(result)
          toreturn.push(result)
        }
      } else break // not enough data
    }
    return toreturn
  }

  processBSON(dv) {
    const obj = BSONdeserialize(dv)
    switch (obj.task) {
      case 'decoderconfig':
        this.pendingDecoderConfig = obj.data
        this.decoderConfig = obj.data
        break
      default:
        throw new Error('Unknown bson task')
    }
  }

  processHeader(abv) {
    const chunk = { framedata: {}, metadata: {} }
    const framedata = chunk.framedata
    const metadata = chunk.metadata
    const hdrlen = abv.byteLength

    const hdrdv = new DataView(abv.buffer, abv.byteOffset, abv.byteLength)
    let hdrpos = 0
    // hdrdv.getUint32(hdrpos) // payloadlen
    hdrpos += 4
    // hdrdv.getUint16(hdrpos) //hdrlen // if hdr len is zero, it is a BSON config message, codec change for example, or authorization
    hdrpos += 2
    framedata.duration = hdrdv.getUint16(hdrpos)
    hdrpos += 2
    framedata.timestamp = hdrdv.getBigInt64(hdrpos)
    hdrpos += 8
    const hdrflags1 = hdrdv.getUint8(hdrpos)
    hdrpos += 1
    framedata.key = !!(hdrflags1 & 1)
    chunk.rec = !!(hdrflags1 & (1 << 3))

    chunk.keyindex = hdrdv.getUint8(hdrpos)
    hdrpos += 1

    if (hdrflags1 & (1 << 1)) {
      metadata.svc = {
        temporalLayerId: hdrdv.getUint32(hdrpos)
      }
      hdrpos += 4
    }

    if (hdrflags1 & (1 << 2)) {
      const ivlength = hdrdv.getUint8(hdrpos)
      hdrpos += 1
      const iv = new Uint8Array(new ArrayBuffer(ivlength))
      for (let p = 0; p < ivlength; p++) {
        iv[p] = hdrdv.getUint8(hdrpos)
        hdrpos += 1
      }
      chunk.iv = iv
    }

    if (this.pendingDecoderConfig) {
      metadata.decoderConfig = this.pendingDecoderConfig
      this.pendingDecoderConfig = null
    }

    if (hdrpos !== hdrlen) throw new Error('faulty header length calculation')
    return chunk
  }
}
