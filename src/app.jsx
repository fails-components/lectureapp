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

import React, { useState } from 'react'
// import 'primereact/resources/themes/nova/theme.css'
import './theme/theme.scss' // fails theme based on saga blue
import 'primereact/resources/primereact.min.css'

import { FailsBoard, FailsScreen, FailsNotes } from './main.jsx'
import './index.css'

import { FailsConfig } from '@fails-components/config'
import { Welcome } from './welcome.jsx'
import { SocketInterface } from './socketinterface'
// eslint-disable-next-line camelcase
import jwt_decode from 'jwt-decode'

const cfg = new FailsConfig({ react: true })

let purposesetter = (purpose) => {
  console.log('old setter')
}

let gotmessage = false

// start the network stuff
SocketInterface.createSocketInterface()

window.addEventListener(
  'message',
  (event) => {
    console.log('message from', event.origin /* , 'data:', event.data */)
    if (
      event.origin !== cfg.getURL('appweb') &&
      event.origin !== cfg.getURL('web') &&
      event.origin !== window.location.origin
    ) {
      console.log(
        'origin check',
        event.origin,
        cfg.getURL('appweb'),
        cfg.getURL('web')
      )
      return
    }

    if (event.data && event.data.token && event.data.purpose && !gotmessage) {
      gotmessage = true
      sessionStorage.setItem('failspurpose', event.data.purpose)
      sessionStorage.setItem('failstoken', event.data.token)
      console.log('purpose', event.data.purpose)
      SocketInterface.getInterface().setInitialDecodedToken(
        jwt_decode(event.data.token)
      )
      purposesetter(event.data.purpose)
      if (event.source) {
        event.source.postMessage({ failsTokenOk: true })
      }
    }
  },
  false
)

const App = () => {
  const [purpose, setPurpose] = useState(sessionStorage.getItem('failspurpose'))

  purposesetter = setPurpose

  console.log('app purpose', purpose)

  if (purpose === 'lecture') {
    return <FailsBoard width='100vw' height='100vh'></FailsBoard>
  } else if (purpose === 'screen') {
    return <FailsScreen width='100vw' height='100vh'></FailsScreen>
  } else if (purpose === 'notes') {
    return <FailsNotes width='100vw' height='100vh'></FailsNotes>
  } else {
    return <Welcome purposesetter={purposesetter}></Welcome>
  }
}

export default App
