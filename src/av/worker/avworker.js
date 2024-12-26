import { KeyStore } from '../../misc/keystore'
import { receiveReadableStream } from '../ponyfills/transferable-stream-of-transferables'
import {
  AVVideoInputProcessor,
  AVAudioInputProcessor,
  AVVideoOutputProcessor,
  AVAudioOutputProcessor
} from './processors'
import { AVTransport } from './transport'
import { AVVideoRenderInt } from './videorenderint'

export class AVWorker {
  static ncPipe = null
  static networkRes = null
  static worker = null
  static networkProm = new Promise((resolve, reject) => {
    AVWorker.networkRes = resolve
  })

  constructor(args) {
    this.onMessage = this.onMessage.bind(this)
    this.objects = {}

    this.handleNetworkControl = this.handleNetworkControl.bind(this)
    this.transportInfoProm = Promise.resolve()
    AVWorker.worker = this
  }

  static isNetworkOn() {
    return !!AVWorker.ncPipe
  }

  static async waitForNetwork() {
    await AVWorker.networkProm
  }

  static getWorker() {
    return AVWorker.worker
  }

  handleNetworkControl(message) {
    // console.log('network control message', message.data)
    if (message.data.task === 'keychange') {
      const keyobj = message.data.keyobject
      KeyStore.getKeyStore().incomingKey(keyobj)
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

  avtransportStatus(state) {
    this.sendMessage({
      task: 'avtransportstate',
      state
    })
  }

  probeMSTP() {
    if (!('MediaStreamTrackProcessor' in globalThis)) {
      console.log('MediaStreamTrackProcessor in AVWorker detected!')
      this.sendMessage({
        task: 'activatemstinworker'
      })
    }
  }

  sendMessage(message) {
    globalThis.postMessage(message)
  }

  async getTransportInfo() {
    if (!AVWorker.isNetworkOn()) {
      await AVWorker.waitForNetwork()
    }
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
    if (
      !event.data.webworkid &&
      task !== 'networkControl' &&
      task !== 'probeMSTP'
    )
      throw new Error('no webworkid specified')
    if (
      task !== 'getDb' &&
      task !== 'getDbMax' &&
      task !== 'ReadableToWorkerWrite'
    ) {
      console.log('AVWorker onMessage', event)
      console.log('got event with task', task)
    }
    switch (task) {
      case 'openVideoInput':
        {
          const newobj = new AVVideoInputProcessor({
            webworkid: event.data.webworkid,
            inputstream:
              event.data.readable && receiveReadableStream(event.data.readable),
            track: event.data.track,
            screenshare: event.data.screenshare,
            off: event.data.off
          })
          this.objects[event.data.webworkid] = newobj
        }
        break
      case 'openAudioMicrophone':
        {
          const newobj = new AVAudioInputProcessor({
            webworkid: event.data.webworkid,
            inputstream:
              event.data.readable && receiveReadableStream(event.data.readable),
            track: event.data.track,
            off: event.data.mute
          })
          this.objects[event.data.webworkid] = newobj
        }
        break
      case 'openVideoDisplay':
        {
          const newobj = new AVVideoOutputProcessor({
            webworkid: event.data.webworkid,
            screenshare: event.data.screenshare
          })
          this.objects[event.data.webworkid] = newobj
        }
        break
      case 'openAudioSpeaker':
        {
          const newobj = new AVAudioOutputProcessor({
            webworkid: event.data.webworkid,
            writable: event.data.writable,
            port: event.data.port
          })
          this.objects[event.data.webworkid] = newobj
        }
        break
      case 'switchVideoInput':
        {
          const object = this.objects[event.data.webworkid]
          object.switchVideoInput({
            inputstream:
              event.data.readable && receiveReadableStream(event.data.readable),
            track: event.data.track,
            off: event.data.off
          })
        }
        break
      case 'switchAudioMicrophone':
        {
          const object = this.objects[event.data.webworkid]
          object.switchAudioMicrophone({
            inputstream:
              event.data.readable && receiveReadableStream(event.data.readable),
            track: event.data.track,
            off: event.data.mute
          })
        }
        break
      case 'muteChangeMic':
        {
          const object = this.objects[event.data.webworkid]
          object.changeMute(event.data.muted)
        }
        break
      case 'offChange':
        {
          const object = this.objects[event.data.webworkid]
          object.changeOff(event.data.off)
        }
        break
      case 'changeBackgroundRemover':
        {
          const object = this.objects[event.data.webworkid]
          const { off, color, type } = event.data
          object.changeBackgroundRemover({ off, color, type })
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
      case 'getDbMax':
        if (this.objects[event.data.webworkid]) {
          this.objects[event.data.webworkid].reportDb(event.data.db)
        }
        break
      case 'networkControl':
        if (event.data.pipe) {
          AVWorker.ncPipe = event.data.pipe
          AVWorker.ncPipe.onmessage = this.handleNetworkControl
          if (AVWorker.networkRes) AVWorker.networkRes()
          AVWorker.networkRes = undefined
        }
        break
      case 'probeMSTP':
        this.probeMSTP()
        break
      default:
        console.log('Unhandled message task (AVWorker):', task)
    }
  }
}
