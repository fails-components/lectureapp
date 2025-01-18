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
import { SHA1 } from 'jshashes'
import React, { Component, Fragment } from 'react'
import { Tooltip } from 'primereact/tooltip'
import {
  faMaximize,
  faArrowsAlt,
  faTachometerAlt,
  faCamera,
  faChevronLeft,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { JupyterEdit } from '../../../../app/src/jupyteredit'
import { OverlayPanel } from 'primereact/overlaypanel'

export class AppletButton extends Component {
  constructor(args) {
    super(args)
    this.buttonRef = React.createRef()
  }

  setPointerCapture(pointerid) {
    this.buttonRef.current?.setPointerCapture?.(pointerid)
  }

  render() {
    const icon = typeof this.props.icon !== 'string' && this.props.icon
    const style = {}
    let iconclassname
    if (typeof this.props.icon === 'string') iconclassname = this.props.icon
    if (this.props.hide) style.visibility = 'hidden'
    return (
      <button
        className={
          this.props.selected
            ? 'appletButtons appletButtonSelected'
            : 'appletButtons'
        }
        ref={this.buttonRef}
        style={style}
        onClick={this.props.onClick}
        onPointerDown={this.props.onPointerDown}
        onPointerMove={this.props.onPointerMove}
        onPointerUp={this.props.onPointerUp}
      >
        {icon}
        {iconclassname && <span className={iconclassname}></span>}
        {this.props.tooltip && (
          <Tooltip
            target={this.buttonRef.current}
            content={this.props.tooltip}
            className='teal-tooltip'
            position='top'
            showDelay={1000}
          />
        )}
      </button>
    )
  }
}

class Dict {
  static reservedTypes = 32
  constructor() {
    this.resetDict()
  }

  resetDict() {
    this._dictIndex = new Map()
    this._dict = []
    this._dictWindowPointer = 0
    this._dictId = undefined
  }
}

class DictCompressor extends Dict {
  constructor() {
    super()
    this._compressorId = Math.random().toString(36).substr(2, 9)
    this._dictNum = 0
  }

  codeState(path, mime, state, reffullstate) {
    // we will compress the incoming state, with a special dictionary

    const cur = {
      length: 32768,
      pos: 0
    }
    cur.chunk = new Uint8Array(cur.length)
    cur.chunkview = new DataView(cur.chunk.buffer)
    if (typeof this._dictId === 'undefined') {
      this._dictNum++
      this._dictId = parseInt(
        '0x' +
          new SHA1()
            .hex(this._compressorId + this._dictNum.toString(36))
            .substr(0, 8)
      )
    }
    // header
    this.checkLength(5, cur)
    cur.chunkview.setUint8(cur.pos, 1) // version
    cur.chunkview.setUint32(cur.pos + 1, this._dictId) // unique stream id
    cur.pos += 5
    this.writeString(path, cur)
    this.writeString(mime, cur)

    this.writeObject(state, cur, reffullstate)
    return new Uint8Array(cur.chunk.buffer, 0, cur.pos)
  }

  checkLength(length, cur) {
    if (cur.pos + length >= cur.length) {
      const oldlength = cur.length
      const newlength = oldlength * 2
      const oldchunk = cur.chunk
      cur.chunk = new Uint8Array(newlength)
      cur.chunk.set(oldchunk, 0)
      cur.length = newlength
      // reallocate
      cur.chunkview = new DataView(cur.chunk.buffer)
    }
  }

  writeObject(val, cur, reffullstate) {
    this.writeSimpleType(8, cur) // Start of Object
    for (const [key, value] of Object.entries(val)) {
      // first code the key, we allow a dictionary of 65635 - reserved types values
      this.writeString(key, cur)
      // now we code the value
      this.writeBasicTypes(value, cur, reffullstate?.[key])
      if (
        typeof reffullstate !== 'undefined' &&
        typeof reffullstate === 'object' &&
        !Array.isArray(reffullstate) &&
        (!reffullstate?.[key] ||
          typeof reffullstate?.[key] !== 'object' ||
          typeof value !== typeof reffullstate?.[key] ||
          Array.isArray(value) !== Array.isArray(reffullstate?.[key]))
      )
        reffullstate[key] = value
    }
    this.writeSimpleType(9, cur) // End of Object
  }

  writeArray(val, cur, reffullstate) {
    this.writeSimpleType(9, cur) // Start of Array
    const length = Math.min(val.length, 254)
    this.writeVarType(length, cur)
    for (let ind = 0; ind < length; ind++) {
      // now we code the value
      this.writeBasicTypes(val[ind], cur, reffullstate?.[ind])
      if (
        typeof reffullstate !== 'undefined' &&
        typeof reffullstate === 'object' &&
        Array.isArray(reffullstate) &&
        (!reffullstate[ind] ||
          typeof reffullstate[ind] !== 'object' ||
          typeof val !== typeof reffullstate[ind] ||
          Array.isArray(val) !== Array.isArray(reffullstate[ind]))
      )
        reffullstate[ind] = val[ind]
    }
  }

  writeBasicTypes(value, cur, reffullstate) {
    /* if (value === reffullstate) {
      return this.writeSimpleType(12, cur) // we coded use reffull state
    } */
    switch (typeof value) {
      case 'undefined':
        this.writeSimpleType(1, cur)
        break
      case 'boolean':
        if (value === true) this.writeSimpleType(2, cur)
        else this.writeSimpleType(3, cur)
        break
      case 'number':
        if (
          !Number.isInteger(value) ||
          value < -2147483648 ||
          value > 2147483647
        ) {
          this.writeFloat(value, cur)
        } else if (value > -127 && value < 128) {
          this.writeBInt(value, cur)
        } else {
          this.writeInt(value, cur)
        }
        break
      case 'bigint':
        this.writeBigInt(value, cur)
        break
      case 'object':
        if (Array.isArray(value)) {
          this.writeArray(value, cur, reffullstate)
        } else if (value === null) {
          this.writeSimpleType(10, cur)
        } else {
          this.writeObject(value, cur, reffullstate)
        }
        break
      case 'string':
        this.writeString(value, cur)
        break
      case 'function':
      case 'symbol':
      default:
        throw new Error('Default/symbol/function case is forbidden')
    }
  }

  writeSimpleType(type, cur) {
    this.writeVarType(type, cur)
  }

  writeVarType(type, cur) {
    if (type < 0x80) {
      this.checkLength(1, cur)
      cur.chunkview.setUint8(cur.pos, type)
      cur.pos += 1
    } else {
      this.checkLength(2, cur)
      cur.chunkview.setUint8(cur.pos, (type & 0x7f) | 0x80)
      cur.chunkview.setUint8(cur.pos + 1, (type >> 7) & 0xff)
      cur.pos += 2
    }
  }

  writeBInt(value, cur) {
    this.writeVarType(11, cur)
    this.checkLength(1, cur)
    cur.chunkview.setInt8(cur.pos, value)
    cur.pos += 1
  }

  writeInt(value, cur) {
    this.writeVarType(4, cur)
    this.checkLength(4, cur)
    cur.chunkview.setInt32(cur.pos, value)
    cur.pos += 4
  }

  writeBigInt(value, cur) {
    this.writeVarType(6, cur)
    this.checkLength(8, cur)
    cur.chunkview.setBigInt(cur.pos, value)
    cur.pos += 8
  }

  writeFloat(value, cur) {
    this.writeVarType(5, cur)
    this.checkLength(4, cur)
    cur.chunkview.setFloat32(cur.pos, value)
    cur.pos += 4
  }

  writeString(string, cur) {
    this.checkLength(2 + 1 + 3 * string.length, cur)
    const tencoder = new TextEncoder()
    const numtypes = 32767 - Dict.reservedTypes
    const type = this._dictIndex.get(string) || 0 // means new string
    this.writeVarType(type, cur)
    if (type === 0) {
      // we limit strings to 254 characters, seriously, 255 is reserved for future length extension
      let { written } = tencoder.encodeInto(
        string,
        cur.chunk.subarray(cur.pos + 1)
      )
      if (written > 254) written = 254
      cur.chunkview.setUint8(cur.pos, written)
      cur.pos += written + 1
      if (this._dict[this._dictWindowPointer]) {
        this._dictIndex.delete(this._dict[this._dictWindowPointer])
      }
      this._dict[this._dictWindowPointer] = string
      this._dictIndex.set(string, this._dictWindowPointer + Dict.reservedTypes)
      this._dictWindowPointer = (this._dictWindowPointer + 1) % numtypes
    }
  }
}

class DictDecompressor extends Dict {
  decodeState(buffer, getReffullstate) {
    // we will compress the incoming state, with a special dictionary
    try {
      const cur = {
        length: buffer.byteLength,
        pos: 0,
        chunk: buffer,
        chunkview: new DataView(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength
        )
      }

      const version = cur.chunkview.getUint8(cur.pos) // version
      if (version !== 1)
        throw new Error('Unsupported compression version and type')
      const dictId = cur.chunkview.getUint32(cur.pos) // unique stream id
      if (dictId !== this._dictId) {
        // May be we need a map of dictionaries?
        this.resetDict()
        this._dictId = dictId
      }
      cur.pos += 5

      const path = this.readString(cur)
      const mime = this.readString(cur)
      const reffullstate = getReffullstate(path, mime)

      const state = this.readObject(cur, reffullstate)
      return { path, mime, state }
    } catch (error) {
      console.log('decode State error: ', error)
      return undefined
    }
  }

  checkLength(length, cur) {
    if (cur.pos + length >= cur.length) return false
    return true
  }

  readObject(cur, reffullstate) {
    const type = this.readSimpleType(cur) // Start of Object
    if (type !== 8) return undefined // not a object
    const retobj = {}
    while (true) {
      // first code the key, we allow a dictionary of 65635 - reserved types values
      const key = this.readString(cur)
      if (typeof key === 'undefined') {
        // broken
        return undefined
      }
      // now we code the value
      const value = this.readBasicTypes(cur, reffullstate?.[key])
      if (
        typeof reffullstate !== 'undefined' &&
        typeof reffullstate === 'object' &&
        !Array.isArray(reffullstate) &&
        (!reffullstate?.[key] ||
          typeof reffullstate?.[key] !== 'object' ||
          typeof value !== typeof reffullstate?.[key] ||
          Array.isArray(value) !== Array.isArray(reffullstate?.[key]))
      )
        reffullstate[key] = value
      retobj[key] = value
      const ntype = this.peakSimpleType(cur)
      if (ntype === 9) break // end of object
    }
    this.readSimpleType(cur) // End of Object
    return retobj
  }

  readArray(cur, reffullstate) {
    const type = this.readSimpleType(cur) // Start of array
    if (type !== 9) return undefined // not a array
    const length = this.readVarType(cur)
    const retarray = new Array(length)
    for (let ind = 0; ind < length; ind++) {
      // now we code the value
      const value = this.readBasicTypes(cur, reffullstate?.[ind])
      if (
        typeof reffullstate !== 'undefined' &&
        typeof reffullstate === 'object' &&
        Array.isArray(reffullstate) &&
        (!reffullstate[ind] ||
          typeof reffullstate[ind] !== 'object' ||
          typeof value !== typeof reffullstate[ind] ||
          Array.isArray(value) !== Array.isArray(reffullstate[ind]))
      )
        reffullstate[ind] = value
      retarray[ind] = value
    }
    return retarray
  }

  readBasicTypes(cur, reffullstate) {
    const ptype = this.peakSimpleType(cur)
    switch (ptype) {
      case 12: // reffullstate
        this.readSimpleType(cur)
        return reffullstate
      case 1: // 'undefined':
        this.readSimpleType(cur)
        return undefined
      case 2: // boolean true
        this.readSimpleType(cur)
        return true
      case 3: // boolean false
        this.readSimpleType(cur)
        return false
      case 5: // number float
        return this.readFloat(cur)
      case 11: // number byte int
        return this.readBInt(cur)
      case 4:
        return this.readInt(cur)
      case 6:
        return this.readBigInt(cur)
      case 8:
        return this.readObject(cur, reffullstate)
      case 9:
        return this.readArray(cur, reffullstate)
      case 10:
        this.readSimpleType(cur)
        return null
      default:
        if (ptype !== 0 && ptype < Dict.reservedTypes) break // unknown type
        // string
        return this.readString(cur)
    }
  }

  readSimpleType(cur) {
    return this.readVarType(cur)
  }

  peakSimpleType(cur) {
    return this.peakVarType(cur)
  }

  readVarType(cur) {
    let type = cur.chunkview.getUint8(cur.pos)
    cur.pos += 1
    if (type & 0x80) {
      const next = cur.chunkview.getUint8(cur.pos)
      cur.pos += 1
      type = (type & 0x7f) | (next << 7)
    }
    return type
  }

  peakVarType(cur) {
    let type = cur.chunkview.getUint8(cur.pos)
    if (type & 0x80) {
      const next = cur.chunkview.getUint8(cur.pos + 1)
      type = (type & 0x7f) | (next << 7)
    }
    return type
  }

  readBInt(cur) {
    const type = this.readVarType(cur)
    if (type !== 11) return undefined
    const value = cur.chunkview.getInt8(cur.pos)
    cur.pos += 1
    return value
  }

  readInt(cur) {
    const type = this.readVarType(cur)
    if (type !== 4) return undefined
    const value = cur.chunkview.getInt32(cur.pos)
    cur.pos += 4
    return value
  }

  readBigInt(cur) {
    const type = this.readVarType(cur)
    if (type !== 6) return undefined
    const value = cur.chunkview.getBigInt(cur.pos)
    cur.pos += 8
    return value
  }

  readFloat(cur) {
    const type = this.readVarType(cur)
    if (type !== 5) return undefined
    const value = cur.chunkview.getFloat32(cur.pos)
    cur.pos += 4
    return value
  }

  readString(cur) {
    const tdecoder = new TextDecoder()
    const numtypes = 65535 - Dict.reservedTypes
    const type = this.readVarType(cur)

    // const type = this._dictIndex.get(string) || 0 // means new string
    if (type === 0) {
      // we limit strings to 254 characters, seriously, 255 is reserved for future length extension
      const length = cur.chunkview.getUint8(cur.pos)
      cur.pos++
      if (length > 254) throw new Error('Invalid string data')
      const data = cur.chunk.subarray(cur.pos, cur.pos + length)
      const string = tdecoder.decode(data)
      cur.pos += length
      if (this._dict[this._dictWindowPointer]) {
        this._dictIndex.delete(this._dict[this._dictWindowPointer])
      }
      this._dict[this._dictWindowPointer] = string
      this._dictIndex.set(string, this._dictWindowPointer + Dict.reservedTypes)
      this._dictWindowPointer = (this._dictWindowPointer + 1) % numtypes
      return string
    }
    const dictindex = type - Dict.reservedTypes
    if (typeof this._dict[dictindex] === 'undefined')
      throw new Error('Unknown dictionary value')
    return this._dict[dictindex]
  }
}

// will likely go into fails data, when ready
class JupyterStateStore {
  constructor() {
    this._state = new Map()
    this._dstate = new Map()
    this.dictCompress = new DictCompressor()
    this.dictDecompress = new DictDecompressor()
  }

  flushCompress() {
    this._state = new Map()
    this.dictCompress.resetDict()
  }

  updateState(key, mime, state) {
    let old = this._state.get(key)
    if (!old) {
      // in state we have the current diff as in the message
      // in fullstate, we do not allow deletes, e.g. for plotly,
      // that confuses a state with a message mechanism
      // but the messages are diffs...
      old = { state: {}, fullstate: {} }
      this._state.set(key, old)
    }

    /* const objdiff = diff(old.state, state)
    const objdifffull = diff(old.fullstate, state)
    diffApply(old.state, objdiff)
    diffApply(
      old.fullstate,
      objdiff.filter((cmd) => cmd.op !== 'remove')
    )
    console.log(
      'current states',
      old.state,
      old.fullstate,
      JSON.stringify(state).length,
      JSON.stringify(objdiff).length,
      JSON.stringify(objdifffull).length
    )
      */
    const coded = this.dictCompress.codeState(key, mime, state, old.fullstate)
    /* console.log(
      'coded state test',
      JSON.stringify(state).length,
      coded.byteLength
    )
    console.log('fullstate', old.fullstate) */
    /*
    console.log(
      'coded state diff',
      diff(state, decoded?.state),
      state,
      decoded?.state
    )
    console.log(
      'coded fullstate diff',
      diff(old.fullstate, dold.fullstate),
      old.fullstate,
      dold.fullstate
    )
    console.log('coded state path', key, decoded?.path, mime, decoded?.mime) */

    // return objdiff
    return coded
  }

  receiveData(buffer) {
    const decoded = this.dictDecompress.decodeState(
      new Uint8Array(buffer),
      (path, mime) => {
        let dold = this._dstate.get(path)
        if (!dold) {
          // in state we have the current diff as in the message
          // in fullstate, we do not allow deletes, e.g. for plotly,
          // that confuses a state with a message mechanism
          // but the messages are diffs...
          dold = { state: {}, fullstate: {}, mime }
          this._dstate.set(path, dold)
        }
        return dold.fullstate
      }
    )
    return decoded
  }

  getAllStateData() {
    const toret = []
    for (const [key, value] of this._dstate.entries()) {
      toret.push({ path: key, mime: value.mime, state: value.fullstate })
    }
    return toret
  }
}

export class JupyterHublet extends Component {
  constructor(props) {
    super(props)
    this.buttonRef = {
      resize: React.createRef(),
      move: React.createRef()
    }
    this.jupyteredit = React.createRef()
    this.jupyterinfo = React.createRef()
    this.kernelStatusRef = React.createRef()
    this.moveid = {}
    this.movemodeactiv = {}
    this.moveposcurrent = {}
    this.moveposstart = {}
    this.lastmovetime = {}
    this.state = {}
    this.state.movemodeactiv = {}
    this.state.kernelStatus = 'unknown'
    this.state.appLocked = true
    this.appletwidth = 100
    this.appletheight = 100
    this.jState = new JupyterStateStore()
    this.pendingStateUpdates = []
    this.kernelReady = false
  }

  componentDidMount() {
    // we just got mounted, we should load the file
    this.pendingStateUpdates = [] // clear state updates
    this.kernelReady = false
    this.jState.flushCompress()
    this.tryLoadJupyterFile()
    if (this.props.setStateReceiver) {
      this.installStateReceiver()
    }
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.props.ipynb?.sha !== prevProps.ipynb?.sha) {
      this.setState({ jupyteredit: false })
      this.pendingStateUpdates = [] // clear state updates
      this.kernelReady = false
      this.jState.flushCompress()
      this.tryLoadJupyterFile()
    }
    if (this.props.master !== prevProps.master) {
      // check if we have to initiate a master rescale
      this.checkAdjustAppletSize()
      if (this.props.master) {
        // we became a master, so flush the jstate
        this.jState.flushCompress()
      }
    }
    if (
      this.props.setStateReceiver &&
      this.props.setStateReceiver !== prevProps.setStateReceiver
    ) {
      this.installStateReceiver()
    }

    if (!this.props.isnotepad) {
      if (
        prevState.appLocked !== this.state.appLocked &&
        this.state.appLocked
      ) {
        // We are locked again, so go back to locked state!
        this.sendCompleteStateUpdate()
      }
    }
  }

  installStateReceiver() {
    this.props.setStateReceiver({
      receiveData: (buffer, replay) => {
        if (replay) this.pendingStateUpdates.push(buffer)
        else {
          this.receiveStateUpdate(buffer)
        }
      }
    })
  }

  async jupyterLicense() {
    const { licenses } = await this.jupyteredit.current.getLicenses()
    const lines = []
    for (const [key, value] of Object.entries(licenses.bundles)) {
      lines.push(
        key + '\n' + '#'.repeat(key.length) + '\n\n',
        'Dependencies:\n'
      )
      const text = value?.packages
        ?.map?.(
          ({ name, versionInfo = '', licenseId = '', extractedText = '' }) => {
            const heading = name + '(' + versionInfo + ', ' + licenseId + ')'
            return (
              heading +
              ':\n' +
              '-'.repeat(heading.length) +
              '\n' +
              extractedText
            )
          }
        )
        ?.join('\n')
      if (text) lines.push(text)
    }
    // now generate a blob and download
    const blob = new Blob([lines.join('')], {
      type: 'text/plain'
    })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    URL.revokeObjectURL(url)
  }

  async tryLoadJupyterFile() {
    if (!this.props?.ipynb?.sha || !this.props?.ipynb?.url) {
      this.setState({ jupyteredit: false })
    }
    if (!this.props?.ipynb?.url) return
    try {
      const response = await fetch(this.props.ipynb?.url)
      if (!response.ok)
        throw new Error(
          'Fetch failed with code: ' +
            response.status +
            ' ' +
            response.statusText
        )
      const jupyterDocument = await response.json()
      this.setState({ jupyterDocument, jupyteredit: true })
    } catch (error) {
      console.log('Problem loading Jupyter file', error)
    }
  }

  async doScreenshot() {
    if (!this.props.screenShotSaver) return
    if (!this.props.addPicture) return
    try {
      const { sha } = await this.props.screenShotSaver(
        await this.jupyteredit.current?.screenShot?.({
          dpi: 300
        })
      )
      if (!sha) {
        throw new Error('No sha in doScreeenshot')
      }
      // TODO issue picture command
      this.props.addPicture(
        this.props.pos.x,
        this.props.pos.y,
        this.props.pos.width,
        this.props.pos.height,
        sha
      )
      // remove app, this also ensures, that it happens after the new picture arrives
      if (!this.props.submitAppPosition) return
      this.props.submitAppPosition(
        this.props.pos.x,
        this.props.pos.y,
        this.props.pos.width,
        this.props.pos.height,
        true
      )
    } catch (error) {
      console.log('Screenshot error', error)
    }
  }

  receiveStateUpdate(buffer) {
    if (this.props.master) return
    // master gets no updates
    const stateUpdate = this.jState.receiveData(buffer)
    // do not update jupyter edit, while student is allowed to alter the state
    if (!this.props.isnotepad && !this.state.appLocked) return
    const { path, mime, state } = stateUpdate
    this.jupyteredit.current?.sendInterceptorUpdate?.({
      path,
      mime,
      state
    })
  }

  processInitialStateUpdates() {
    // Note also a master should get this
    const updates = this.pendingStateUpdates
    this.pendingStateUpdates = []
    if (updates.length === 0) return
    for (const buffer of updates) {
      this.jState.receiveData(buffer)
    }
    // ok, we got all updates
    // we know iterate over all fullstate models and send them out
    this.sendCompleteStateUpdate()
  }

  sendCompleteStateUpdate() {
    this.jState.getAllStateData().forEach(({ path, mime, state }) => {
      this.jupyteredit.current?.sendInterceptorUpdate?.({
        path,
        mime,
        state
      })
    })
  }

  kernelStateTrigger(status) {
    // see if the initial kernel startup is over!
    if (status === 'idle') {
      if (!this.kernelReady) {
        if (this.pendingKernelReadyTrigger)
          clearTimeout(this.pendingKernelReadyTrigger)
        this.pendingKernelReadyTrigger = setTimeout(() => {
          delete this.pendingKernelReadyTrigger
          this.kernelReady = true
          this.processInitialStateUpdates()
        }, 500) // needs to be idle for more than 500 ms
      }
    } else {
      if (this.pendingKernelReadyTrigger) {
        clearTimeout(this.pendingKernelReadyTrigger)
        delete this.pendingKernelReadyTrigger
      }
    }
  }

  canMove() {
    return this.props.master // or unlocked
  }

  onPointerDown(buttonid, event) {
    if (!this.canMove()) return
    if (this.buttonRef[buttonid].current) {
      this.buttonRef[buttonid].current.setPointerCapture(event.pointerId)
    }
    const stateChange = {}
    stateChange[buttonid] = true
    this.setState((state) => ({
      movemodeactiv: { ...state.movemodeactiv, ...stateChange }
    }))
    this.movemodeactiv[buttonid] = true
    this.moveid[buttonid] = event.pointerId
    this.lastmovetime[buttonid] = Date.now() - 50
    this.moveposstart[buttonid] = { x: event.clientX, y: event.clientY }
    this.moveposcurrent[buttonid] = { x: event.clientX, y: event.clientY }
  }

  onPointerMove(buttonid, event) {
    if (!this.canMove()) return
    // by pass for better smoothness
    const now = Date.now()
    if (
      this.movemodeactiv[buttonid] &&
      this.moveid[buttonid] === event.pointerId &&
      now - this.lastmovetime[buttonid] > 25
    ) {
      this.moveposcurrent[buttonid] = { x: event.clientX, y: event.clientY }
      // const pos = { x: event.clientX, y: event.clientY }
      /* this.blackboard().addFormPictureMovePos({
        pos,
        corner: this.props.corner
      }) */
      this.lastmovetime[buttonid] = now
      this.updateMovePos()
    }
  }

  onPointerUp(buttonid, event) {
    if (!this.canMove()) return
    // rewrite
    if (
      this.movemodeactiv[buttonid] &&
      this.moveid[buttonid] === event.pointerId
    ) {
      this.commitMovePos()
      const stateChange = {}
      stateChange[buttonid] = false
      this.setState((state) => ({
        movemodeactiv: { ...state.movemodeactiv, ...stateChange }
      }))
      delete this.movemodeactiv[buttonid]
      delete this.moveid[buttonid]
      delete this.moveposstart[buttonid]
      delete this.moveposcurrent[buttonid]
      this.updateMovePos()
    }
  }

  get aspect() {
    return this.appletwidth / this.appletheight
  }

  commitMovePos() {
    if (this.props.master && this.props.submitAppPosition) {
      this.props.submitAppPosition(
        this.props.pos.x + (this.state?.movepos?.x ?? 0) / this.props.bbwidth,
        this.props.pos.y + (this.state?.movepos?.y ?? 0) / this.props.bbwidth,
        this.props.pos.width +
          (this.state?.resize?.width ?? 0) / this.props.bbwidth,
        this.props.pos.height +
          (this.state?.resize?.height ?? 0) / this.props.bbwidth,
        this.props.deactivated
      )
    }
  }

  updateMovePos() {
    const stateChange = { movepos: undefined, resize: undefined }
    if (this.movemodeactiv.move) {
      stateChange.movepos = {
        x: this.moveposcurrent.move.x - this.moveposstart.move.x,
        y: this.moveposcurrent.move.y - this.moveposstart.move.y
      }
    }
    if (this.movemodeactiv.resize) {
      // this one is trickier, first calculate the width and height
      const oldwidth = this.props.pos.width * this.props.bbwidth
      const oldheight = this.props.pos.height * this.props.bbwidth
      let newwidth =
        oldwidth + this.moveposcurrent.resize.x - this.moveposstart.resize.x
      let newheight =
        oldheight + this.moveposcurrent.resize.y - this.moveposstart.resize.y
      // filter out edge cases
      newwidth = Math.max(150, newwidth)
      newheight = Math.max(150, newheight)
      const destaspect = this.aspect
      if (newwidth > newheight) {
        newheight = newwidth / destaspect
      } else {
        newwidth = newheight * destaspect
      }
      newheight -= oldheight
      newwidth -= oldwidth

      stateChange.resize = {
        width: newwidth,
        height: newheight
      }
    }

    this.setState(stateChange)
  }

  setAspectScaleFactor(width, height) {
    if (width !== this.appletwidth || height !== this.appletheight) {
      this.appletwidth = width
      this.appletheight = height
    }
    this.setState({ appletwidth: width, appletheight: height })
    this.checkAdjustAppletSize()
  }

  checkAdjustAppletSize() {
    if (this.props.master) {
      const oldaspect = this.props.pos.width / this.props.pos.height
      const newaspect = this.aspect
      if (oldaspect !== newaspect) {
        // Keep the area constant
        const area = this.props.pos.width * this.props.pos.height
        this.props.submitAppPosition(
          this.props.pos.x,
          this.props.pos.y,
          Math.sqrt(newaspect * area),
          Math.sqrt(area / newaspect),
          this.props.deactivated
        )
        /* if (
          this.props.pos.height * newaspect < this.props.pos.width &&
          this.props.pos.height * newaspect > 0.1
        ) {
          // we have to choose the height as reference
          this.props.submitAppPosition(
            this.props.pos.x,
            this.props.pos.y,
            this.props.pos.height * newaspect,
            this.props.pos.height,
            this.props.deactivated
          )
        } else {
          // we have to choose the width as reference
          this.props.submitAppPosition(
            this.props.pos.x,
            this.props.pos.y,
            this.props.pos.width,
            this.props.pos.width / newaspect,
            this.props.deactivated
          )
        } */
      }
    }
  }

  render() {
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    )
    const buttonVSize = 2.357 /* rem */ * rootFontSize + 8 /* border */
    const buttonHSize = 1.35 * rootFontSize
    const applet = this.props.ipynb?.applets?.find?.(
      (el) => this.props.appids?.appid === el.appid
    )
    const master = this.props.master
    const stopProp = (event) => event.stopPropagation()
    const width =
      this.props.pos.width * this.props.bbwidth +
      2 * buttonHSize +
      (this.state.resize?.width ?? 0)

    const wscale = Math.min(
      5,
      Math.max(
        0.2,
        (this.props.pos.width * this.props.bbwidth +
          (this.state.resize?.width ?? 0)) /
          (this.state?.appletwidth ??
            this.props.pos.width * this.props.bbwidth +
              (this.state.resize?.width ?? 0))
      )
    )
    const hscale = Math.min(
      5,
      Math.max(
        0.2,
        (this.props.pos.height * this.props.bbwidth +
          (this.state.resize?.height ?? 0)) /
          (this.state?.appletheight ??
            this.props.pos.height * this.props.bbwidth +
              (this.state.resize?.height ?? 0))
      )
    )
    let className = 'appletMain'
    if (this.state.movepos || this.state.resize) className += ' appletMainMove'
    if (this.props.laserPointerOn) className += ' appletMainLaserPointer'
    return (
      <Fragment>
        <div
          className={className}
          key='appletMain'
          style={{
            position: 'absolute',
            left:
              (this.props.deactivated
                ? -width - 100
                : this.props.pos.x * this.props.bbwidth -
                  buttonHSize +
                  (this.state.movepos?.x ?? 0)) + 'px',
            top:
              this.props.pos.y * this.props.bbwidth -
              buttonVSize +
              (this.state.movepos?.y ?? 0) +
              'px',
            width: width + 'px',
            height:
              this.props.pos.height * this.props.bbwidth +
              2 * buttonVSize +
              (this.state.resize?.height ?? 0) +
              'px',
            zIndex: this.props.zIndex
          }}
          onPointerDown={stopProp}
          onPointerMove={stopProp}
          onPointerUp={stopProp}
        >
          <div
            style={{
              position: 'absolute',
              left: '0px',
              bottom: '0px'
            }}
          >
            {master && (
              <AppletButton
                icon={<FontAwesomeIcon icon={faChevronLeft} />}
                key='collapsebutton'
                tooltip='Collapse applet'
                onClick={(event) =>
                  this.props.submitAppPosition(
                    this.props.pos.x,
                    this.props.pos.y,
                    this.props.pos.width,
                    this.props.pos.height,
                    true
                  )
                }
              />
            )}
          </div>
          <div style={{ position: 'absolute', right: '0px', bottom: '0px' }}>
            {!this.props.isnotepad && (
              <AppletButton
                // eslint-disable-next-line no-constant-condition
                icon={!this.state.appLocked ? 'pi pi-lock-open' : 'pi pi-lock'}
                key='lockbutton'
                tooltip='Unlock/Lock to instructors applet state'
                onClick={() => {
                  this.setState((state) => ({ appLocked: !state.appLocked }))
                }}
              />
            )}
            {!master && this.props.makeAppletMaster && (
              <AppletButton
                icon={<FontAwesomeIcon icon={faTachometerAlt} />}
                key='controlbutton'
                onClick={() => {
                  this.props.makeAppletMaster()
                }}
                tooltip='Steer applet state'
              />
            )}
            {master && this.props.screenShotSaver && (
              <AppletButton
                icon={<FontAwesomeIcon icon={faCamera} />}
                key='appletbutton'
                onClick={() => {
                  this.doScreenshot()
                }}
                tooltip='Create picture from applet'
              />
            )}
            <AppletButton
              icon={'pi pi-info-circle'}
              key='infobutton'
              onClick={(e) => {
                this.jupyterinfo?.current?.toggle?.(e)
              }}
              tooltip='Info about applet and license'
            />

            <AppletButton
              icon={<FontAwesomeIcon icon={faMaximize} />}
              key='sizebutton'
              hide={!master}
              tooltip={
                !(this.state.movepos || this.state.resize) && 'Resize applet'
              }
              ref={this.buttonRef.resize}
              selected={!!this.state.movemodeactiv.resize}
              onPointerDown={(event) => this.onPointerDown('resize', event)}
              onPointerMove={(event) => this.onPointerMove('resize', event)}
              onPointerUp={(event) => this.onPointerUp('resize', event)}
            />
          </div>
          <div className='appletHeading'>
            <AppletButton
              icon={<FontAwesomeIcon icon={faArrowsAlt} />}
              key='movebutton'
              tooltip={
                !(this.state.movepos || this.state.resize) && 'Move applet'
              }
              hide={!master}
              ref={this.buttonRef.move}
              selected={!!this.state.movemodeactiv.move}
              onPointerDown={(event) => this.onPointerDown('move', event)}
              onPointerMove={(event) => this.onPointerMove('move', event)}
              onPointerUp={(event) => this.onPointerUp('move', event)}
            />
            <div className='appletHeadingText'>
              {applet?.appname || 'Loading...'}
            </div>
            <div
              ref={this.kernelStatusRef}
              className={
                'appletKernelStatus appletKernelStatus' +
                this.state.kernelStatus
              }
            >
              <Tooltip
                target={this.kernelStatusRef.current}
                content={'Kernel state: ' + this.state.kernelStatus}
                className='teal-tooltip'
                position='top'
                showDelay={1000}
              />
            </div>
            <AppletButton
              icon={'pi pi-times'}
              key='closebutton'
              hide={!(master && this.props.closeApp)}
              onClick={() => {
                this.props.closeApp()
              }}
              tooltip='Close applet'
            />
          </div>
          <div
            className='appletIframe'
            style={{
              position: 'absolute',
              inset: buttonVSize + 'px ' + buttonHSize + 'px'
            }}
          >
            <div
              style={{
                transform: 'scale(' + wscale + ',' + hscale + ')',
                transformOrigin: 'top left',
                width: '100%',
                height: '100%'
              }}
            >
              <JupyterEdit
                editActivated={this.state.jupyteredit}
                jupyterurl={window.location.origin + '/jupyter/index.html'}
                pointerOff={
                  !(
                    (this.props.master && this.props.isnotepad) ||
                    (!this.state.appLocked && !this.props.isnotepad)
                  )
                }
                rerunAtStartup={true}
                installScreenShotPatches={
                  !!this.props
                    .makeAppletMaster /* only install, if it can become master */
                }
                ref={this.jupyteredit}
                document={this.state.jupyterDocument}
                filename={this.props.ipynb?.filename}
                appid={this.props.appids?.appid}
                stateCallback={(stateChange) => {
                  this.setState((state) => ({
                    jupyterState: {
                      ...(state.jupyterState || {}),
                      ...stateChange
                    }
                  }))
                }}
                appletSizeChanged={(appid, width, height) => {
                  if (appid === this.props.appids?.appid) {
                    this.setAspectScaleFactor(width, height)
                  }
                }}
                kernelStatusCallback={(status) => {
                  console.log('kernelStatus', status)
                  this.kernelStateTrigger(status)
                  this.setState({ kernelStatus: status })
                }}
                receiveInterceptorUpdate={({ path, mime, state }) => {
                  // console.log('receiveInterceptorUpdate', path, mime, state)
                  if (!this.props.master) return // only a master processes state updates
                  // TODO check for mime
                  const diff = this.jState.updateState(path, mime, state)
                  this.props?.submitStateUpdate?.(diff)
                }}
              />
            </div>
            {/* Id: {this.props.appids.id} <br />
            Sha: {this.props.appids.sha} <br />
            AppId: {this.props.appids.appid} <br />
            Url: {this.props.ipynb?.url || 'No url'} <br /> */}
          </div>
        </div>
        <div
          className={
            this.props.deactivated
              ? 'appletCollapsed'
              : 'appletCollapsed appletCollapsedHidden'
          }
          key='appletCollapsed'
          onPointerDown={stopProp}
          onPointerMove={stopProp}
          onPointerUp={stopProp}
          onClick={(event) =>
            this.props.submitAppPosition(
              this.props.pos.x,
              this.props.pos.y,
              this.props.pos.width,
              this.props.pos.height,
              false
            )
          }
          style={{
            position: 'absolute',
            top:
              (this.props.pos.y + this.props.pos.height * 0.5) *
                this.props.bbwidth -
              0.5 * buttonVSize +
              (this.state.movepos?.y ?? 0) +
              'px',
            zIndex: this.props.zIndex
          }}
        >
          <div className='appletCollapsedContent'>
            <FontAwesomeIcon icon={faChevronRight} />
          </div>
        </div>
        <OverlayPanel className='tbChild' ref={this.jupyterinfo} showCloseIcon>
          <h3>FAILS' apps are powered by Jupyter Lite</h3>
          Build upon the shoulders of giants, see{' '}
          <button
            onClick={() => {
              if (this.jupyteredit.current) {
                this.jupyterLicense()
              }
            }}
            className='link-button'
          >
            {' '}
            OSS attribution and licensing{' '}
          </button>{' '}
          for app related content.
          <br /> <br />
        </OverlayPanel>
      </Fragment>
    )
  }
}
