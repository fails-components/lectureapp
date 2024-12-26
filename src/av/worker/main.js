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
import { AVTransport } from './transport'
import { AVWorker } from './avworker'

console.log('AVWorker before startConnection')

// eslint-disable-next-line prefer-const
let avworker
new AVTransport({
  cb: async () => {
    if (avworker) return await avworker.getTransportInfo()
    return null
  },
  status: (state) => {
    if (avworker) avworker.avtransportStatus(state)
  }
}).startConnection()

avworker = new AVWorker()

globalThis.addEventListener('message', avworker.onMessage)

console.log('AVWorker started')
