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

export class AVTransport {
  static interf = null

  constructor(args) {
    if (AVTransport.interf !== null)
      throw new Error('AVTransport already created')
    AVTransport.interf = this

    this.hostname = (args && args.hostname) || '192.168.1.108'
    this.port = (args && args.port) || 8081
    this.connected = new Promise((resolve, reject) => {
      this.connectedres = resolve
      this.connectedrej = reject
    })
  }

  static getInterface() {
    return AVTransport.interf
  }

  async startConnection() {
    try {
      const url = 'https://' + this.hostname + ':' + this.port + '/avfails'
      const spki =
        '73:C5:65:58:1F:87:6F:FB:6A:35:84:B4:D9:6A:F6:AA:9D:67:83:13:12:11:22:CC:9F:4C:9F:AD:0B:83:44:BA'

      const spkiab = new Uint8Array(
        spki.split(':').map((el) => parseInt(el, 16))
      )

      const serverCertificateHashes = [
        {
          algorithm: 'sha-256',
          value: spkiab
        }
      ]
      console.log('startconnection', serverCertificateHashes)
      while (true) {
        let webtransport = false
        try {
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
          this.connectedres()
          console.log('webtransport is ready', this.transport)
        } catch (error) {
          console.log('webtransport connection or closed failed', error)
          // add here the fallback to websocket later
          this.connectedrej(error)
        }

        if (webtransport) {
          try {
            await this.transport.closed
          } catch (error) {
            console.log('Webtransport was closed with', error)
          }
        } else {
          // if we failed wait sometime, before we renew
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
        console.log('webtransport renew connection')
        // get a new connection, and inform that streams need to be renewed

        this.connected = new Promise((resolve, reject) => {
          this.connectedres = resolve
          this.connectedrej = reject
        })
      }

      // this.echoTestsConnection()
    } catch (error) {
      console.log('other webtransport error', error)
    }
  }

  // new offering
  async getOutgoingStream() {
    await this.connected
    return await this.transport.createBidirectionalStream()
  }

  async getIncomingStream() {
    await this.connected
    return await this.transport.createBidirectionalStream()
  }

  // runs standardized tests for testing the server, only for development and debugging
  async echoTestsConnection() {
    // some echo tests for testing the webtransport library, not for production
    const stream = await this.transport.createBidirectionalStream()
    const writer = stream.writable.getWriter()
    const data1 = new Uint8Array([65, 66, 67])
    const data2 = new Uint8Array([68, 69, 70])
    writer.write(data1)
    writer.write(data2)
    const reader = stream.readable.getReader()
    let i = 6
    while (true && i > 0) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      // value is a Uint8Array
      console.log('incoming bidi stream', value)
      i -= value.length
    }
    try {
      await writer.close()
      console.log('All data has been sent.')
    } catch (error) {
      console.error(`An error occurred: ${error}`)
    }
    console.log('webtransport sending bidistream success')
    const bidiReader = this.transport.incomingBidirectionalStreams.getReader()
    const incombidi = await bidiReader.read()
    if (incombidi.value) {
      const bidistream = incombidi.value
      console.log('got a bidistream')
      const write = bidistream.writable.getWriter()
      const data3 = new Uint8Array([71, 72, 73])
      const data4 = new Uint8Array([74, 75, 76])
      write.write(data3)
      write.write(data4)
      const readbd = bidistream.readable.getReader()
      let i = 6
      while (true && i > 0) {
        const { done, value } = await readbd.read()
        if (done) {
          break
        }
        // value is a Uint8Array
        console.log('incom bd', value)
        i -= value.length
      }
      try {
        await write.close()
        console.log('All data has been sent for incoming bidi stream.')
      } catch (error) {
        console.error(`An error occurred: ${error}`)
      }
    }
    console.log('now unidirectional tests')
    const unidioutstream = await this.transport.createUnidirectionalStream()
    const unidiwrite = unidioutstream.getWriter()
    const data5 = new Uint8Array([77, 78, 79])
    const data6 = new Uint8Array([80, 81, 82])
    unidiwrite.write(data5)
    unidiwrite.write(data6)
    const unidiReader = this.transport.incomingUnidirectionalStreams.getReader()
    const incomunidi = await unidiReader.read()
    if (incomunidi.value) {
      const unidistream = incomunidi.value
      console.log('got a unidistream')
      const readud = unidistream.getReader()
      let i = 6
      while (true && i > 0) {
        const { done, value } = await readud.read()
        if (done) {
          break
        }
        // value is a Uint8Array
        console.log('incom ud', value)
        i -= value.length
      }
    }
    console.log('finally test datagrams')
    const datawrite = await this.transport.datagrams.writable.getWriter()
    const data7 = new Uint8Array([83, 84, 85])
    const data8 = new Uint8Array([86, 87, 88])
    datawrite.write(data7)
    datawrite.write(data8)
    const readdg = await this.transport.datagrams.readable.getReader()
    i = 6
    while (true && i > 0) {
      const { done, value } = await readdg.read()
      if (done) {
        break
      }
      // value is a Uint8Array
      console.log('incom dg', value)
      i -= value.length
    }
  }
}