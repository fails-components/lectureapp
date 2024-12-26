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
      `../../../node_modules/libav.js/dist/libav-${globalThis.LibAV.VER}-opus.${target}.wasm`,
      import.meta.url
    ).href
    globalThis.LibAV.toImport = new URL(
      `../../../node_modules/libav.js/dist/libav-${globalThis.LibAV.VER}-opus.${target}.js`,
      import.meta.url
    ).href
    /* globalThis.LibAV.importedjs = await import(
      `../node_modules/libav.js/libav-${globalThis.LibAV.VER}-opus.${target}.js`
    ) */
    globalThis.LibAV.importedjs = await import(
      /* @vite-ignore */
      new URL(
        `../../../node_modules/libav.js/dist/libav-${globalThis.LibAV.VER}-opus.${target}.js`,
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
