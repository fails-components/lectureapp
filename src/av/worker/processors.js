import { KeyStore } from '../../misc/keystore'
import {
  AVAudioDecoder,
  AVAudioEncoder,
  AVDecrypt,
  AVDeFramer,
  AVEncrypt,
  AVFramer,
  AVFrameSceneChange,
  AVOneFrameToManyScaler,
  AVOneToManyCopy,
  AVVideoDecoder,
  AVVideoEncoder,
  BsonDeFramer,
  BsonFramer,
  createEncodedAudioChunk
} from '../components/avcomponents'
import { AVTransport } from './transport'
import { avworker, AVWorker, undefined } from './worker'

export const videoQualities = [
  {
    width: 160,
    bitrate: 150000,
    framerate: 25
  },
  {
    width: 320,
    bitrate: 250000,
    framerate: 25
  },
  {
    width: 640,
    bitrate: 500000,
    framerate: 25
  },
  {
    width: 848,
    bitrate: 1000000,
    framerate: 25
  },
  {
    width: 848,
    bitrate: 1750000,
    framerate: 25
  },
  {
    width: 1280,
    bitrate: 2000000,
    framerate: 25
  },
  {
    width: 1280,
    bitrate: 3600000,
    framerate: 25
  },
  {
    width: 1920,
    bitrate: 4800000,
    framerate: 25
  }
]
export const screenQualities = [
  {
    width: 1280,
    bitrate: 2000000,
    framerate: 15
  }
]
export const audioQualities = [
  { bitrate: 15000 },
  { bitrate: 64000 },
  { bitrate: 128000 }
]

export class AVProcessor {
  constructor(args) {
    this.webworkid = args.webworkid
    this.queryid = 0 // query id for tickets
    this.ticketProm = []
    this.ticketRes = []
    this.ticketRej = []
    if (navigator.userAgentData) {
      // use old code for buggy Chromium versions
      if (
        navigator.userAgentData.brands.find(
          ({ brand, version }) => brand === 'Chromium' && version < 117
        )
      ) {
        console.log('CHROMIUM BUG install old bidiStremToLoop')
        this.bidiStreamToLoop = this.bidiStreamToLoopOld
      }
    }
  }

