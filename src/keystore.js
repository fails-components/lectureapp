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

export class KeyStore {
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
    if (!KeyStore.instance) KeyStore.instance = new KeyStore()
    return KeyStore.instance
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
        new Error(
          'Decryption key not arrived. Other key arrived instead key ' +
            wkeyid +
            ' vs key ' +
            keyid
        )
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
