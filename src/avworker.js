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
import { AVTransport } from './avtransport'

class AVVideoRenderInt {
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

class AVVideoOutStream {
  constructor(args) {
    this.webworkid = args.webworkid
  }
}

class AVCodec {
  constructor(args) {
    this.write = this.write.bind(this)
    this.startReadable = this.startReadable.bind(this)
    this.pullReadable = this.pullReadable.bind(this)
    this.closeWritable = this.closeWritable.bind(this)
    this.newPendingWrit = this.newPendingWrit.bind(this)

    this.writable = new WritableStream(
      {
        start(controller) {},
        write: this.write,
        close: this.closeWritable,
        abort(reason) {}
      },
      { highWaterMark: 2 }
    )
    this.readable = new ReadableStream(
      {
        start: this.startReadable,
        pull: this.pullReadable
      },
      { highWaterMark: 2 }
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
    if (this.codec.state === 'closed') {
      this.recreateCodec()
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
  }

  recreateCodec() {
    this.cur = {}
  }

  codecFull() {
    return this.codec.encodeQueueSize > 2
  }

  async output(frame, metadata) {
    this.checkResPendingWrit()
    if (this.readableController)
      this.readableController.enqueue({ frame, metadata })
  }
}

class AVVideoEncoder extends AVEncoder {
  // static levelwidth= [160, 320, 640, 848, 848, 1280, 1280, 1920]
  static levelbitrate = [
    150_000, 250_000, 500_000, 1000_000, 1750_000, 2000_000, 3600_000, 4800_000
  ]

  constructor(args) {
    super(args)

    this.type = 'video'

    this.outputlevel = args.outputlevel
    this.output = this.output.bind(this)
    this.recreateCodec()
  }

  recreateCodec() {
    super.recreateCodec()
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
      this.codec.configure({
        codec: this.curcodec /* 'avc1.420034' */, // aka h264, maybe add profile
        avc: { format: 'annexb' },
        framerate: 25,
        displayWidth: chunk.displayWidth,
        displayHeight: chunk.displayHeight,
        width: chunk.displayWidth,
        height: chunk.displayHeight,
        // hardwareAcceleration: 'prefer-hardware',
        bitrate: AVVideoEncoder.levelbitrate[this.outputlevel],
        scalabilityMode: 'L1T3',
        latencyMode: 'realtime'
      })
      console.log('codec state', this.codec.state)
      this.cur.displayHeight = chunk.displayHeight
      this.cur.displayWidth = chunk.displayWidth
      this.cur.height = chunk.codedHeight
      this.cur.width = chunk.codedWidth
      console.log('log chunk', chunk)
    }
  }
}

class AVAudioEncoder extends AVEncoder {
  static levelbitrate = [15_000, 64_000, 128_000]

  constructor(args) {
    super(args)
    this.type = 'audio'

    this.outputlevel = args.outputlevel

    this.output = this.output.bind(this)
    this.recreateCodec()
  }

  recreateCodec() {
    super.recreateCodec()
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
      this.codec.configure({
        codec: this.curcodec /* 'opus' */, // aka opus
        format: 'opus',
        sampleRate: chunk.sampleRate,
        numberOfChannels: chunk.numberOfChannels,
        bitrate: AVAudioEncoder.levelbitrate[this.outputlevel],
        latencyMode: 'realtime'
      })
      console.log('audio codec state', this.codec.state)
      this.cur.sampleRate = chunk.sampleRate
      this.cur.numberOfChannels = chunk.numberOfChannels
      console.log('audio log chunk', chunk)
    }
  }
}

class AVDecoder extends AVCodec {
  constructor(args) {
    super(args)

    this.output = this.output.bind(this)
    this.codecOnWrite = this.codecOnWrite.bind(this)
  }

  recreateCodec() {
    this.configured = false
  }

  codecFull() {
    return this.codec.decodeQueueSize > 2
  }

  output(frame) {
    this.checkResPendingWrit()
    this.readableController.enqueue(frame)
  }

