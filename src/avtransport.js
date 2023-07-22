/*
    Fails Components (Fancy Automated Internet Lecture System - Components)
    Copyright (C)  2015-2017 (original FAILS), 
                   2021- (FAILS Components)  Marten Richter <marten.richter@freenet.de>

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
import { WebTransport as WebTransportWS } from '@fails-components/webtransport-ponyfill-websocket'
import { serialize as BSONserialize } from 'bson'

export class AVTransport {
  static interf = null

  constructor(args) {
    if (AVTransport.interf !== null)
      throw new Error('AVTransport already created')
    AVTransport.interf = this

    this.hostinfocb = args.cb
    this.statuscb = args.status

    this.connected = new Promise((resolve, reject) => {
      this.connectedres = resolve
      this.connectedrej = reject
    })
  }

  static getInterface() {
    return AVTransport.interf
  }

  forceReconnect() {
    try {
      if (this.transport)
        this.transport.close({
          closeCode: 0,
          reason: 'WS control disconnected'
        })
    } catch (error) {
      console.log('forceReconnect error', error)
    }
  }

  async startConnection() {
    try {
      console.log('startconnection')
      let forcewebsocket = false // for debugging set to true
      const preventwebsocket = false // for debugging set to true
      if (typeof globalThis.WebTransport === 'undefined') {
        console.log('Browser has no WebTransport support fall back to ponyfill')
        forcewebsocket = true
      }
      // WebTransportWS
      while (true) {
        let type
        if (this.statuscb) this.statuscb({ status: 'connecting', type })
        const hinfo = await this.hostinfocb()
        if (!hinfo) {
          await new Promise((resolve) => {
            setTimeout(resolve, 5000)
          })
          continue
        }
        const url = hinfo.url // 'https://' + this.hostname + ':' + this.port + '/avfails'
        const wsurl = hinfo.wsurl
        // eslint-disable-next-line no-useless-concat
        // 'ws://' + /* this.hostname */ 'localhost' + ':' + this.port + '/avfails'
        const spki = hinfo.spki
        // '42:93:91:B2:8C:A6:8E:F1:E9:89:41:04:D6:9C:57:CE:B9:0A:0B:5E:11:4C:04:24:9A:5E:15:3E:D8:59:1B:8D'
        const spkiab = new Uint8Array(
          spki.split(':').map((el) => parseInt(el, 16))
        )
        const serverCertificateHashes = [
          {
            algorithm: 'sha-256',
            value: spkiab
          }
        ]

        let webtransport = false
        if (!forcewebsocket) {
          try {
            type = 'webtransport'
            if (this.statuscb) this.statuscb({ status: 'connecting', type })
            // eslint-disable-next-line no-undef
            this.transport = new WebTransport(url, { serverCertificateHashes })
            this.transport.closed
              .then(() => {
                console.log(
                  'The HTTP/3 connection to ',
                  url,
                  'closed gracefully.'
                )
              })
              .catch((error) => {
                console.error(
                  'The HTTP/3 connection to',
                  url,
                  'closed due to ',
                  error,
                  '.'
                )
              })
            await this.transport.ready
            webtransport = true
            console.log('webtransport is ready' /*, this.transport */)
          } catch (error) {
            console.log('webtransport connection or closed failed', error)
          }
        }
        if (!webtransport) {
          if (!forcewebsocket)
            console.log('Fallback to websocket due to webtransport failure')
          // this.connectedrej('no websocket' + wsurl) // fall back
          type = 'websocket'
          if (this.statuscb) this.statuscb({ status: 'connecting', type })
          try {
            if (preventwebsocket)
              throw new Error('WebSocket creation prevented by debug flag')
            this.transport = new WebTransportWS(wsurl)
            this.transport.closed
              .then(() => {
                console.log(
                  'The Websocket connection to ',
                  url,
                  'closed gracefully.'
                )
              })
              .catch((error) => {
                console.error(
                  'The Websocket connection to',
                  url,
                  'closed due to ',
                  error,
                  '.'
                )
              })
            await this.transport.ready
            webtransport = true
            console.log('webtransport over websocket is ready', this.transport)
          } catch (error) {
            console.log(
              'webtransport over websocket connection or closed failed',
              error
            )
            // also the fallback did not work
            this.connectedrej(error)
          }
        }

        if (webtransport) {
          if (this.statuscb) this.statuscb({ status: 'authenticating', type })
          // do authentification
          console.log('webtransport start auth')
          let authfailed = false
          try {
            const rs = this.transport.incomingBidirectionalStreams
            const rsreader = rs.getReader()
            try {
              const { value } = await rsreader.read()
              if (value) {
                const awrt = value.writable.getWriter()
                const payload = BSONserialize({ token: hinfo.token })
                await awrt.write(payload)
                awrt.close().catch((err) => {
                  console.log('webtransport auth writer close problem:', err)
                })
                value.readable.cancel(0).catch((err) => {
                  console.log('webtransport auth reader cancel problem:', err)
                })
              }
              rsreader.releaseLock()
              this.connectedres()
            } catch (error) {
              authfailed = true
              this.connectedrej()
              console.log('error passing auth token reader', error)
            }
          } catch (error) {
            authfailed = true
            this.connectedrej()
            console.log('error passing auth token', error)
          }
          if (!authfailed) {
            console.log('webtransport auth send')
            try {
              if (this.statuscb) this.statuscb({ status: 'connected', type })
              await this.transport.closed
              console.log('webtransport closed go to restart')
              if (this.statuscb) this.statuscb({ status: 'closed' })
            } catch (error) {
              console.log('Webtransport was closed with', error)
            }
          } else {
            if (this.statuscb) this.statuscb({ status: 'failed', type })
            console.log('webtransport auth failed')
          }
        } else if (this.statuscb) this.statuscb({ status: 'failed', type })
        // if we failed wait sometime, before we renew, we should wait in any case
        await new Promise((resolve) => setTimeout(resolve, 2000))
        console.log('webtransport renew connection')
        // get a new connection, and inform that streams need to be renewed

        this.connected = new Promise((resolve, reject) => {
          this.connectedres = resolve
          this.connectedrej = reject
        })
      }
    } catch (error) {
      console.log('other webtransport error', error)
    }
  }

  // new offering
  async getOutgoingStream() {
    try {
      await this.connected
      return await this.transport.createBidirectionalStream()
    } catch (error) {
      console.log('problem in getOutgoingStream', error)
      this.forceReconnect()
      throw new Error('getOutgoingStream failed', error)
    }
  }

  async getIncomingStream() {
    try {
      await this.connected
      return await this.transport.createBidirectionalStream()
    } catch (error) {
      console.log('problem in getIncomingStream', error)
      this.forceReconnect()
      throw new Error('getIncomingStream failed', error)
    }
  }
}
