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

import { AVTransformStream } from './transformstream'

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