  codecOnWrite(chunk) {
    if (!chunk) console.log('no chunk to codecOnWrite Videodecoder')
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

class AVVideoDecoder extends AVDecoder {
  constructor(args) {
    super(args)
    this.type = 'video'
    this.recreateCodec()
  }

  recreateCodec() {
    super.recreateCodec()
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

class AVAudioDecoder extends AVDecoder {
  constructor(args) {
    super(args)
    this.type = 'audio'
    this.recreateCodec()
  }

  recreateCodec() {
    super.recreateCodec()
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
    })
  }
}

class AVTransformStream {
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

    this.resetOutput()

    this.writable = new WritableStream(
      {
        start(controller) {},
        write: this.write,
        close(controller) {},
        abort(reason) {}
      },
      { highWaterMark: 2 }
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
      for (const out in this.outputs) {
        this.readable[out] = new ReadableStream(
          {
            start: (controller) => this.startReadable(controller, out),
            pull: (controller) => this.pullReadable(controller, out)
          },
          { highWaterMark: 2 }
        )
      }
      for (const out in this.outputs) {
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
        { highWaterMark: 2 }
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
      for (const out in this.outputs) {
        const curchunk = finalchunk[out]
        if (
          this.readableController[out].desiredSite <= 0 &&
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
    if (!out) this.readableController = controller
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

class AVOneToMany extends AVTransformStream {
  constructor(args) {
    super({
      ...args,
      outputs: args.outputlevel,
      outputmain: args.outputlevelmain
    })
    this.outputlevel = args.outputlevel
    this.outputlevelmain = args.outputlevelmain
    this.outputlevelmax = this.outputlevel.length - 1
  }

  setMaxOutputLevel(outputlevelmax) {
    if (outputlevelmax >= 0 || outputlevelmax <= this.outputlevel.length - 1) {
      this.outputlevelmax = outputlevelmax
    }
  }
}

class AVOneFrameToManyScaler extends AVOneToMany {
  static levelwidth = [160, 320, 640, 848, 848, 1280, 1280, 1920]

  constructor(args) {
    super(args)
    this.off = true
  }

  changeOff(off) {
    this.off = off
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
        width: frame.displayWidth,
        y: 0.5 * (frame.displayHeight - frame.displayWidth * targetinvaspect),
        height: frame.displayWidth * targetinvaspect
      }
    }
    const resframe = {}
    if (this.off) {
      frame.close()
      return resframe
    }
    for (const out in this.outputlevel) {
      if (out > this.outputlevelmax) continue // outlevel seems to be suspended
      // ok now we do the math and scale the frame
      const targetwidth = Math.min(
        AVOneFrameToManyScaler.levelwidth[out],
        frame.displayWidth
      )

      // eslint-disable-next-line no-undef
      resframe[out] = new VideoFrame(frame, {
        visibleRect,
        displayWidth: targetwidth,
        displayHeight: targetwidth * targetinvaspect
      })
    }
    frame.close()
    return resframe
  }
}

class AVOneToManyCopy extends AVOneToMany {
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

    for (const out in this.outputlevel) {
      if (out > this.outputlevelmax) continue // outlevel seems to be suspended
      // ok now we do the math and scale the frame

      // eslint-disable-next-line no-undef
      resframe[out] = frame.clone()
    }
    frame.close()
    return resframe
  }
}

class AVEncrypt extends AVTransformStream {
  constructor(args) {
    super(args)
    this.key = null
    this.keyindex = null
  }

  async transform(chunk) {
    // ok chunk is a video frame

    // 96 bits iv as recommend by specification
    // eslint-disable-next-line no-restricted-globals
    const iv = self.crypto.getRandomValues(new Uint8Array(12))

    const plaindata = new ArrayBuffer(chunk.frame.byteLength)
    chunk.frame.copyTo(plaindata)

    const keystore = AVKeyStore.getKeyStore()

    const curkeyid = await keystore.getCurKeyId()
    if (curkeyid !== this.keyindex && chunk.frame.type === 'key') {
      // we only change the key on keyframes!
      this.key = await keystore.getKey(curkeyid)
      this.keyindex = curkeyid
    }

    const rec = false // fix e2e to true for now

    // eslint-disable-next-line no-restricted-globals
    const encdata = self.crypto.subtle.encrypt(
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
    // eslint-disable-next-line no-restricted-globals
    return self.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    )
  }
}

class AVDecrypt extends AVTransformStream {
  constructor(args) {
    super(args)
    this.key = null
    this.keyindex = null
    this.chunkMaker = args.chunkMaker
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
      const keystore = AVKeyStore.getKeyStore()

      if (chunk.keyindex !== this.keyindex) {
        console.log('AVDecrypt getKey', chunk.keyindex, this.keyindex)
        this.key = await keystore.getKey(chunk.keyindex)
        console.log('AVDecrypt getKey after', chunk.keyindex, this.keyindex)
        this.keyindex = chunk.keyindex
      }
      // eslint-disable-next-line no-restricted-globals
      const decdata = self.crypto.subtle.decrypt(
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

class BsonFramer extends AVTransformStream {
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

class AVFramer extends AVTransformStream {
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
    if (metadata.svc && metadata.svc.temporalLayerId) {
      hdrflags1 |= 1 << 1
      hdrlen += 4
    }
    if (metadata.decoderConfig && metadata.decoderConfig) {
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
    if (metadata.svc && metadata.svc.temporalLayerId) {
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

class BasicDeframer extends AVTransformStream {
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

class BsonDeFramer extends BasicDeframer {
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

class AVDeFramer extends BasicDeframer {
  constructor(args) {
    super(args)
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

class AVProcessor {
  constructor(args) {
    this.webworkid = args.webworkid
    this.queryid = 0 // query id for tickets
    this.ticketProm = []
    this.ticketRes = []
    this.ticketRej = []
  }

  async bidiStreamToLoop({
    bidiStream /* function for getting the input Stream */,
    reset,
    inputStream,
    outputStream,
    tag,
    running
  }) {
    const ls = {
      lastupdate: new Date(),
      position: -1,
      set pos(pos) {
        this.lastupdate = new Date()
        this.position = pos
      },
      get pos() {
        return this.position
      },
      wpos: -1,
      rpos: -1,
      read1: 0,
      write1: 0,
      read2: 0,
      write2: 0,
      run: 0
    }
    const statusPoll = setInterval(() => {
      console.log(tag, 'bSTL loop status', JSON.stringify(ls))
    }, 5000)
    while (running()) {
      let iowriter
      let ioreader
      ls.pos = 1

      try {
        const bStream = await bidiStream()
        ls.pos = 2
        let resetrun = true
        while (resetrun) {
          try {
            ls.pos = 2.1
            await reset()
            ls.pos = 2.2
            resetrun = false
          } catch (error) {
            console.log(tag, 'bidiStreamToLoopProblem reset output', error)
            ls.pos = 2.3
            await new Promise((resolve) => setTimeout(resolve, 5000))
          }
        }
        ls.pos = 3
        iowriter = outputStream().writable.getWriter()
        ioreader = inputStream().readable.getReader()
        const bwriter = bStream.writable.getWriter()
        const breader = bStream.readable.getReader()
        let pumping = true
        const work = []
        let failreject
        const failprom = new Promise((resolve, reject) => {
          failreject = reject
        })
        const bread = async () => {
          try {
            ls.rpos = 1
            const res = await Promise.race([breader.read(), failprom])
            ls.rpos = 2
            if (res.value) {
              ls.read1 += res.value.byteLength
              ls.rpos = 3
              await Promise.race([iowriter.write(res.value), failprom])
              ls.rpos = 4
              ls.write1 += res.value.byteLength
            }
            if (res.done) {
              ls.rpos = 5
              throw new Error('B pumping read failed')
            }
          } catch (error) {
            console.log(tag, ' bread err', error)
            ls.rpos = 6
            return 'brE'
          }
          // ls.rpos = 7
          return 'br'
        }
        const bwrit = async () => {
          try {
            ls.wpos = 1
            const res = await Promise.race([ioreader.read(), failprom])
            ls.wpos = 2
            if (res.value) {
              ls.read2 += res.value.byteLength
              ls.wpos = 3
              await Promise.race([bwriter.write(res.value), failprom])
              ls.wpos = 4
              ls.write2 += res.value.byteLength
            }
            if (res.done) {
              ls.wpos = 5
              throw new Error('Io pumping read failed')
            }
          } catch (error) {
            console.log(tag, 'bread err', error)
            ls.wpos = 6
            return 'bwE'
          }
          // ls.wpos = 7
          return 'bw'
        }
        ls.pos = 4
        while (pumping) {
          ls.run++
          if (!work[0]) work[0] = bread()
          if (!work[1]) work[1] = bwrit()
          ls.pos = 5
          const ready = await Promise.race(work)
          ls.pos = 6
          switch (ready) {
            case 'br':
              delete work[0]
              break
            case 'bw':
              delete work[1]

              break
            case 'brE':
              // We errored on one stream
              pumping = false
              failreject()
              break
            case 'bwE':
              // We errored on one stream
              pumping = false
              failreject()
              break
            default:
              throw new Error('Unexpected case')
          }
          ls.pos = 7
        }
      } catch (error) {
        console.log(tag, 'error bidi loop', error)
      }
      console.log(tag, 'bSTL loop reset 5')
      try {
        ls.pos = 8
        console.log(tag, 'bSTL loop out', JSON.stringify(ls))
        ioreader.releaseLock()
        iowriter.releaseLock()
        ls.pos = 9
      } catch (error) {
        console.log(tag, 'error release lock', error)
      }
    }
    clearInterval(statusPoll)
  }
  /*
  async pipeToLoop(
    args // srcstream, deststream, reset as callback
  ) {
    let deststream
    let srcstream
    let deststreamWritable
    let srcstreamReadable
    let reader
    let writer
    let running = true
    let readerfailed
    let writerfailed
    const pipetoloopstatus = {
      lastupdate: new Date(),
      position: -1,
      read: 0,
      write: 0
    }
    const statusPoll = setInterval(() => {
      console.log(args.tag, 'loop status', JSON.stringify(pipetoloopstatus))
    }, 5000)

    const timedBlock = async (funcprom, timeout) => {
      let timeoutnum
      const timeprom = new Promise((resolve, reject) => {
        timeoutnum = setTimeout(() => resolve({ failed: true }), timeout)
      })
      const res = await Promise.race([funcprom, timeprom])

      if (res?.failed) throw new Error('Timed out')
      else {
        clearTimeout(timeoutnum)
        return res
      }
    }

    while (running) {
      try {
        let res = {}
        pipetoloopstatus.position = 0
        pipetoloopstatus.lastupdate = new Date()
        const curdeststream = await args.deststream()
        pipetoloopstatus.position = 1
        const cursrcstream = await args.srcstream()
        pipetoloopstatus.position = 2
        const curdeststreamWritable = curdeststream
          ? curdeststream.writable
          : undefined
        const cursrcstreamReadable = cursrcstream
          ? cursrcstream.readable
          : undefined

        if (
          reader &&
          writer &&
          cursrcstreamReadable === srcstreamReadable &&
          curdeststreamWritable === deststreamWritable &&
          !readerfailed &&
          !writerfailed
        ) {
          try {
            res = await reader.read()
          } catch (error) {
            console.log(args.tag, 'reader failed', error)
            readerfailed = true
          }
        }
        pipetoloopstatus.position = 3
        if (res.value) pipetoloopstatus.read += res.value.byteLength
        if (res.done) {
          console.log(args.tag, 'reader res.done')
          readerfailed = true
        }

        if (curdeststreamWritable !== deststreamWritable) {
          console.log(
            args.tag,
            'dest stream exchanged',
            curdeststream,
            srcstream,
            args.resetOutput
          )
          if (writer) {
            try {
              pipetoloopstatus.position = 3.1
              if (!writerfailed) await writer.close() // close the webtransport stream
              pipetoloopstatus.position = 3.2
              writer.releaseLock()
            } catch (error) {
              console.log('writer close failed', error)
            }
            if (writerfailed) {
              try {
                if (deststream) {
                  pipetoloopstatus.position = 3.3
                  await deststreamWritable.close()
                  pipetoloopstatus.position = 3.4
                }
              } catch (error) {
                console.log('deststream writable close failed', error)
              }
            }
          }
          res.value = undefined
          res.done = undefined

          if (args.resetOutput) {
            console.log(args.tag, 'dest stream exchanged resetOutput before')
            pipetoloopstatus.position = 3.5
            await args.resetOutput()
            pipetoloopstatus.position = 3.6
            console.log(args.tag, 'dest stream exchanged resetOutput after')
          }
          deststream = curdeststream
          deststreamWritable = curdeststreamWritable
          writer = deststreamWritable.getWriter()
          writerfailed = undefined
        }
        pipetoloopstatus.position = 4

        if (cursrcstreamReadable !== srcstreamReadable) {
          console.log(
            args.tag,
            'src stream exchanged' /*
            cursrcstream,
            srcstream,
            args.resetInput *
          )
          if (reader) {
            try {
              if (!readerfailed) await reader.cancel()
              reader.releaseLock()
            } catch (error) {
              console.log('reader failed close', error)
            }
            if (readerfailed) {
              try {
                if (srcstream) await srcstreamReadable.cancel()
              } catch (error) {
                console.log('writer failed close', error)
              }
            }
          }
          if (args.resetInput) {
            await args.resetInput(reader)
          }
          srcstream = cursrcstream
          srcstreamReadable = cursrcstreamReadable
          reader = srcstreamReadable.getReader()
          readerfailed = undefined
        }
        pipetoloopstatus.position = 5

        if (res.value) {
          try {
            await timedBlock(writer.write(res.value), 5000)
            if (res?.value) pipetoloopstatus.write += res.value.byteLength
          } catch (error) {
            console.log(args.tag, 'writer failed', error)
            writerfailed = true
          }
        }
        pipetoloopstatus.position = 6

        // We are running infinitely
        /* if (res.done) {
          console.log(args.tag, 'loop res done case')
          await writer.close()
          running = false
        } *
        pipetoloopstatus.position = 7

        if (writerfailed && writer) {
          writer.releaseLock()
          writer = undefined
        }
        pipetoloopstatus.position = 8

        if (readerfailed && reader) {
          reader.releaseLock()
          reader = undefined
        }
        pipetoloopstatus.position = 9

        if (readerfailed) {
          console.log(
            'read failed 1',
            args.reconnectInput,
            srcstream,
            deststream
          )
          pipetoloopstatus.position = 9.1
          const cursrcstream = await args.srcstream()
          if (args.reconnectInput && cursrcstream === srcstream) {
            console.log('pipeToLoop called reconnectInput before')
            pipetoloopstatus.position = 9.2
            try {
              await args.reconnectInput()
            } catch (error) {
              console.log('pipeToLoop reconnectInput failed', error)
            }
            console.log('pipeToLoop called reconnectInput after')
          }
          pipetoloopstatus.position = 10
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
        pipetoloopstatus.position = 11

        if (writerfailed) {
          console.log(
            'write failed 1',
            args.reconnectOutput,
            srcstream,
            deststream
          )
          const curdeststream = await args.deststream()
          if (args.reconnectOutput && curdeststream === deststream) {
            console.log('pipeToLoop called reconnectOutputbefore')
            try {
              await args.reconnectOutput()
            } catch (error) {
              console.log('pipeToLoop reconnectOutput failed', error)
            }
            console.log('pipeToLoop called reconnectOutput after')
          }
          pipetoloopstatus.position = 12
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (error) {
        pipetoloopstatus.position = 13
        console.log(args.tag, ' error in pipe to loop', error)

        await new Promise((resolve) => setTimeout(resolve, 1000))
        pipetoloopstatus.position = 14
      }
      pipetoloopstatus.position = 15
    }
    console.log(args.tag, 'loop status exited')
    clearInterval(statusPoll)
  } */

  async getTickets({ id, dir }) {
    const queryid = this.queryid
    this.queryid++
    this.ticketProm[queryid] = new Promise((resolve, reject) => {
      this.ticketRes[queryid] = resolve
      this.ticketRej[queryid] = reject
      AVWorker.ncPipe.postMessage({
        command: 'getrouting',
        data: {
          id,
          dir
        },
        webworkid: this.webworkid,
        queryid
      })
    })
    return this.ticketProm[queryid]
  }

  receiveTickets(data) {
    const queryid = data.queryid
    if (queryid === undefined) return
    if (data.error || !data.data) {
      if (this.ticketRes[queryid]) {
        const res = this.ticketRes[queryid]
        delete this.ticketRes[queryid]
        delete this.ticketRej[queryid]
        res(null)
      }
    } else if (this.ticketRes[queryid]) {
      const res = this.ticketRes[queryid]
      delete this.ticketRes[queryid]
      delete this.ticketRej[queryid]
      console.log('ticketres', queryid, data.data.tickets)
      res(
        data.data.tickets.map((el) => ({
          aeskey: el.aeskey ? new Uint8Array(el.aeskey) : undefined,
          payload: el.payload ? new Uint8Array(el.payload) : undefined,
          iv: el.iv ? new Uint8Array(el.iv) : undefined
        }))
      )
    }
  }
}

class AVInputProcessor extends AVProcessor {
  // input means input from camera
  constructor(args) {
    super(args)
    this.inputstream = args.inputstream

    this.encoder = {}
    this.encrypt = {}
    this.framer = {}
    this.outputctrldeframer = {}

    this.streamDest = {}
    this.streamDestRes = {}

    this.adOutgoing = null

    this.skipedFrames = {}

    this.lastoffersend = 0

    this.qcs = {}
  }

  initPipeline() {
    for (const qual in this.qualities) {
      this.encrypt[qual] = new AVEncrypt()
      this.framer[qual] = new AVFramer({ type: this.datatype })
      this.outputctrldeframer[qual] = new BsonDeFramer()
    }
  }

  close() {
    for (const qual in this.qualities) {
      const codec = this.encoder[qual]
      if (codec) {
        codec.close()
        delete this.encoder[qual]
      }
    }
  }

  finalize() {
    this.close()
  }

  setStreamDest(stream) {
    this.streamDest = stream
  }

  decreaseQuality() {
    // check if it is possible
    const oldqualmax = this.qualmax
    if (this.qualmax > 0) {
      this.qualmax--
      this.multscaler.setMaxOutputLevel(this.qualmax)
      this.framer[oldqualmax].sendBson({
        task: 'suspendQuality'
      })
    }
  }

  increaseQuality() {
    // check if it is possible
    if (this.qualmax < this.qualities.length - 1) {
      this.qualmax++
      this.multscaler.setMaxOutputLevel(this.qualmax)
    }
  }

  skipframe(quality) {
    if (!this.skipedFrames[quality]) this.skipedFrames[quality] = 0
    this.skipedFrames[quality]++
  }

  // should go to seperate object for audio and video
  handleQualityControl(qualinfo) {
    console.log(
      'type',
      this.datatype,
      'out quality ',
      qualinfo.quality,
      ' info bytes per sec:',
      qualinfo.bytesPerSecond,
      ' frames: ',
      qualinfo.framesPerSecond,
      ' skiped Frames: ',
      qualinfo.skipedFrames,
      ' jitter:',
      qualinfo.frameJitter,
      ' framedelta:',
      qualinfo.timePerFrame
    )
    this.qcs[qualinfo.quality] = qualinfo

    // check for problems
    const now = Date.now()
    let problem = false
    let upgrade = true
    for (const quality in this.qcs) {
      const curqual = this.qcs[quality]
      if (curqual.framesPerSecond < this.minimalframerate) problem = true
      if (curqual.jitter / qualinfo.timePerFrame > 0.8) problem = true
      if (curqual.skipedFrames > this.maxSkippedFrames) problem = true

      if (curqual.framesPerSecond < this.lowerframerate) upgrade = false
      if (curqual.jitter / qualinfo.timePerFrame > 0.04) upgrade = false
      if (curqual.skipedFrames > 0) upgrade = false
    }
    if (problem) {
      delete this.lastqualityUpgrade
      if (!this.lastqualityProblem) this.lastqualityProblem = now
      else if (now - this.lastqualityProblem > 3000) {
        // we act after 3 seconds
        delete this.lastqualityProblem
        this.decreaseQuality()
      }
    } else {
      delete this.lastqualityProblem
      if (upgrade) {
        if (!this.lastqualityUpgrade) this.lastqualityUpgrade = now
        else if (now - this.lastqualityUpgrade > 8000) {
          // we act after 20 seconds
          delete this.lastqualityUpgrade
          this.increaseQuality()
        }
      } else {
        delete this.lastqualityUpgrade
      }
    }
  }

  async qualityControlLoop(quality) {
    this.qclrunning = true
    const reader = this.outputctrldeframer[quality].readable.getReader()
    try {
      let lasttime = 0
      let senddata
      let frames
      let lastframetimeSender = 0n
      let lastframetimeReceiver
      let jitter = 0
      let framedelta = 0
      while (this.qclrunning) {
        const { done, value } = await reader.read()
        if (done) {
          this.qclrunning = false
          break
        }
        if (value) {
          const qcl = value
          if (qcl.timestamp) qcl.timestamp = BigInt(qcl.timestamp.toString())
          if (qcl.task === 'start') {
            const deltatime = qcl.time - lasttime
            if (!lasttime || deltatime > 1000) {
              const qualinfo = {
                quality,
                bytesPerSecond: (senddata / deltatime) * 1000,
                framesPerSecond: (frames / deltatime) * 1000,
                frameJitter: Math.sqrt(jitter) / frames,
                timePerFrame: framedelta / frames,
                skipedFrames: (this.skipedFrames[quality] / deltatime) * 1000
              }
              this.handleQualityControl(qualinfo)
              lasttime = qcl.time
              senddata = 0
              frames = 0
              jitter = 0
              framedelta = 0
              this.skipedFrames[quality] = 0
            }
            frames++
            const senderdelta = Number(
              (qcl.timestamp - lastframetimeSender) / 1000n
            )

            const receiverdelta = qcl.time - lastframetimeReceiver
            jitter +=
              (senderdelta - receiverdelta) * (senderdelta - receiverdelta)
            framedelta += senderdelta
            lastframetimeSender = qcl.timestamp
            lastframetimeReceiver = qcl.time
          } else if (qcl.task === 'end') {
            senddata += qcl.size
          }
          // console.log('qcl message', qcl)
        }
      }
    } catch (error) {
      console.log(
        'type',
        this.datatype,
        ' Problem in quality control loop',
        error
      )
    }
    reader.releaseLock()
  }

  buildOutgoingPipeline() {
    if (!this.inputstream) throw new Error('inputstream not set')
    try {
      let curstream = this.inputstream
      curstream.pipeTo(this.multscaler.writable, {
        preventClose: true,
        preventAbort: true
      })
      this.initialconnect = []
      for (const qual in this.qualities) {
        this.streamDest[qual] = new Promise((resolve) => {
          this.streamDestRes[qual] = resolve
        })
        this.initialconnect[qual] = true

        curstream = this.multscaler.readable[qual]
        // encoder
        curstream.pipeTo(this.encoder[qual].writable)
        curstream = this.encoder[qual].readable
        curstream.pipeTo(this.encrypt[qual].writable)
        curstream = this.encrypt[qual].readable
        curstream.pipeTo(this.framer[qual].writable)
        curstream = this.framer[qual].readable
        const pipesMaker = (quality) => {
          this.bidiStreamToLoop({
            bidiStream: async () => {
              const avtransport = AVTransport.getInterface()
              let newstream
              while (!newstream) {
                try {
                  newstream = await avtransport.getIncomingStream()
                  // it pipeline already build reconnected
                } catch (error) {
                  console.log(
                    'type',
                    this.datatype,
                    'qual:',
                    quality,
                    ' getIncomingStream failed rDS, retry',
                    error
                  )
                }
                if (!newstream)
                  await new Promise((resolve) =>
                    setTimeout(() => {
                      console.log(
                        'type',
                        this.datatype,
                        'qual:',
                        quality,
                        'getIncomingStream waiter'
                      )
                      resolve()
                    }, 2000)
                  )
              }
              return newstream
            } /* function for getting the input Stream */,
            reset: async () => {
              const tag = quality + ' outgoing ' + this.datatype
              console.log('before RESET outputctrldeframer', tag)
              this.outputctrldeframer[quality].reset()
              console.log('RESET outputctrldeframer', tag)
              try {
                console.log('RECONNECT OUTPUT BEFORE', tag)
                const tickets = await this.getTickets({
                  id: this.destid,
                  dir: 'out'
                })
                console.log('RECONNECT OUTPUT', tickets, tag)
                if (!tickets) {
                  throw new Error('no tickets out retry', this.destid)
                }
                console.log('RECONNECT OUTPUT 1', tag)
                this.framer[quality].resetOutput() // gets a new empty stream
                // then queue the bson
                console.log('RECONNECT OUTPUT 2', tag)
                this.framer[quality].sendBson({
                  command: 'configure',
                  dir: 'incoming', // routers perspective
                  tickets,
                  quality,
                  type: this.datatype
                })
                console.log('RECONNECT OUTPUT 3', tag)
                this.framer[quality].resendConfigs()
                console.log('RECONNECT OUTPUT 4', tag)
              } catch (error) {
                console.log('resetOutput failed', error, tag)
                throw new Error('resetOutput failed')
              }
            },
            inputStream: () => this.framer[quality],
            outputStream: () => this.outputctrldeframer[quality],
            tag: quality + ' outgoing ' + this.datatype,
            running: () => true
          }).catch((error) => {
            console.log('AVIP ', qual, 'Bidi prob:', error)
          })
          /*
          this.pipeToLoop({
            deststream: () => this.streamDest[quality],
            srcstream: () => this.framer[quality],
            resetOutput: async () => {
              try {
                console.log('RECONNECT OUTPUT BEFORE')
                const tickets = await this.getTickets({
                  id: this.destid,
                  dir: 'out'
                })
                console.log('RECONNECT OUTPUT', tickets)
                if (!tickets) {
                  await new Promise((resolve) => {
                    // take a break
                    setTimeout(resolve, 5000)
                  })
                  throw new Error(
                    'no tickets out retry after 5 seconds',
                    this.destid
                  )
                }
                this.framer[quality].resetOutput() // gets a new empty stream
                // then queue the bson
                this.framer[quality].sendBson({
                  command: 'configure',
                  dir: 'incoming', // routers perspective
                  tickets,
                  quality,
                  type: this.datatype
                })
                this.framer[quality].resendConfigs()
              } catch (error) {
                console.log('resetOutput failed', error)
                throw new Error('resetOutput failed')
              }
            },
            reconnectOutput: async () => await this.reconnect(quality),
            tag: quality + ' out ' + this.datatype
          }) // first pipeToLoop
          this.pipeToLoop({
            srcstream: () => this.streamDest[quality],
            deststream: () => this.outputctrldeframer[quality],
            resetInput: () => {
              this.outputctrldeframer[quality].reset()
              console.log('RESET outputctrldeframer')
            },
            reconnectInput: async () => await this.reconnect(quality),
            tag: quality + ' out control ' + this.datatype
          }) */
        }
        pipesMaker(qual)
        // quality control
        this.qualityControlLoop(qual)
      }

      const avoffersend = async () => {
        let ostatus = {}
        if (this.offerStatus) ostatus = await this.offerStatus() // a callback, that may add more infos about incoming data
        // in this way we can remove an offer
        if (ostatus) {
          AVWorker.ncPipe.postMessage({
            command: 'avoffer',
            data: { type: this.datatype, ...ostatus }
          })
          this.lastoffersend = Date.now()
        }
      }
      avoffersend()

      if (this.adOutgoing) clearInterval(this.adOutgoing)
      let offerinterval = 1000 * 2
      if (this.datatype === 'audio') offerinterval = 100
      this.adOutgoing = setInterval(avoffersend, offerinterval) // ms, especially important for audio
    } catch (error) {
      console.log(
        'type',
        this.datatype,
        ' build outgoing pipeline error',
        error
      )
    }
  }

  async reconnect(quality) {
    const avtransport = AVTransport.getInterface()
    console.log('reconnect input processor for qual:', quality)
    if (!this.streamDestRes[quality]) {
      // we are first to reconnect
      this.streamDest[quality] = new Promise((resolve) => {
        this.streamDestRes[quality] = resolve
      })
    } else {
      if (this.initialconnect[quality]) {
        delete this.initialconnect[quality]
      } else {
        // someone else is reconnecting
        try {
          await this.streamDest[quality]
        } catch (error) {
          console.log('problem waiting for other reconnect:', error)
        }
        return
      }
    }

    let newstream
    while (!newstream) {
      try {
        newstream = await avtransport.getIncomingStream()
        // it pipeline already build reconnected
      } catch (error) {
        console.log(
          'type',
          this.datatype,
          'qual:',
          quality,
          ' getIncomingStream failed rDS, retry',
          error
        )
      }
      if (!newstream)
        await new Promise((resolve) =>
          setTimeout(() => {
            console.log(
              'type',
              this.datatype,
              'qual:',
              quality,
              'getIncomingStream waiter'
            )
            resolve()
          }, 2000)
        )
    }
    console.log(
      'type',
      this.datatype,
      'qual:',
      quality,
      'reconnect new stream',
      newstream
    )
    this.streamDestRes[quality](newstream)
    delete this.streamDestRes[quality]
  }

  async setDestId(id) {
    // dest is our id
    this.destid = id
    try {
      const reconprom = []
      for (const qual in this.qualities) {
        console.log('setDestId reconnect', qual, id)
        reconprom.push(this.reconnect(qual))
      }
      await Promise.all(reconprom)
    } catch (error) {
      console.log('reconnect with DestId failed', id, ':', error)
    }
  }
}

class AVVideoInputProcessor extends AVInputProcessor {
  constructor(args) {
    super(args)

    this.qualities = [1, 4]
    this.qualmax = 0
    this.datatype = 'video'
    this.lowerframerate = 14
    this.minimalframerate = 10
    this.maxSkippedFrames = 5 // video should tolerate this

    this.initPipeline()
  }

  changeOff(off) {
    console.log('multscaler peak', this.multscaler, this.multscaler.changeOff)
    this.multscaler.changeOff(off)
  }

  switchVideoCamera(args) {
    this.inputstream
      .cancel()
      .catch((error) => console.log('Error cancel videoinpustream:', error))
    this.inputstream = args.inputstream
    this.inputstream.pipeTo(this.multscaler.writable, {
      preventClose: true,
      preventAbort: true
    })
  }

  initPipeline() {
    super.initPipeline()
    this.multscaler = new AVOneFrameToManyScaler({
      outputlevel: this.qualities,
      outputlevelmain: this.qualities[0] // the blocking one
    })

    this.multscaler.setMaxOutputLevel(this.qualmax /* best quality is 1 */)
    this.multscaler.setSkipframeCallback(this.skipframe)

    for (const qual in this.qualities) {
      const outputlevel = qual
      this.encoder[qual] = new AVVideoEncoder({ outputlevel })
    }
  }
}

class AVAudioInputProcessor extends AVInputProcessor {
  constructor(args) {
    super(args)

    this.qualities = [0, 1]
    this.qualmax = 0
    this.datatype = 'audio'
    // tweak these, opus default is 20 ms, means 50 fps
    this.lowerframerate = 14
    this.minimalframerate = 10
    this.maxSkippedFrames = 0 // one frame is already too much for audio

    this.dbPromsRes = []

    this.initPipeline()
  }

  switchAudioMicrophone(args) {
    this.inputstream
      .cancel()
      .catch((error) => console.log('Error cancel audio inputstream:', error))
    this.inputstream = args.inputstream
    this.inputstream.pipeTo(this.multscaler.writable, {
      preventClose: true,
      preventAbort: true
    })
  }

  changeMute(muted) {
    this.multscaler.changeMute(muted)
  }

  initPipeline() {
    super.initPipeline()
    this.multscaler = new AVOneToManyCopy({
      outputlevel: this.qualities,
      outputlevelmain: this.qualities[0] // the blocking one
    })
    this.multscaler.setSkipframeCallback(this.skipframe)

    this.multscaler.setMaxOutputLevel(this.qualmax /* best quality is 1 */)

    for (const qual in this.qualities) {
      const outputlevel = qual
      this.encoder[qual] = new AVAudioEncoder({ outputlevel })
    }
  }

  async offerStatus() {
    const prom = new Promise((resolve) => {
      this.dbPromsRes.push(resolve)
    })
    avworker.sendMessage({ task: 'getDb', webworkid: this.webworkid })

    const db = await prom

    if (Date.now() - this.lastoffersend > 5000 || db > -70) return { db }
    else return undefined
  }

  reportDb(db) {
    const res = this.dbPromsRes.shift()
    // console.log('reportDB')
    if (res) res(db)
  }
}

class AVOutputProcessor extends AVProcessor {
  constructor(args) {
    super(args)

    this.qualityInspect = this.qualityInspect.bind(this)

    this.deframer = new AVDeFramer(/* { type: 'video' } */)
    this.deframer.setFrameInspector(this.qualityInspect)
    this.inputctrlframer = new BsonFramer()
    this.streamSrc = null
    this.streamSrcRes = null

    this.qualityStatsInt = {
      lasttime: 0,
      senddata: 0,
      frames: 0,
      lastframetimeSender: 0n,
      lastframetimeReceiver: 0,
      jitter: 0,
      framedelta: 0
    }

    this.scmqueue = []
  }

  close() {
    const codec = this.decoder
    if (codec) {
      codec.close()
      this.decoder = null
    }
  }

  finalize() {
    clearInterval(this.nopint)
    this.close()
  }

  decreaseQuality() {
    this.sendControlMessage({
      task: 'decQual'
    })
  }

  increaseQuality() {
    this.sendControlMessage({
      task: 'incQual'
    })
  }

  async processMessages() {
    while (this.scmqueue.length > 0) {
      const current = this.scmqueue[0]
      console.log('processMessage b4', JSON.stringify(current))
      try {
        await this.inputctrlframerwriter.write(current)
        console.log('processMessage bat', JSON.stringify(current))
        this.scmqueue.shift()
      } catch (error) {
        console.log('processMessage error', error)
      }
    }
  }

  sendControlMessage(mess) {
    this.scmqueue.push(mess)
    if (this.scmqueue.length === 1) {
      this.processMessages().catch((error) => {
        console.log('error processMessages', error)
      })
    }
  }

  qualityInspect(frame) {
    const qci = this.qualityStatsInt
    const sendertime = frame.framedata.timestamp
    const receivetime = Date.now()

    const deltatime = receivetime - qci.lasttime
    if (!qci.lasttime || deltatime > 1000) {
      const qualinfo = {
        /* quality, */
        bytesPerSecond: (qci.senddata / deltatime) * 1000,
        framesPerSecond: (qci.frames / deltatime) * 1000,
        frameJitter: Math.sqrt(qci.jitter) / qci.frames,
        timePerFrame: qci.framedelta / qci.frames
      }
      this.handleQualityControl(qualinfo)
      qci.lasttime = receivetime
      qci.senddata = 0
      qci.frames = 0
      qci.jitter = 0
      qci.framedelta = 0
    }
    qci.frames++
    const senderdelta = Number((sendertime - qci.lastframetimeSender) / 1000n)

    const receiverdelta = receivetime - qci.lastframetimeReceiver
    qci.jitter += (senderdelta - receiverdelta) * (senderdelta - receiverdelta)
    qci.framedelta += senderdelta
    qci.lastframetimeSender = sendertime
    qci.lastframetimeReceiver = receivetime
    qci.senddata += frame.data.byteLength
  }

  handleQualityControl(qualinfo) {
    console.log(
      'type',
      this.datatype,
      'in quality ',
      qualinfo.quality,
      ' info bytes per sec:',
      qualinfo.bytesPerSecond,
      ' frames: ',
      qualinfo.framesPerSecond,
      ' jitter:',
      qualinfo.frameJitter,
      ' framedelta:',
      qualinfo.timePerFrame
    )

    this.qcs = qualinfo

    // check for problems
    const now = Date.now()
    let problem = false
    let upgrade = true
    const curqual = this.qcs
    if (curqual.framesPerSecond < 10) problem = true
    if (curqual.jitter / qualinfo.timePerFrame > 0.8) problem = true

    if (curqual.framesPerSecond < 14) upgrade = false
    if (curqual.jitter / qualinfo.timePerFrame > 0.04) upgrade = false

    if (problem) {
      delete this.lastqualityUpgrade
      if (!this.lastqualityProblem) this.lastqualityProblem = now
      else if (now - this.lastqualityProblem > 3000) {
        // we act after 3 seconds
        delete this.lastqualityProblem
        this.decreaseQuality()
      }
    } else {
      delete this.lastqualityProblem
      if (upgrade) {
        if (!this.lastqualityUpgrade) this.lastqualityUpgrade = now
        else if (now - this.lastqualityUpgrade > 8000) {
          // we act after 20 seconds
          delete this.lastqualityUpgrade
          this.increaseQuality()
        }
      } else {
        delete this.lastqualityUpgrade
      }
    }
  }

  buildIncomingPipeline() {
    try {
      this.streamSrc = new Promise((resolve) => {
        this.streamSrcRes = resolve
      })
      const initialconnect = new Promise((resolve) => {
        if (!this.srcid) this.initialresolve = resolve
        else resolve()
      })

      let curstream = this.deframer.readable
      curstream.pipeTo(this.decrypt.writable)
      curstream = this.decrypt.readable
      curstream.pipeTo(this.decoder.writable)
      curstream = this.decoder.readable

      if (this.outputwritable) {
        curstream.pipeTo(this.outputwritable)
      }
      this.inputctrlframerwriter = this.inputctrlframer.writable.getWriter()

      const pipesMaker = () => {
        this.bidiStreamToLoop({
          bidiStream: async () => {
            /* function for getting the input Stream */
            const avtransport = AVTransport.getInterface()
            let newstream
            while (!newstream) {
              try {
                newstream = await avtransport.getIncomingStream()
                // it pipeline already build reconnected
              } catch (error) {
                console.log(
                  'type',
                  this.datatype,
                  ' getIncomingStream failed rDS, retry in 5 seconds',
                  error
                )
              }
              if (!newstream)
                await new Promise((resolve) => setTimeout(resolve, 5000))
            }
            return newstream
          },
          reset: async () => {
            try {
              console.log('DEBUG INPUT RESET 0')
              this.deframer.reset()
              console.log('DEBUG INPUT RESET 1')
              await initialconnect
              console.log('DEBUG INPUT RESET 2')
              const tickets = await this.getTickets({
                id: this.srcid,
                dir: 'in'
              })
              console.log('DEBUG INPUT RESET 3')
              if (!tickets) {
                await new Promise((resolve) => {
                  // take a break
                  setTimeout(resolve, 5000)
                })
                throw new Error(
                  'no tickets in retry after 5 seconds',
                  'type',
                  this.datatype,
                  'srcid',
                  this.srcid
                )
              }
              console.log('DEBUG INPUT RESET 4')
              this.scmqueue.length = 0
              this.inputctrlframer.reset()
              console.log('DEBUG INPUT RESET 5')
              this.sendControlMessage({
                command: 'configure',
                dir: 'outgoing', // routers perspective
                tickets,
                type: this.datatype
              })
              console.log('DEBUG INPUT RESET 6')
            } catch (error) {
              console.log('problem reset output', error)
              throw new Error('Resetoutput failed')
            }
          },
          inputStream: () => this.inputctrlframer,
          outputStream: () => this.deframer,
          tag: 'incoming ' + this.datatype,
          running: () => true
        })
        /* this.pipeToLoop({
          deststream: () => this.deframer,
          srcstream: () => this.streamSrc,
          resetInput: () => {
            this.deframer.reset()
          },
          reconnectInput: async () => await this.reconnect(),
          tag: 'output in ' + this.datatype
        }) // first pipeToLoop
        this.pipeToLoop({
          deststream: () => this.streamSrc,
          srcstream: () => this.inputctrlframer,
          resetOutput: async () => {
            try {
              const tickets = await this.getTickets({
                id: this.srcid,
                dir: 'in'
              })
              if (!tickets) {
                await new Promise((resolve) => {
                  // take a break
                  setTimeout(resolve, 5000)
                })
                throw new Error(
                  'no tickets in retry after 5 seconds',
                  this.srcid
                )
              }
              this.inputctrlframer.reset()
              this.sendControlMessage({
                command: 'configure',
                dir: 'outgoing', // routers perspective
                tickets,
                type: this.datatype
              }).catch((error) => {
                console.log('SCM in resetOutput failed:', error)
              })
            } catch (error) {
              console.log('problem reset output', error)
              throw new Error('Resetoutput failed')
            }
          },
          reconnectOutput: async () => await this.reconnect(),
          tag: 'output in control ' + this.datatype
        }) */
      }
      pipesMaker()
      if (this.nopint) clearInterval(this.nopint)
      this.nopint = setInterval(() => {
        console.log('send nop')
        this.sendControlMessage({
          command: 'nop'
        })
      }, 4000)
    } catch (error) {
      console.log('build incoming pipeline error', error)
    }
  }

  /*
  async reconnect() {
    const avtransport = AVTransport.getInterface()
    console.log('type ', this.datatype, ' reconnect outputprocessor')

    if (!this.streamSrcRes) {
      this.streamSrc = new Promise((resolve) => {
        this.streamSrcRes = resolve
      })
    } else {
      if (this.initialconnect) {
        delete this.initialconnect
      } else {
        console.log('some else is reconnecting')
        await this.streamSrc
        return
      }
    }

    let newstream
    while (!newstream) {
      try {
        newstream = await avtransport.getIncomingStream()
        // it pipeline already build reconnected
      } catch (error) {
        console.log(
          'type',
          this.datatype,
          ' getIncomingStream failed rDS, retry in 5 seconds',
          error
        )
      }
      if (!newstream) await new Promise((resolve) => setTimeout(resolve, 5000))
    }
    console.log('reconnect new stream', newstream)

    this.streamSrcRes(newstream)
    this.streamSrcRes = null
  } */

  async setSrcId(id) {
    // dest is our id
    const changed = this.srcid !== id
    this.srcid = id
    console.log('srcId', id, this.datatype)
    if (changed) {
      if (this.initialresolve) {
        const res = this.initialresolve
        delete this.initialresolve
        res()
      } else {
        try {
          let tickets
          while (!tickets && this.srcid === id) {
            try {
              tickets = await this.getTickets({ id: this.srcid, dir: 'in' })
            } catch (error) {
              console.log('srcID ticket problem:', error)
            }
            if (!tickets) {
              console.log('setSrcID ticket not found retry')
              await new Promise((resolve, reject) => setTimeout(resolve, 5000))
            }
          }
          console.log('srcId', {
            task: 'chgId',
            tickets
          })
          await this.sendControlMessage({
            task: 'chgId',
            tickets
          })
        } catch (error) {
          console.log('problem in setSrcId', this.srcid, this.datatype, error)
        }
      }
    }
  }
}

class AVAudioOutputProcessor extends AVOutputProcessor {
  // Output means output to screen
  constructor(args) {
    super(args)
    this.datatype = 'audio'

    this.outputwritable = args.writable

    this.decrypt = new AVDecrypt({
      // eslint-disable-next-line no-undef
      chunkMaker: (arg) => new EncodedAudioChunk(arg)
    })

    this.decoder = new AVAudioDecoder()
  }
}

class AVVideoOutputProcessor extends AVOutputProcessor {
  // Output means output to screen
  constructor(args) {
    super(args)
    this.datatype = 'video'

    this.writeframe = this.writeframe.bind(this)

    this.outputwritable = new WritableStream({
      write: this.writeframe
    })

    this.decrypt = new AVDecrypt({
      // eslint-disable-next-line no-undef
      chunkMaker: (arg) => new EncodedVideoChunk(arg)
    })

    this.decoder = new AVVideoDecoder()
  }

  writeframe(frame, controller) {
    if (this.outputrender && this.outputrender.ctx) {
      const offscreen = this.outputrender.offscreen
      const ctx = this.outputrender.ctx
      if (
        offscreen.width / offscreen.height !==
        frame.displayWidth / frame.displayWidth
      ) {
        offscreen.height =
          (offscreen.width * frame.displayHeight) / frame.displayWidth
      }
      /* console.log(
        'frame',
        offscreen.width,
        offscreen.height,
        frame.codedWidth,
        frame.codedHeight,
        frame.displayWidth,
        frame.displayHeight,
        frame
      ) */
      // offscreen.height = config.codedHeight;
      // offscreen.width = config.codedWidth;
      ctx.drawImage(frame, 0, 0, offscreen.width, offscreen.height)
    }
    frame.close()
  }

  setOutputRender(render) {
    this.outputrender = render
  }
}

class AVKeyStore {
  static instance = null
  constructor(args) {
    this.keys = {}
    this.keysprom = {}
    this.keysres = {}
    this.keysrej = {}
    this.curkeyid = new Promise((resolve) => {
      this.curkeyidres = resolve
    })
  }

  static getKeyStore() {
    if (!AVKeyStore.instance) AVKeyStore.instance = new AVKeyStore()
    return AVKeyStore.instance
  }

  incomingKey(keyobj) {
    const keyid = keyobj.keynum & 0xff
    console.log('incoming key', keyobj)
    this.keys[keyid] = {
      e2e: keyobj.keyE2E,
      rec: keyobj.keyRec,
      exptime: keyobj.exptime
    }
    if (this.keysprom[keyid]) {
      delete this.keysprom[keyid]
      if (this.keysres[keyid]) {
        this.keysres[keyid](this.keys[keyid])
        delete this.keysres[keyid]
        delete this.keysrej[keyid]
      }
    }
    // now we reject pending promises for other keyids
    for (const wkeyid in this.keysrej) {
      this.keysrej[wkeyid](
        new Error('other key arrived instead ' + wkeyid + 'vs' + keyid)
      ) // should prevent blocking decrypter
      delete this.keysres[wkeyid]
      delete this.keysrej[wkeyid]
    }
    if (this.curkeyidres) {
      this.curkeyidres(keyid)
      delete this.curkeyidres
    }
    this.curkeyid = Promise.resolve(keyid)

    const now = Date.now()
    // we also purge expired keys
    for (const kid in this.keys) {
      if (this.keys[kid].exptime > now) delete this.keys[kid]
    }
  }

  getCurKeyId() {
    return this.curkeyid
  }

  async getKey(keynum) {
    let keyinfo = this.keys[keynum]
    if (!keyinfo) {
      let keyprom = this.keysprom[keynum]
      if (!keyprom)
        keyprom = this.keysprom[keynum] = new Promise((resolve, reject) => {
          this.keysres[keynum] = resolve
          this.keysrej[keynum] = reject
        })
      keyprom = await keyprom
      keyinfo = this.keys[keynum]
    }
    return keyinfo
  }
}

class AVWorker {
  static ncPipe = null
  constructor(args) {
    this.onMessage = this.onMessage.bind(this)
    this.objects = {}

    this.handleNetworkControl = this.handleNetworkControl.bind(this)
    this.transportInfoProm = Promise.resolve()
  }

  handleNetworkControl(message) {
    // console.log('network control message', message.data)
    if (message.data.task === 'keychange') {
      const keyobj = message.data.keyobject
      AVKeyStore.getKeyStore().incomingKey(keyobj)
    } else if (message.data.task === 'transportinfo') {
      if (message.data.error) {
        if (this.transportInfoRes) {
          const res = this.transportInfoRes
          delete this.transportInfoRes
          delete this.transportInfoRej
          res(null)
        }
      } else if (this.transportInfoRes) {
        const res = this.transportInfoRes
        delete this.transportInfoRes
        delete this.transportInfoRej
        res(message.data.data)
      }
    } else if (message.data.task === 'tickets') {
      const object = this.objects[message.data.webworkid]
      if (object && object.receiveTickets) {
        object.receiveTickets(message.data)
      } else {
        console.log('unknown webworkid handleNetworkControl')
      }
    } else if (message.data.task === 'idchange') {
      // this invalidates alls tickets and connections, so we must cut the avtransport connection
      console.log('idchange reconnect')
      const avtransport = AVTransport.getInterface()
      if (avtransport) avtransport.forceReconnect()
    }
  }

  sendMessage(message) {
    // eslint-disable-next-line no-restricted-globals
    self.postMessage(message)
  }

  async getTransportInfo() {
    try {
      await this.transportInfoProm
    } catch (error) {
      // ignore, not my business
    }
    this.transportInfoProm = new Promise((resolve, reject) => {
      this.transportInfoRes = resolve
      this.transportInfoRej = reject
      AVWorker.ncPipe.postMessage({
        command: 'gettransportinfo'
      })
    })
    return this.transportInfoProm
  }

  onMessage(event) {
    const task = event.data.task
    if (!event.data.webworkid && task !== 'networkControl')
      throw new Error('no webworkid specified')
    if (task !== 'getDb') {
      console.log('AVWorker onMessage', event)
      console.log('got event with task', task)
    }
    switch (task) {
      case 'openVideoCamera':
        {
          const newobj = new AVVideoInputProcessor({
            webworkid: event.data.webworkid,
            inputstream: event.data.readable
          })
          this.objects[event.data.webworkid] = newobj
        }
        break
      case 'openAudioMicrophone':
        {
          const newobj = new AVAudioInputProcessor({
            webworkid: event.data.webworkid,
            inputstream: event.data.readable
          })
          this.objects[event.data.webworkid] = newobj
        }
        break
      case 'openVideoDisplay':
        {
          const newobj = new AVVideoOutputProcessor({
            webworkid: event.data.webworkid
          })
          this.objects[event.data.webworkid] = newobj
        }
        break
      case 'openAudioSpeaker':
        {
          const newobj = new AVAudioOutputProcessor({
            webworkid: event.data.webworkid,
            writable: event.data.writable
          })
          this.objects[event.data.webworkid] = newobj
        }
        break
      case 'switchVideoCamera':
        {
          const object = this.objects[event.data.webworkid]
          object.switchVideoCamera({
            inputstream: event.data.readable
          })
        }
        break
      case 'switchAudioMicrophone':
        {
          const object = this.objects[event.data.webworkid]
          object.switchAudioMicrophone({
            inputstream: event.data.readable
          })
        }
        break
      case 'muteChangeMic':
        {
          const object = this.objects[event.data.webworkid]
          object.changeMute(event.data.muted)
        }
        break
      case 'offChangeCam':
        {
          const object = this.objects[event.data.webworkid]
          object.changeOff(event.data.off)
        }
        break
      case 'close':
        {
          const object = this.objects[event.data.webworkid]
          if (object && object.close) object.close()
        }
        break
      case 'cleanUpObject':
        {
          const object = this.objects[event.data.webworkid]
          if (object) {
            if (object.finalize) object.finalize()
            delete this.objects[event.data.webworkid]
          }
        }
        break
      case 'openVideoOutStream':
        {
          const newobj = new AVVideoOutStream({
            webworkid: event.data.webworkid,
            outputstream: event.data.writable
          })
          this.objects[event.data.webworkid] = newobj
        }
        break
      case 'setOutputRender':
        {
          const objrender = this.objects[event.data.webworkidrender]
          if (!objrender) throw new Error('no webworkidrender object')

          this.objects[event.data.webworkid].setOutputRender(objrender)
        }
        break
      case 'setSrcId':
        {
          const id = event.data.id
          this.objects[event.data.webworkid].setSrcId(id)
        }
        break
      case 'setDestId':
        {
          const id = event.data.id
          if (!id) {
            console.log('setDestId', event.data)
            throw new Error('destid, no id passed')
          }
          this.objects[event.data.webworkid].setDestId(id)
        }
        break
      case 'buildOutgoingPipeline':
        this.objects[event.data.webworkid].buildOutgoingPipeline()
        break
      case 'buildIncomingPipeline':
        this.objects[event.data.webworkid].buildIncomingPipeline()
        break
      case 'newAVVideoRender':
        {
          const newobj = new AVVideoRenderInt({
            webworkid: event.data.webworkid
          })
          this.objects[event.data.webworkid] = newobj
        }
        break
      case 'AVVideoRenderSize':
        this.objects[event.data.webworkid].updateRenderSize({
          width: event.data.width,
          devicePixelRatio: event.data.devicePixelRatio
        })

        break
      case 'updateOffScreenRender':
        this.objects[event.data.webworkid].updateOffScreenRender(
          event.data.offscreen
        )
        break
      case 'getDb':
        if (this.objects[event.data.webworkid]) {
          this.objects[event.data.webworkid].reportDb(event.data.db)
        }
        break
      case 'networkControl':
        if (event.data.pipe) {
          AVWorker.ncPipe = event.data.pipe
          AVWorker.ncPipe.onmessage = this.handleNetworkControl
        }
        break
      default:
        console.log('Unhandled message task (AVWorker):', task)
    }
  }
}

console.log('before startConnection')
// eslint-disable-next-line prefer-const
let avworker
new AVTransport({
  cb: async () => {
    if (avworker) return await avworker.getTransportInfo()
    return null
  }
}).startConnection()

avworker = new AVWorker()
// eslint-disable-next-line no-restricted-globals
self.addEventListener('message', avworker.onMessage)
console.log('AVWorker started')