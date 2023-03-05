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

export class AVVideoEncoder extends AVEncoder {
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

export class AVAudioEncoder extends AVEncoder {
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

export class AVDecoder extends AVCodec {
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

export class AVAudioDecoder extends AVDecoder {
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

export class AVOneToMany extends AVTransformStream {
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

export class AVOneFrameToManyScaler extends AVOneToMany {
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

export class AVKeyStore {
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
    // eslint-disable-next-line no-restricted-globals
    const iv = self.crypto.getRandomValues(new Uint8Array(12))

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
