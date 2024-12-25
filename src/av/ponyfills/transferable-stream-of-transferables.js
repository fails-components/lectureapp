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

class ReadableFromExternal {
  constructor(args) {
    this.port = args.port
    this._onMessage = this._onMessage.bind(this)
    this.port.onmessage = this._onMessage
    this.readable = new ReadableStream(
      {
        start: async (controller) => {
          this._controller = controller
          this.queue = []
        },
        pull: async (controller) => {
          if (this._blocked) {
            this._blocked = false
            this.port.postMessage({
              task: 'readableBlock',
              block: false
            })
          }
          if (this.queue.length === 0) {
            await new Promise((resolve, reject) => {
              this._dataWaitRes = resolve
              this._dataWaitRej = reject
            })
          }
          const outpacket = this.queue.shift()
          controller.enqueue(outpacket)
        },
        cancel: async (reason) => {
          if (this._dataWaitRej) {
            const rej = this._dataWaitRej
            delete this._dataWaitRes
            delete this._dataWaitRej
            rej(reason)
          }

          this.port.postMessage({
            task: 'readableCancel',
            reason
          })
          // TODO send cancel upstream
        }
      },
      { highWaterMark: 2 }
    )
    this.webworkid = args.webworkid
  }

  streamWrite(chunk) {
    if (this._dataWaitRes) {
      const res = this._dataWaitRes
      delete this._dataWaitRes
      delete this._dataWaitRej
      res()
    }
    if (chunk.numberOfChannels) {
      if (chunk._data) {
        const {
          _data: data,
          format,
          sampleRate,
          numberOfFrames,
          numberOfChannels,
          timestamp
        } = chunk
        // eslint-disable-next-line no-undef
        chunk = new AudioData({
          data,
          format,
          sampleRate,
          numberOfFrames,
          numberOfChannels,
          timestamp
        })
      }
    } else {
      if (chunk._data) {
        const {
          _data: data,
          format,
          codedWidth,
          codedHeight,
          timestamp,
          duration,
          layout,
          visibleRect,
          displayWidth,
          displayHeight,
          colorSpace
        } = chunk
        // eslint-disable-next-line no-undef
        chunk = new VideoFrame(data, {
          format,
          codedWidth,
          codedHeight,
          timestamp,
          duration,
          layout,
          visibleRect,
          displayWidth,
          displayHeight,
          colorSpace
        })
      }
    }
    this.queue.push(chunk)
    if (this._controller.desiredSize <= 0) {
      this.port.postMessage({
        task: 'readableBlock',
        block: true
      })
      this._blocked = true
    }
    // TODO signal if stream is full?, or will the limited resources help
  }

  streamClose() {
    this._controller.close()
  }

  streamAbort(reason) {
    this._controller.error(new Error(reason))
  }

  _onMessage(event) {
    // console.log('ReadableFromExternal event', event)
    const task = event.data.task
    switch (task) {
      case 'ReadableToExternalWrite':
        this.streamWrite(event.data.chunk)
        break
      case 'ReadableToExternalClose':
        this.streamClose()

        break
      case 'ReadableToExternalAbort':
        this.streamAbort(event.data.reason)
        break
      default:
        throw new Error('Unsupported task: ' + task)
    }
  }
}

// for non-chromium platforms and non safari platforms
class ReadableToExternal {
  constructor(args) {
    this.port = args.port
    this._onMessage = this._onMessage.bind(this)
    this.port.onmessage = this._onMessage
    this.writable = new WritableStream({
      start: async (controller) => {
        this._controller = controller
        this.finalization = new FinalizationRegistry(() => {
          this.close()
        })
        this.finalization.register(this)
      },
      write: async (chunk, controller) => {
        // TODO block writing
        let transfer
        if (chunk._data?.buffer)
          transfer = [chunk._data.buffer] // detect the Polyfill
        else transfer = [chunk]
        this.port.postMessage(
          {
            task: 'ReadableToExternalWrite',
            chunk
          },
          transfer
        )
        if (this._blocked) {
          await new Promise((resolve) => {
            this._blockedres = resolve
          })
        }
      },
      close: async (controller) => {
        this.port.postMessage({
          task: 'ReadableToExternalClose'
        })
      },
      abort: async (reason) => {
        this.port.postMessage({
          task: 'ReadableToExternalAbort',
          reason
        })
      }
    })
  }

  close() {
    this.port.postMessage({
      task: 'close',
      webworkid: this.webworkid
    })
    if (this._blockedres) {
      this._blockedres()
      delete this._blockedres
    }
  }

  extCancel({ reason }) {
    this._controller.error(reason)
    if (this._blockedres) {
      this._blockedres()
      delete this._blockedres
    }
  }

  extBlocked(blocked) {
    if (blocked) {
      this._blocked = true
    } else {
      this._blocked = false
      if (this._blockedres) {
        this._blockedres()
        delete this._blockedres
      }
    }
  }

  _onMessage(event) {
    // console.log('ReadableToExternal event', event)
    const task = event.data.task
    switch (task) {
      case 'readableCancel':
        this.extCancel({ reason: event.data.reason })
        break
      case 'readableBlock':
        this.extBlocked({ reason: event.data.block })
        break
      default:
        throw new Error('Unsupported task: ' + task)
    }
  }
}

export function transferReadableStream(stream, apply) {
  if (!apply) return stream
  if (!stream._transferMessageChannelSend) {
    stream._transferMessageChannelSend = new MessageChannel()
    const port = stream._transferMessageChannelSend.port1
    if (stream.getReader) {
      // readable stream
      const readableToE = new ReadableToExternal({ port })
      stream.pipeTo(readableToE.writable).catch((error) => {
        throw error
      })
    } else {
      console.log('Stream error:', stream)
      throw new Error('Not a readable stream')
    }
  }
  return stream._transferMessageChannelSend.port2
}

export function transferWriteableStream(stream, apply) {
  if (!apply) return stream
  if (!stream._transferMessageChannelSend) {
    stream._transferMessageChannelSend = new MessageChannel()
    const port = stream._transferMessageChannelSend.port1
    if (stream.getWriter) {
      // writable stream
      const readableFromE = new ReadableFromExternal({ port })
      readableFromE.readable.pipeTo(stream).catch((error) => {
        throw error
      })
    } else {
      console.log('Stream error:', stream)
      throw new Error('Not a writable stream')
    }
  }
  return stream._transferMessageChannelSend.port2
}

export function receiveReadableStream(port) {
  if (port.getReader) return port
  return new ReadableFromExternal({ port }).readable
}

export function receiveWritableStream(port) {
  if (port.getWriter) return port
  return new ReadableToExternal({ port }).writable
}
