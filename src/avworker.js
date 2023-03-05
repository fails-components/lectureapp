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
import { AVTransport } from './avtransport'
import {
  AVKeyStore,
  AVDecrypt,
  AVEncrypt,
  AVFramer,
  BsonFramer,
  AVDeFramer,
  BsonDeFramer,
  AVVideoDecoder,
  AVAudioDecoder,
  AVVideoEncoder,
  AVAudioEncoder,
  AVOneToManyCopy,
  AVOneFrameToManyScaler
} from './avcomponents'

class ReadableToWorkerInt {
  constructor(args) {
    this.readable = new ReadableStream(
      {
        start: async (controller) => {
          this._controller = controller
          this.queue = []
        },
        pull: async (controller) => {
          if (this._blocked) {
            this._blocked = false
            avworker.sendMessage({
              task: 'readableBlock',
              webworkid: this.webworkid,
              block: false
            })
          }
          if (this.queue.length === 0) {
            await new Promise((resolve, reject) => {
              this._dataWaitRes = resolve
              this._dataWaitRej = reject
            })
          }
          controller.enqueue(this.queue.shift())
        },
        cancel: async (reason) => {
          if (this._dataWaitRej) {
            const rej = this._dataWaitRej
            delete this._dataWaitRes
            delete this._dataWaitRej
            rej(reason)
          }

          avworker.sendMessage({
            task: 'readableCancel',
            webworkid: this.webworkid,
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
    this.queue.push(chunk)
    if (this._controller.desiredSize <= 0) {
      avworker.sendMessage({
        task: 'readableBlock',
        webworkid: this.webworkid,
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
}

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
        while (pumping && running()) {
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
    this.running = true
  }

  initPipeline() {
    for (const qual in this.qualities) {
      this.encrypt[qual] = new AVEncrypt({ keyStore: AVKeyStore.getKeyStore() })
      this.framer[qual] = new AVFramer({ type: this.datatype })
      this.outputctrldeframer[qual] = new BsonDeFramer()
    }
  }

  close() {
    this.running = false
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
      'wwid',
      this.webworkid,
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
            running: () => this.running
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
    this.running = true
  }

  close() {
    this.running = false
    this.sendControlMessage({
      task: 'close'
    })
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
      'wwid',
      this.webworkid,
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
            if (!this.running) return
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
              this.deframer.reset()
              await initialconnect
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
                  'type',
                  this.datatype,
                  'srcid',
                  this.srcid
                )
              }
              this.scmqueue.length = 0
              this.inputctrlframer.reset()
              this.sendControlMessage({
                command: 'configure',
                dir: 'outgoing', // routers perspective
                tickets,
                type: this.datatype
              })
            } catch (error) {
              console.log('problem reset output', error)
              throw new Error('Resetoutput failed')
            }
          },
          inputStream: () => this.inputctrlframer,
          outputStream: () => this.deframer,
          tag: 'incoming ' + this.datatype,
          running: () => this.running
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
          while (!tickets && this.srcid === id && this.srcid) {
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
      chunkMaker: (arg) => new EncodedAudioChunk(arg),
      keyStore: AVKeyStore.getKeyStore()
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
      chunkMaker: (arg) => new EncodedVideoChunk(arg),
      keyStore: AVKeyStore.getKeyStore()
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
    if (task !== 'getDb' && task !== 'ReadableToWorkerWrite') {
      console.log('AVWorker onMessage', event)
      console.log('got event with task', task)
    }
    switch (task) {
      case 'openVideoCamera':
        {
          let inputstream = event.data.readable
          if (inputstream.webworkid) {
            inputstream = this.objects[inputstream.webworkid].readable
          }
          const newobj = new AVVideoInputProcessor({
            webworkid: event.data.webworkid,
            inputstream
          })
          this.objects[event.data.webworkid] = newobj
        }
        break
      case 'openAudioMicrophone':
        {
          let inputstream = event.data.readable
          if (inputstream.webworkid) {
            inputstream = this.objects[inputstream.webworkid].readable
          }
          const newobj = new AVAudioInputProcessor({
            webworkid: event.data.webworkid,
            inputstream
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
      case 'ReadableToWorkerCreate':
        {
          const newobj = new ReadableToWorkerInt({
            webworkid: event.data.webworkid
          })
          this.objects[event.data.webworkid] = newobj
        }
        break
      case 'ReadableToWorkerWrite':
        {
          const object = this.objects[event.data.webworkid]
          object.streamWrite(event.data.chunk)
        }
        break
      case 'ReadableToWorkerClose':
        {
          const object = this.objects[event.data.webworkid]
          object.streamClose()
        }
        break
      case 'ReadableToWorkerAbort':
        {
          const object = this.objects[event.data.webworkid]
          object.streamAbort(event.data.reason)
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