  // The next code should work, but it does not!
  async bidiStreamToLoop({
    bidiStream /* function for getting the input Stream */,
    reset,
    inputStream,
    outputStream,
    tag,
    running,
    setClosePipes
  }) {
    const ls = {
      lastupdate: new Date(),
      position: -1,
      run: 0
    }
    const statusPoll = setInterval(() => {
      console.log(tag, 'bSTL loop status', JSON.stringify(ls))
    }, 5000)
    let closeBidiStreams
    let inAbort
    let outAbort

    setClosePipes(() => {
      if (inAbort && outAbort) {
        closeBidiStreams = true
        inAbort.abort()
        outAbort.abort()
      }
    })
    while (running()) {
      let iowritable
      let ioreadable
      ls.pos = 1
      ls.run++

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
        iowritable = outputStream().writable
        ioreadable = inputStream().readable
        ls.pos = 4
        // next two lines part of Chroimumbug work around
        inAbort = new AbortController()
        outAbort = new AbortController()
        closeBidiStreams = false

        const inProm = bStream.readable.pipeTo(iowritable, {
          preventClose: true,
          preventAbort: true,
          signal: inAbort.signal
        })
        const outProm = ioreadable.pipeTo(bStream.writable, {
          preventCancel: true,
          signal: outAbort.signal
        })

        let outaborted
        outProm
          .finally(() => {
            console.log('bwriter PipeTo finished')
            outaborted = true
          })
          .catch(() => {})
        let inaborted
        inProm
          .finally(() => {
            console.log('breader PipeTo finished')
            inaborted = true
          })
          .catch(() => {})
        ls.pos = 5
        // workaround for chromium bug
        try {
          await Promise.race([inProm, outProm])
        } catch (error) {
          console.log('bidi loop race:', error)
        }
        ls.pos = 6
        if (inaborted && !outaborted) {
          console.log('outAbort')
          outAbort.abort()
        } else if (!inaborted && outaborted) {
          console.log('inAbort')
          inAbort.abort()
        } else {
          console.log('NO ABORT!')
        }
        ls.pos = 7
        try {
          await Promise.all([inProm, outProm])
        } catch (error) {
          console.log('bidi loop all:', error)
        }
        ls.pos = 8
        if (closeBidiStreams) {
          console.log('CloseBidiStreams')
          // this means complete shutdown!
          await Promise.all([
            // bStream.writable.close(), // not necessary the AbortControllers takes care!
            bStream.readable.cancel(),
            ioreadable.cancel(),
            iowritable.close()
          ])
        }
        ls.pos = 9
      } catch (error) {
        console.log(tag, 'error bidi loop', error)
      }
      inAbort = outAbort = undefined
    }
    clearInterval(statusPoll)
  }

  // old code to be removed
  async bidiStreamToLoopOld({
    bidiStream /* function for getting the input Stream */,
    reset,
    inputStream,
    outputStream,
    tag,
    running,
    setClosePipes
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
      run: 0,
      lrun: 0
    }
    const statusPoll = setInterval(() => {
      console.log(tag, 'bSTL loop status', JSON.stringify(ls))
    }, 5000)
    setClosePipes(() => {}) // dummy
    while (running()) {
      let iowriter
      let ioreader
      ls.pos = 1
      ls.lrun++

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

        const failRejects = new Set()

        const bread = async () => {
          let myreject
          const myprom = new Promise((resolve, reject) => {
            myreject = reject
            failRejects.add(reject)
          })
          try {
            ls.rpos = 1
            const res = await Promise.race([breader.read(), myprom])
            ls.rpos = 2
            if (res.value) {
              ls.read1 += res.value.byteLength
              ls.rpos = 3
              await Promise.race([iowriter.write(res.value), myprom])
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
            failRejects.delete(myreject)
            return 'brE'
          }
          // ls.rpos = 7
          failRejects.delete(myreject)
          return 'br'
        }
        const bwrit = async () => {
          let myreject
          const myprom = new Promise((resolve, reject) => {
            myreject = reject
            failRejects.add(reject)
          })
          try {
            ls.wpos = 1
            const res = await Promise.race([ioreader.read(), myprom])
            ls.wpos = 2
            if (res.value) {
              ls.read2 += res.value.byteLength
              ls.wpos = 3
              await Promise.race([bwriter.write(res.value), myprom])
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
            failRejects.delete(myreject)
            return 'bwE'
          }
          // ls.wpos = 7
          failRejects.delete(myreject)
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
              failRejects.forEach((rej) => rej())
              failRejects.clear()
              break
            case 'bwE':
              // We errored on one stream
              pumping = false
              failRejects.forEach((rej) => rej())
              failRejects.clear()
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

  async getTickets({ id, dir }) {
    if (!id) throw new Error('id is not defined')
    if (!AVWorker.isNetworkOn()) {
      await AVWorker.waitForNetwork()
    }
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
export class AVInputProcessor extends AVProcessor {
  // input means input from camera
  constructor(args) {
    super(args)
    if (!args.track) {
      this.inputstream = args.inputstream
    } else {
      this.newTrack(args)
    }

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
    for (const qual of this.qualities) {
      this.encrypt[qual] = new AVEncrypt({ keyStore: KeyStore.getKeyStore() })
      this.framer[qual] = new AVFramer({ type: this.datatype })
      this.outputctrldeframer[qual] = new BsonDeFramer()
    }
  }

  close() {
    if (this.adOutgoing) clearInterval(this.adOutgoing)
    this.running = false
    if (this.closePipes) this.closePipes()
    for (const qual of this.qualities) {
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

  newTrack(args) {
    if (this.track) {
      this.track.stop()
      delete this.track
    }
    this.track = args.track
    // eslint-disable-next-line no-undef
    this.trackprocessor = new MediaStreamTrackProcessor({
      track: args.track,
      maxBufferSize: 10
    })
    this.inputstream = this.trackprocessor.readable
    this.off = args.off
    if (args.off) {
      this.track.enabled = false
    }
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
      this.framer[this.qualities[oldqualmax]].sendBson({
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
    if (!this.skipedFrames) this.skipedFrames = {}
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
    const notscreen = this.datatype !== 'screen'
    for (const quality in this.qcs) {
      const curqual = this.qcs[quality]
      if (curqual.framesPerSecond < this.minimalframerate && notscreen)
        problem = true
      if (curqual.jitter / qualinfo.timePerFrame > 0.8 && notscreen)
        problem = true
      if (curqual.skipedFrames > this.maxSkippedFrames) problem = true

      if (curqual.framesPerSecond < this.lowerframerate && notscreen)
        upgrade = false
      if (curqual.jitter / qualinfo.timePerFrame > 0.04 && notscreen)
        upgrade = false
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
          for (const i in value) {
            const qcl = value[i]
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
      for (const qualid in this.qualities) {
        const qual = this.qualities[qualid]
        this.streamDest[qual] = new Promise((resolve) => {
          this.streamDestRes[qual] = resolve
        })
        this.initialconnect[qual] = true

        curstream = this.multscaler.readable[qual]
        // encoder
        const pipeTos = []
        pipeTos.push(curstream.pipeTo(this.encoder[qual].writable))
        curstream = this.encoder[qual].readable
        pipeTos.push(curstream.pipeTo(this.encrypt[qual].writable))
        curstream = this.encrypt[qual].readable
        pipeTos.push(curstream.pipeTo(this.framer[qual].writable))
        Promise.all(pipeTos).catch((error) => {
          console.log('Problem in pipetos buildOutgoingPipeline', error)
        })
        curstream = this.framer[qual].readable
        const pipesMaker = (quality, qualid) => {
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
                  quality: qualid,
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
            running: () => this.running,
            setClosePipes: (closefunc) => {
              this.closePipes = closefunc
            }
          }).catch((error) => {
            console.log('AVIP ', qual, 'Bidi prob:', error)
          })
        }
        pipesMaker(qual, qualid)
        // quality control
        this.qualityControlLoop(qual)
      }

      const avoffersend = async () => {
        if (!AVWorker.isNetworkOn()) {
          await AVWorker.waitForNetwork()
        }
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
      for (const qual of this.qualities) {
        console.log('setDestId reconnect', qual, id)
        reconprom.push(this.reconnect(qual))
      }
      await Promise.all(reconprom)
    } catch (error) {
      console.log('reconnect with DestId failed', id, ':', error)
    }
  }
}
export class AVVideoInputProcessor extends AVInputProcessor {
  constructor(args) {
    super(args)

    this.qualmax = 0
    if (!args.screenshare) {
      this.qualities = [1, 2]
      this.datatype = 'video'
      this.lowerframerate = 14
      this.minimalframerate = 10
      this.maxSkippedFrames = 5 // video should tolerate this
    } else {
      this.qualities = [0] // here are skipped frames the right way
      this.datatype = 'screen'
      this.lowerframerate = 14
      this.minimalframerate = 5
      this.maxSkippedFrames = 10 // screen should tolerate this
      this.sceneDetect = true
    }

    this.initPipeline()
  }

  changeOff(off) {
    if (this.track) {
      // we have the track
      this.track.enabled = !off
    }
    this.multscaler.changeOff(off)
  }

  changeBackgroundRemover({ off, color, type }) {
    this.multscaler.changeBackgroundRemover({ off, color, type })
  }

  switchVideoInput(args) {
    // may be move to base class and rename to switchInput?
    this.inputstream
      .cancel()
      .catch((error) => console.log('Error cancel videoinpustream:', error))
    if (args.track) {
      const { track, off } = args
      // we have the track
      this.newTrack({ track, off })
    } else {
      this.inputstream = args.inputstream
    }
    this.inputstream.pipeTo(this.multscaler.writable, {
      preventClose: true,
      preventAbort: true
    })
  }

  initPipeline() {
    super.initPipeline()
    const outputwidth = {}
    const qualities =
      this.datatype === 'screen' ? screenQualities : videoQualities
    this.qualities.forEach((el) => (outputwidth[el] = qualities[el].width))
    const outputlevel = [...this.qualities]
    let outputlevelmain = 0
    if (this.sceneDetect) {
      outputlevel.unshift('scene') // scene detector

      // eslint-disable-next-line dot-notation
      outputwidth['scene'] = 160
      outputlevelmain++
    }
    this.multscaler = new AVOneFrameToManyScaler({
      outputlevel,
      outputlevelmain, // the blocking one
      outputwidth
    })

    this.multscaler.setMaxOutputLevel(this.qualmax /* best quality is 1 */)
    this.multscaler.setSkipframeCallback(this.skipframe)

    for (const qual of this.qualities) {
      this.encoder[qual] = new AVVideoEncoder({
        bitrate: qualities[qual].bitrate,
        framerate: qualities[qual].framerate
      })
    }
    if (this.sceneDetect) {
      this.sceneDetector = new AVFrameSceneChange()
    }
  }

  async offerStatus() {
    if (this.sceneDetector) {
      const now = Date.now()
      if (
        now - this.sceneDetector.minorReportTime < 4000 &&
        now - this.lastoffersend > 5000
      ) {
        return { miScChg: true }
      } else {
        return undefined
      }
    }
    return {}
  }

  buildOutgoingPipeline() {
    super.buildOutgoingPipeline()
    if (this.sceneDetect) {
      // eslint-disable-next-line dot-notation
      const curstream = this.multscaler.readable['scene']
      // encoder
      const pipeTos = []
      pipeTos.push(curstream.pipeTo(this.sceneDetector.writable))
      Promise.all(pipeTos).catch((error) => {
        console.log('Problem in pipetos buildOutgoingPipeline AVIP', error)
      })
    }
  }
}

export class AVAudioInputProcessor extends AVInputProcessor {
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
    if (args.track) {
      const { track, off } = args
      // we have the track
      this.newTrack({ track, off })
    } else {
      this.inputstream = args.inputstream
    }
    this.inputstream.pipeTo(this.multscaler.writable, {
      preventClose: true,
      preventAbort: true
    })
  }

  changeMute(muted) {
    if (this.track) {
      // we have the track
      this.track.enabled = !muted
    }
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

    for (const qual of this.qualities) {
      this.encoder[qual] = new AVAudioEncoder({
        bitrate: audioQualities[qual].bitrate
      })
    }
  }

  async offerStatus() {
    const prom = new Promise((resolve) => {
      this.dbPromsRes.push(resolve)
    })
    avworker.sendMessage({ task: 'getDbMax', webworkid: this.webworkid })

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
export class AVOutputProcessor extends AVProcessor {
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
    if (this.closePipes) this.closePipes()
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
    const notscreen = this.datatype !== 'screen'
    const curqual = this.qcs
    if (curqual.framesPerSecond < 10 && notscreen) problem = true
    if (curqual.jitter / qualinfo.timePerFrame > 0.8 && notscreen)
      problem = true

    if (curqual.framesPerSecond < 14 && notscreen) upgrade = false
    if (curqual.jitter / qualinfo.timePerFrame > 0.04 && notscreen)
      upgrade = false

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

      const pipeTos = []

      let curstream = this.deframer.readable
      pipeTos.push(curstream.pipeTo(this.decrypt.writable))
      curstream = this.decrypt.readable
      pipeTos.push(curstream.pipeTo(this.decoder.writable))
      curstream = this.decoder.readable

      if (this.outputwritable) {
        pipeTos.push(curstream.pipeTo(this.outputwritable))
      }
      Promise.all(pipeTos).catch((error) => {
        console.log('Problem in pipetos buildIncomingPipeline', error)
      })
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
          running: () => this.running,
          setClosePipes: (closefunc) => {
            this.closePipes = closefunc
          }
        })
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

  async setSrcId(id) {
    // dest is our id
    const changed = this.srcid !== id
    this.srcid = id
    console.log('srcId', id, this.datatype, changed)
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

export class AVAudioOutputProcessor extends AVOutputProcessor {
  // Output means output to screen
  constructor(args) {
    super(args)
    this.datatype = 'audio'

    this.writeframe = this.writeframe.bind(this)

    if (args.writable) {
      this.outputwritable = args.writable
    } else if (args.port) {
      this.audioport = args.port
      this.audioport.postMessage({ message: 'Test message constrcutor' })
      this.outputwritable = new WritableStream({
        write: this.writeframe
      })
    } else {
      throw new Error('Neither port or writable specified')
    }

    this.decrypt = new AVDecrypt({
      chunkMaker: (arg) => createEncodedAudioChunk(arg),
      keyStore: KeyStore.getKeyStore()
    })

    this.decoder = new AVAudioDecoder()
  }

  writeframe(frame, controller) {
    if (this.audioport) {
      // an AudioData Object seems to be not transferable to an AudioWorklet
      const {
        duration,
        // format,
        numberOfChannels,
        numberOfFrames,
        sampleRate,
        timestamp
      } = frame
      const data = Array.from(
        { length: numberOfChannels },
        () => new Float32Array(numberOfFrames)
      )
      data.forEach((value, index) =>
        frame.copyTo(value, { planeIndex: index, format: 'f32-planar' })
      )
      this.audioport.postMessage(
        {
          frame: {
            data,
            duration,
            format: 'f32-planar',
            numberOfChannels,
            numberOfFrames,
            sampleRate,
            timestamp
          }
        },
        data.map((x) => x.buffer)
      )
    }
    frame.close()
  }
}

export class AVVideoOutputProcessor extends AVOutputProcessor {
  // Output means output to screen
  constructor(args) {
    super(args)
    if (!args.screenshare) {
      this.datatype = 'video'
    } else {
      this.datatype = 'screen'
    }

    this.writeframe = this.writeframe.bind(this)

    this.outputwritable = new WritableStream({
      write: this.writeframe
    })

    this.decrypt = new AVDecrypt({
      chunkMaker: (arg) => {
        const init = { ...arg, transfer: [] }
        const data = init.data
        if (data) {
          if (data instanceof ArrayBuffer) {
            init.transfer.push(data)
          } else if (ArrayBuffer.isView(data)) {
            init.transfer.push(data.buffer)
          }
        }
        // eslint-disable-next-line no-undef
        return new EncodedVideoChunk(init)
      },
      keyStore: KeyStore.getKeyStore()
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
