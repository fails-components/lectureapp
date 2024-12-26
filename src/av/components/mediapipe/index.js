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
export class AVMediaPipe {
  static workerInternal_
  static finalReg_
  static mpworkid = 0
  static reqid = 0
  static requests = {}

  static get worker() {
    if (!AVMediaPipe.workerInternal_) {
      AVMediaPipe.workerInternal_ = new Worker(
        new URL('./worker.js', import.meta.url),
        {
          type: 'module'
        }
      )
      AVMediaPipe.workerInternal_.addEventListener(
        'message',
        AVMediaPipe.onMessage
      )
      AVMediaPipe.finalReg_ = new FinalizationRegistry((mpworkid) => {
        AVMediaPipe.worker.postMessage({
          task: 'cleanUpObject',
          mpworkid
        })
      })
    }
    return AVMediaPipe.workerInternal_
  }

  static onMessage({ data }) {
    const { requestid, frame } = data
    const request = AVMediaPipe.requests[requestid]
    if (request) {
      request({ frame })
      delete AVMediaPipe.requests[requestid]
    } else {
      console.log('MEDIA PIPE unknown request', requestid, AVMediaPipe.requests)
    }
  }

  static getNewBackgroundRemover() {
    const worker = AVMediaPipe.worker
    AVMediaPipe.mpworkid++
    const mpworkid = AVMediaPipe.mpworkid
    worker.postMessage({
      task: 'openAVBackgroundRemover',
      mpworkid
    })
    const backgroundRemover = (frame) => {
      const requestid = AVMediaPipe.reqid++ + '_' + mpworkid
      worker.postMessage(
        {
          task: 'processFrame',
          frame,
          mpworkid,
          requestid
        },
        [frame]
      )
      return new Promise((resolve) => {
        AVMediaPipe.requests[requestid] = resolve
      })
    }
    const backgroundRemoverConfig = ({ color, type }) => {
      worker.postMessage({
        task: 'changeConfig',
        color,
        mpworkid,
        type
      })
    }
    AVMediaPipe.finalReg_.register(backgroundRemover, mpworkid)
    return { backgroundRemover, backgroundRemoverConfig }
  }
}
