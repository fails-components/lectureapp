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
import { AVInterface } from '../av/interface'

export class SpeakerSet {
  constructor(args) {
    this.audioids = new Set()
    this.speakerStr = new Map()
    this.recycle = []
    this.mute = true
    this.audioidsmuted = new Set()
  }

  muted() {
    return this.mute
  }

  async muteOn() {
    if (!this.mute) {
      this.audioidsmuted = this.audioids // save old audio ids
    }

    this.mute = true
    try {
      await this.setAudioIds()
    } catch (error) {
      console.log('problem in mute On', error)
    }
  }

  async muteOff() {
    if (this.mute) {
      this.mute = false
      try {
        await this.setAudioIds(this.audioidsmuted)
      } catch (error) {
        console.log('problem in mute Off', error)
      }
      this.audioidsmuted = new Set()
    }
  }

  async setAudioIds(nids) {
    let newids = nids
    if (this.mute) {
      if (nids) this.audioidsmuted = nids
      newids = new Set()
    }
    // we need to hold a reference otherwise the garbage collector will clean it up
    const avinterf =
      this.avinterf || (this.avinterf = AVInterface.getInterface())
    // we have to figure out
    // (1) which ids are not speakerStr but in newids
    const newstreams = []
    // (2) which ids are in Map, and not anymore in newids
    for (const id of newids) {
      if (!this.speakerStr.has(id)) newstreams.push(id)
    }
    for (const sid of this.speakerStr.keys()) {
      if (!newids.has(sid)) {
        const ptotrash = this.speakerStr.get(sid)
        const totrash = await ptotrash
        console.log('totrash', totrash, sid)
        totrash.setSrcId(undefined) // clear the old stream
        this.recycle.push(ptotrash)
        this.speakerStr.delete(sid)
      }
    }
    // now we activate the missing ids
    for (const nid of newstreams) {
      let ns = this.recycle.pop()
      if (!ns) {
        try {
          console.log('Openaudio stream for', nid)
          const newspeaker = avinterf.openAudioOutput()
          this.speakerStr.set(nid, newspeaker)
          ns = await newspeaker
          ns.buildIncomingPipeline()
          ns.setSrcId(nid)
        } catch (error) {
          console.log('problem creating speaker, skip', error)
          continue
        }
      } else {
        ns.setSrcId(nid)
        this.speakerStr.set(nid, Promise.resolve(ns))
      }
    }
    this.audioids = newids
  }

  getListAudio() {
    return this.audioids
  }

  close() {
    this.speakerStr.forEach((speaker) => {
      speaker
        .then((spk) => spk.close())
        .catch((error) => {
          console.log('Problem closing speaker', error)
        })
    })
    this.speakerStr.clear()
    this.recycle.forEach((speaker) => {
      speaker
        .then((spk) => spk.close())
        .catch((error) => {
          console.log('Problem closing speaker', error)
        })
    })
    this.recycle = []
  }
}
