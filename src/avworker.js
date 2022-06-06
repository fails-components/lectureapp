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
    this.cur = {}
    this.curcodec = null
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

    this.outputlevel = args.outputlevel

    this.lastkeyframetime = 0

    this.output = this.output.bind(this)

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
  static levelbitrate = [150_000, 64_000, 128_000]

  constructor(args) {
    super(args)

    this.outputlevel = args.outputlevel

    this.output = this.output.bind(this)

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

class AVVideoDecoder extends AVCodec {
  constructor(args) {
    super(args)
    this.configured = false

    this.output = this.output.bind(this)
    this.codecOnWrite = this.codecOnWrite.bind(this)
    // eslint-disable-next-line no-undef
    this.codec = new VideoDecoder({
      output: this.output,
      error(error) {
        console.log('decoder error', error)
      }
    })
  }

  codecFull() {
    return this.codec.decodeQueueSize > 2
  }

  output(frame) {
    this.checkResPendingWrit()
    this.readableController.enqueue(frame)
  }

  codecOnWrite(chunk) {
    if (!chunk.metadata) console.log('debug metadata', chunk)
    if (
      !this.configured &&
      chunk.metadata &&
      chunk.metadata.decoderConfig &&
      chunk.metadata.decoderConfig.codec
    ) {
      console.log('codecOnWrite', chunk)
      this.codec.configure({
        codec: chunk.metadata.decoderConfig.codec,
        optimizeForLatency: true
      })
      this.configured = true
    }
  }

  async codecProcess(chunk) {
    this.codec.decode(chunk.frame)
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

  resetOutput() {
    if (this.multipleout) {
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
    } else {
      this.readable = new ReadableStream(
        {
          start: this.startReadable,
          pull: this.pullReadable
        },
        { highWaterMark: 2 }
      )
    }
  }

  async write(chunk) {
    // console.log('AVTransform write chunk', this.constructor.name, chunk)
    const finalchunk = await this.transform(chunk)

    let controller
    if (this.multipleout) controller = this.readableController[this.outputmain]
    else controller = this.readableController

    if ((controller && controller.desiredSize <= 0) || !controller) {
      // console.log('block output ')
      const readprom = new Promise(this.newPendingWrit)
      await readprom
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
  async transform(frame) {
    const resframe = {}

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
  }

  async transform(chunk) {
    // ok chunk is encrypted data
    try {
      const keystore = AVKeyStore.getKeyStore()

      if (chunk.keyindex !== this.keyindex) {
        // console.log('AVDecrypt getKey', chunk.keyindex, this.keyindex)
        this.key = await keystore.getKey(chunk.keyindex)
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
        frame: new EncodedVideoChunk({
          type: chunk.framedata.key ? 'key' : 'delta',
          timestamp: chunk.framedata.timestamp.toString(),
          duration: chunk.framedata.duration,
          data: await decdata
        })
      }
      return decryptedchunk
    } catch (error) {
      console.log('AVDecrypt error', error)
    }
  }

  setKey(key) {
    this.newkey = key
  }
}

class BsonFramer extends AVTransformStream {
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
    if (wlen === 0 || this.chunkqueue.length === 0) return // already done or no more chunks
    if (wlen < 0) throw new Error('corrupt stream')

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
  }
}

class BsonDeFramer extends BasicDeframer {
  constructor(args) {
    super(args)

    this.chunkqueue = []
    this.readpos = 0
    this.output = null
  }

  async transform(chunk) {
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
      this.readData('header')
      if (this.output.bsonlen) this.readData('bson')
      else throw new Error('only bson data expected')

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
    this.type = args.type

    this.chunkqueue = []
    this.readpos = 0
    this.output = null

    this.inspectframe = null
  }

  setFrameInspector(inspector) {
    this.inspectframe = inspector
  }

  async transform(chunk) {
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
      this.readData('header')
      if (this.output.bsonlen) this.readData('bson')
      else this.readData('payload')

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

class AVInputProcessor {
  // input means input from camera
  constructor(args) {
    this.webworkid = args.webworkid
    this.inputstream = args.inputstream

    this.encoder = {}
    this.encrypt = {}
    this.framer = {}
    this.outputctrldeframer = {}

    this.destAbort = {}
    this.streamDestPipe1 = {}
    this.streamDestPipe2 = {}
    this.streamDest = {}

    this.adOutgoing = null

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

  switchVideoCamera(args) {
    this.inputstream.cancel()
    this.inputstream = args.inputstream
    this.inputstream.pipeTo(this.multscaler.writable, {
      preventClose: true,
      preventAbort: true
    })
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

      if (curqual.framesPerSecond < this.lowerframerate) upgrade = false
      if (curqual.jitter / qualinfo.timePerFrame > 0.04) upgrade = false
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
                timePerFrame: framedelta / frames
              }
              this.handleQualityControl(qualinfo)
              lasttime = qcl.time
              senddata = 0
              frames = 0
              jitter = 0
              framedelta = 0
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
      for (const qual in this.qualities) {
        curstream = this.multscaler.readable[qual]
        // encoder
        curstream.pipeTo(this.encoder[qual].writable)
        curstream = this.encoder[qual].readable
        curstream.pipeTo(this.encrypt[qual].writable)
        curstream = this.encrypt[qual].readable
        curstream.pipeTo(this.framer[qual].writable)
        curstream = this.framer[qual].readable
        // quality control
        this.qualityControlLoop(qual)
      }

      const avoffersend = () => {
        AVWorker.ncPipe.postMessage({
          command: 'avoffer',
          data: { type: this.datatype }
        })
      }
      avoffersend()

      if (this.adOutgoing) clearInterval(this.adOutgoing)
      this.adOutgoing = setInterval(avoffersend, 25 * 1000)
    } catch (error) {
      console.log(
        'type',
        this.datatype,
        ' build outgoing pipeline error',
        error
      )
    }
  }

  onDestStreamAborted(quality) {
    console.log('on dest stream aborted ', quality)
    if (this.streamDest[quality]) {
      this.streamDest[quality].readable
        .cancel()
        .catch((error) =>
          console.log('streamSrc cancel failed ', quality, error)
        )
      delete this.streamDest[quality]
    }
    this.reconnectDestStream(quality)
  }

  async reconnectDestStream(quality) {
    if (!this.destid) return
    console.log('reconnect dest stream ', quality)
    const avtransport = AVTransport.getInterface()
    while (!this.streamDest[quality]) {
      try {
        this.streamDest[quality] = await avtransport.getIncomingStream()
        // it pipeline already build reconnected
      } catch (error) {
        console.log(
          'type',
          this.datatype,
          ' getIncomingStream failed rDS, retry',
          error
        )
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    this.framer[quality].resetOutput() // gets a new empty stream
    // then queue the bson
    this.framer[quality].sendBson({
      command: 'configure',
      dir: 'incoming', // routers perspective
      id: this.destid,
      quality,
      type: this.datatype
    })
    this.framer[quality].resendConfigs() // resend necessary configs

    this.destAbort[quality] = new AbortController()
    this.streamDestPipe1[quality] = this.framer[quality].readable
      .pipeTo(this.streamDest[quality].writable, {
        preventAbort: true,
        preventCancel: true,
        signal: this.destAbort.signal
      })
      .catch(() => {
        this.onDestStreamAborted(quality)
      })

    this.streamDestPipe2[quality] = this.streamDest[quality].readable
      .pipeTo(this.outputctrldeframer[quality].writable, {
        preventAbort: true,
        preventCancel: true,
        signal: this.destAbort[quality].signal
      })
      .catch(() => {}) // this generates control messages
  }

  async setDestId(id) {
    // dest is our id
    this.destid = id

    for (const qual in this.qualities) {
      if (this.destAbort[qual]) {
        this.destAbort[qual].abort()
        delete this.destAbort[qual]
        // wait for pipes to abort, before reconnecting
        await Promise.all([
          this.streamDestPipe1[qual],
          this.streamDestPipe2[qual]
        ])
        // this.streamDest.writable.close()
      } else await this.reconnectDestStream(qual) // otherwise it is triggered by the previous stream
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

    this.initPipeline()
  }

  initPipeline() {
    super.initPipeline()
    this.multscaler = new AVOneFrameToManyScaler({
      outputlevel: this.qualities,
      outputlevelmain: this.qualities[0] // the blocking one
    })

    this.multscaler.setMaxOutputLevel(this.qualmax /* best quality is 1 */)

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

    this.initPipeline()
  }

  initPipeline() {
    super.initPipeline()
    this.multscaler = new AVOneToManyCopy({
      outputlevel: this.qualities,
      outputlevelmain: this.qualities[0] // the blocking one
    })

    this.multscaler.setMaxOutputLevel(this.qualmax /* best quality is 1 */)

    for (const qual in this.qualities) {
      const outputlevel = qual
      this.encoder[qual] = new AVAudioEncoder({ outputlevel })
    }
  }
}

class AVVideoOutputProcessor {
  // Output means output to screen
  constructor(args) {
    this.webworkid = args.webworkid

    this.writeframe = this.writeframe.bind(this)
    this.qualityInspect = this.qualityInspect.bind(this)

    this.previewwritable = new WritableStream({
      write: this.writeframe
    })

    this.videodecoder = new AVVideoDecoder()
    this.videodecrypt = new AVDecrypt()
    this.videodeframer = new AVDeFramer({ type: 'video' })
    this.videodeframer.setFrameInspector(this.qualityInspect)
    this.inputctrlframer = new BsonFramer()
    this.streamSrc = null

    this.qualityStatsInt = {
      lasttime: 0,
      senddata: 0,
      frames: 0,
      lastframetimeSender: 0n,
      lastframetimeReceiver: 0,
      jitter: 0,
      framedelta: 0
    }
  }

  close() {
    const codec = this.videodecoder
    if (codec) {
      codec.close()
      this.videodecoder = null
    }
  }

  finalize() {
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

  sendControlMessage(mess) {
    if (this.inputctrlframer && this.inputctrlframer.writable) {
      const writmes = this.inputctrlframer.writable.getWriter()
      writmes.write(mess)
      writmes.releaseLock()
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

  writeframe(frame, controller) {
    if (this.previewrender && this.previewrender.ctx) {
      const offscreen = this.previewrender.offscreen
      const ctx = this.previewrender.ctx
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

  setPreviewRender(render) {
    this.previewrender = render
  }

  buildIncomingPipeline() {
    try {
      // network boundary
      let curstream = this.videodeframer.readable
      curstream.pipeTo(this.videodecrypt.writable)
      curstream = this.videodecrypt.readable
      curstream.pipeTo(this.videodecoder.writable)
      curstream = this.videodecoder.readable

      if (this.previewwritable) {
        curstream.pipeTo(this.previewwritable)
      }
    } catch (error) {
      console.log('build incoming pipeline error', error)
    }
  }

  onSrcStreamAborted() {
    console.log('on source stream aborted')
    if (this.streamSrc) {
      this.streamSrc.readable
        .cancel()
        .catch((error) => console.log('streamSrc cancel failed ', error))
      delete this.streamSrc
    }
    this.reconnectSrcStream()
  }

  async reconnectSrcStream() {
    if (!this.srcid) return
    console.log('reconnect src stream')
    const avtransport = AVTransport.getInterface()
    this.streamSrc = null
    while (!this.streamSrc) {
      try {
        this.streamSrc = await avtransport.getIncomingStream()
        // it pipeline already build reconnected
      } catch (error) {
        console.log('getIncomingStream failed rSS, retry', error)
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    this.srcAbort = new AbortController()
    this.streamSrcPipe1 = this.streamSrc.readable
      .pipeTo(this.videodeframer.writable, {
        preventAbort: true,
        preventCancel: true,
        signal: this.srcAbort.signal
      })
      .catch((error) => {
        console.log('srcStreamAbort: ', error)
        this.onSrcStreamAborted()
      })

    this.streamSrcPipe2 = this.inputctrlframer.readable
      .pipeTo(this.streamSrc.writable, {
        preventAbort: true,
        preventCancel: true,
        signal: this.srcAbort.signal
      })
      .catch(() => {}) // for sending control messages
    const writmes = this.inputctrlframer.writable.getWriter()
    writmes.write({
      command: 'configure',
      dir: 'outgoing', // routers perspective
      id: this.srcid,
      type: 'video'
    })
    writmes.releaseLock()

    // to do set something
  }

  async setSrcId(id) {
    // src id, is the source we want
    this.srcid = id
    console.log('setSrcId', id)

    if (this.srcAbort) {
      this.srcAbort.abort()
      delete this.srcAbort
      // wait for pipes to abort, before reconnecting
      await Promise.all([this.streamSrcPipe1, this.streamSrcPipe2])
      // this.streamSrc.writable.close()
    } else await this.reconnectSrcStream() // otherwise it is triggered by the previous stream
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
      this.keysres[keyid](this.keys[keyid])
      delete this.keysres[keyid]
      delete this.keysrej[keyid]
    }
    // now we reject pending promises for other keyids
    for (const wkeyid in this.keysrej) {
      this.keysrej[wkeyid](new Error('other key arrived instead')) // should prevent blocking decrypter
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
  }

  handleNetworkControl(message) {
    // console.log('network control message', message.data)
    if (message.data.task === 'keychange') {
      const keyobj = message.data.keyobject
      AVKeyStore.getKeyStore().incomingKey(keyobj)
    }
  }

  onMessage(event) {
    console.log('AVWorker onMessage', event)
    const task = event.data.task
    if (!event.data.webworkid && task !== 'networkControl')
      throw new Error('no webworkid specified')
    console.log('got event with task', task)
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
      case 'setPreviewRender':
        {
          const objrender = this.objects[event.data.webworkidrender]
          if (!objrender) throw new Error('no webworkidrender object')

          this.objects[event.data.webworkid].setPreviewRender(objrender)
        }
        break
      case 'setSrcId':
        {
          const id = event.data.id
          if (!id) {
            console.log('setSrcId', event.data)
            throw new Error('srcid, no id passed')
          }
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
new AVTransport().startConnection()

const avworker = new AVWorker()
// eslint-disable-next-line no-restricted-globals
self.addEventListener('message', avworker.onMessage)
console.log('AVWorker started')
