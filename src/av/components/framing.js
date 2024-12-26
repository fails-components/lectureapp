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
  deserialize as BSONdeserialize,
  serialize as BSONserialize
} from 'bson'
import { AVTransformStream } from './transformstream'

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
