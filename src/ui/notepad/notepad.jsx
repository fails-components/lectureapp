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

import React, { Component, Fragment } from 'react'
import { Blackboard, BlackboardNotepad } from '../blackboard/blackboard.jsx'
import { ToolBox, UtilBox, CopyDeleteBox } from '../toolbox/toolbox.jsx'
import {
  Dispatcher,
  Collection,
  MemContainer,
  NetworkSink,
  NetworkSource,
  Sink
} from '@fails-components/data'
import Dexie from 'dexie'

class DBManager {
  static manager = undefined
  constructor() {
    this.db = new Dexie('FailsDatabase')
    this.db.version(1).stores({
      lectures: 'uuid, title, coursetitle', // also includes boards
      lectureboards: 'uuidboard, uuid, board'
    })
  }

  async getLecture(uuid) {
    return await this.db.lectures.get(uuid)
  }

  async addUpdateLecture(uuid, obj) {
    await this.db.transaction('rw', 'lectures', async () => {
      const curobj = await this.db.lectures.get(uuid)
      if (curobj) await this.db.lectures.update(uuid, obj)
      else await this.db.lectures.put(obj)
    })
  }

  async addUpdateContainer(uuid, board, boarddata) {
    await this.db.transaction('rw', 'lectures', 'lectureboards', async () => {
      const curobj = await this.db.lectures.get(uuid)
      if (!curobj) throw new Error('DB lecture does not exist')

      if (curobj.boards) {
        if (!curobj.boards.includes(board)) {
          await this.db.lectures.update(uuid, {
            boards: [...curobj.boards, board]
          })
        }
      } else {
        await this.db.lectures.update(uuid, { boards: [board] })
      }
      // got it
      await this.db.lectureboards.put({
        uuidboard: uuid + ':' + board,
        uuid,
        board,
        boarddata
      })
    })
  }

  async getBoards(uuid) {
    return await this.db.lectureboards
      .where('uuid')
      .equals(uuid)
      .sortBy('board')
  }

  static getDBManager() {
    if (DBManager.manager) return DBManager.manager
    DBManager.manager = new DBManager()
    return DBManager.manager
  }
}

class ScrollSink extends Sink {
  constructor(destsink) {
    super()
    this.destsink = destsink
  }

  scrollBoard(time, clientnum, x, y) {
    this.destsink.scrollBoard(time, clientnum, x, y)
  }
}

class StorageHandler {
  constructor() {
    this.incomdispatcher = new Dispatcher()
    this.collection = new Collection(function (id, data) {
      return new MemContainer(id, data)
    }, {})
    this.incomdispatcher.addSink(this.collection)
  }

  addNetworkSupport() {
    this.networkreceive = new NetworkSource(this.incomdispatcher)
  }

  setScrollSink(destsink) {
    if (this.scrollsink) return
    this.scrollsink = new ScrollSink(destsink)
    this.incomdispatcher.addSink(this.scrollsink)
  }
}

export class NoteScreenBase extends Component {
  constructor(props) {
    super(props)
    // console.log('myprops', props)

    // this.animate=this.animate.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this)

    this.state = {}
    this.state.bbwidth = window.innerWidth
    this.state.bbheight = window.innerHeight
    this.state.devicePixelRatio = window.devicePixelRatio || 1.0

    this.blackboard = React.createRef()
    this.blackboardnotes = React.createRef()
    this.toolbox = React.createRef()
    this.confirmbox = React.createRef()
    this.originbox = React.createRef()
    this.copydeletebox = React.createRef()

    this.storage = new StorageHandler()
    this.storage.addNetworkSupport()

    this.running = false

    this.lectdetail = {} // local copy to track changes

    this.backgroundbw = true
    this.addUpdateLocalStorage()

    this.outgodispatcher = new Dispatcher()

    this.networksender = new NetworkSink((data) => {
      this.props.bbchannel.postMessage({
        command: 'drawcommand',
        data
      })
    })
    this.outgodispatcher.addSink(this.networksender)
  }

  addUpdateLocalStorage() {
    if (!this.props.isnotepad && this.props.notesmode) {
      if (!this.localstorage) {
        this.localstorage = new StorageHandler()
        this.storage.setScrollSink(this.localstorage.incomdispatcher)
        this.setState({ localstorage: this.localstorage })
      }
    }
  }

  loadNotesFromLocalStorage(uuid) {
    const dbman = DBManager.getDBManager()
    dbman
      .getBoards(uuid)
      .then((boards) => {
        if (!boards) return
        boards.forEach((board) => {
          this.localstorage.collection.replaceStoredData(
            board.board,
            board.boarddata
          )
        })
        if (this.storage?.collection?.commandcontainer?.getCurCommandState) {
          const cs =
            this.storage.collection.commandcontainer.getCurCommandState()
          this.setCommandState(cs)
        }
        if (this.blackboardnotes?.current)
          this.blackboardnotes?.current.doRedraw()
      })
      .catch((error) => {
        console.log('Problem getNFLS', error)
      })
  }

  autosaveNotes() {
    if (!this.lectdetail?.uuid) return
    const uuid = this.lectdetail?.uuid
    const dbman = DBManager.getDBManager()
    const collection = this.localstorage.collection
    const containers = this.localstorage.collection.containers
    const contdirty = this.localstorage.collection.contdirty
    // iterate through all dirty containers and save them
    const proms = []
    for (const cont in contdirty) {
      if (contdirty[cont]) {
        const data = containers[cont].getContainerData()

        const prom = dbman
          .addUpdateContainer(uuid, cont, data)
          .then(() => {
            collection.unDirty(cont)
            contdirty[cont] = false
          })
          .catch((error) => {
            console.log(
              'saving container: ',
              cont,
              'uuid: ',
              uuid,
              'failed: ',
              error
            )
          })
        proms.push(prom)
      }
    }
  }

  componentDidMount() {
    console.log('Component mount notepad')

    this.resizeeventlistener = (event) => {
      const iwidth = window.innerWidth
      const iheight = window.innerHeight

      console.log('resize event!' + event + iwidth + ' ' + iheight)

      this.props.updateSizes({ scrollheight: iheight / iwidth })
      console.log('resize' /*, myself.bgtrick */, iheight / iwidth)

      console.log('device pixel ratio', window.devicePixelRatio)
      this.setState({
        bbwidth: iwidth,
        bbheight: iheight,
        devicePixelRatio: window.devicePixelRatio || 1
      })
    }

    window.addEventListener('resize', this.resizeeventlistener)
    window.addEventListener('keydown', this.onKeyDown, false)

    if (
      this.state.bbwidth !== window.innerWidth ||
      this.state.bbheight !== window.innerHeight
    ) {
      const iwidth = window.innerWidth
      const iheight = window.innerHeight
      console.log('resize mount' /*, myself.bgtrick */, iheight / iwidth)
      this.props.updateSizes({ scrollheight: iheight / iwidth })
      this.setState({
        bbwidth: window.innerWidth,
        bbheight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1
      })
    }

    this.initNotepad()
    this.running = true
    // requestAnimationFrame(this.animate);
  }

  componentDidUpdate(prevProps, prevState) {
    this.addUpdateLocalStorage()
    if (this.props.notesmode !== prevProps.notesmode) {
      if (!this.props.notesmode && this.notesautosaver) {
        clearInterval(this.notesautosaver)
        delete this.notesautosaver
      }
    }

    if (this.props.notesmode) {
      if (this.props.notesmode && !this.notesautosaver) {
        this.notesautosaver = setInterval(() => {
          this.autosaveNotes()
        }, 10 * 1000)
      }
      if (this.props?.lectdetail !== this.lectdetail) {
        const lectdetail = this.props.lectdetail
        if (lectdetail && lectdetail.uuid) {
          const dbman = DBManager.getDBManager()
          const { title, coursetitle, instructors } = lectdetail
          this.localstorage.collection.clearContainers()
          dbman
            .addUpdateLecture(lectdetail.uuid, {
              uuid: lectdetail.uuid,
              title,
              coursetitle,
              instructors
            })
            .then(() => {
              this.loadNotesFromLocalStorage(lectdetail.uuid)
            })
            .catch((error) => {
              console.log('Problem db in componentDidUpdate', error)
            })
        }
        this.lectdetail = lectdetail
      } else {
        if (this.props.notesmode !== prevProps.notesmode) {
          if (this.storage?.collection?.commandcontainer?.getCurCommandState) {
            const cs =
              this.storage.collection.commandcontainer.getCurCommandState()
            this.setCommandState(cs)
          }
          if (this.blackboardnotes?.current)
            this.blackboardnotes?.current.doRedraw()
        }
      }
    }
  }

  initNotepad() {
    if (this.props.isnotepad) {
      this.isscreen = false
      // this.isalsoscreen = this.props.isalsoscreen;
      this.casttoscreens = false
      this.scrolloffset = 0

      // keyboard handling
      const mythis = this
      document.addEventListener('keydown', function (key) {
        mythis.onKeyDown(key)
      })
    } else {
      this.isscreen = true
      this.scrolloffset = 0
    }
    if (this.props.noteref) this.props.noteref(this)
  }

  setScrollOffset(scrolloffset) {
    this.scrolloffset = scrolloffset
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.setScrollOffset(scrolloffset)
    if (this.blackboardnotes && this.blackboardnotes.current)
      this.blackboardnotes.current.setScrollOffset(scrolloffset)
  }

  componentWillUnmount() {
    console.log('shutdown notepad')
    this.running = false
    //  this.stage.destroy();
    window.removeEventListener('resize', this.resizeeventlistener)
    window.removeEventListener('keydown', this.onKeyDown, false)
    this.resizeeventlistener = null
  }

  calcCurpos() {
    if (!this.props.isnotepad && this.blackboard && this.blackboard.current)
      return (
        (this.blackboard.current.calcCurpos() / this.state.bbheight) *
        this.state.bbwidth
      )
    return 0
  }

  setHasControl(hascntrl) {
    console.log('sethascontrol', hascntrl)
    console.log('tbc', this.blackboard.current)
    if (this.props.isnotepad && this.blackboard && this.blackboard.current)
      this.blackboard.current.setblocked(!hascntrl)
  }

  reactivateToolBox() {
    console.log('reactivate Toolbox NSB', this.blackboard)
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.reactivateToolBox()
  }

  selectWrist(pos) {
    if (this.props.isnotepad && this.blackboard && this.blackboard.current)
      this.blackboard.current.saveConfig('touchWristPos', pos)
  }

  arrangeButtonPressed() {
    this.props.arrangebuttoncallback()
  }

  pictButtonPressed() {
    this.props.pictbuttoncallback()
  }

  receivePictInfo(data) {
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.receivePictInfo(data)
  }

  receiveBgpdfInfo(data) {
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.receiveBgpdfInfo(data)
  }

  enterAddPictureMode(uuid, url, urlthumb) {
    if (this.blackboard && this.blackboard.current)
      this.blackboard.current.enterAddPictureMode(uuid, url, urlthumb)
  }

  onKeyDown(key) {
    if (!this.blackboard.current) return
    switch (key.keyCode) {
      case 0x28: // arrowdown
        if (this.blackboard.current.scrollboardKeys)
          this.blackboard.current.scrollboardKeys(0, 0.05)
        if (this.props.reportScroll) {
          this.props.reportScroll(0.05)
        }
        // if (this.blackboardnotes.current.scrollboardKeys)
        //   this.blackboardnotes.current.scrollboardKeys(0, 0.05)
        break
      case 0x26: // arrowUp
        if (this.blackboard.current.scrollboardKeys)
          this.blackboard.current.scrollboardKeys(0, -0.05)
        if (this.props.reportScroll) {
          this.props.reportScroll(-0.05)
        }
        // if (this.blackboardnotes.current.scrollboardKeys)
        //   this.blackboardnotes.current.scrollboardKeys(0, -0.05)
        break
      default:
        break
    }
  }

  getBlackboard() {
    if (this.blackboard) return this.blackboard.current
  }

  getEditBlackboard() {
    if (this.props.isnotepad) {
      if (this.blackboard) return this.blackboard.current
    } else if (this.props.notesmode) {
      if (this.blackboardnotes) return this.blackboardnotes.current
    }
  }

  getNoteTools() {
    if (this.props.isnotepad) {
      if (this.blackboard) return this.toolbox?.current
    } else if (this.props.notesmode) {
      if (this.blackboardnotes) return this.props.notetools?.current
    }
  }

  setCommandState(cs) {
    if (this.localstorage?.incomdispatcher) {
      if (cs.scrollx || cs.scrolly)
        this.localstorage.incomdispatcher.scrollBoard(
          cs.time,
          'data',
          cs.scrollx,
          cs.scrolly
        )

      this.localstorage.incomdispatcher.setTimeandScrollPos(
        cs.time,
        cs.scrollx,
        cs.scrolly
      )
    }
  }

  render() {
    // console.log("pageoffset",this.props.pageoffset*this.state.bbheight/this.state.bbwidth, this.props.pageoffset,this.state.bbheight,this.state.bbwidth )
    // console.log("screennumbercolor", this.props.screennumbercolor);
    // console.log("tsw",this.state.width,this.state.height,this.blackboard);
    return (
      <div
        style={{
          width: this.props.width,
          height: this.props.height,
          overflow: 'hidden',
          position: 'relative',
          display: this.props.hidden ? 'none' : null
        }}
      >
        {this.props.showscreennumber && (
          <span
            style={{
              position: 'absolute',
              top: '2vw',
              left: '4vw',
              fontSize: '10vw',
              zIndex: 50,
              textShadow: '2px 2px 8px ' + this.props.screennumbercolor,
              color: this.props.screennumbercolor
            }}
          >
            {' '}
            {this.props.screennumber + 1}{' '}
          </span>
        )}
        {!this.props.isnotepad ? (
          <Fragment>
            <Blackboard
              ref={this.blackboard}
              storage={this.storage}
              backcolor={this.props.backgroundcolor}
              backclass={this.props.backclass}
              bbchannel={this.props.bbchannel}
              notepadscreen={this}
              bbwidth={this.state.bbwidth}
              bbheight={this.state.bbheight}
              reportDrawPosCB={this.props.reportDrawPosCB}
              pageoffset={
                (this.props.pageoffset * this.state.bbheight) /
                this.state.bbwidth
              }
              pageoffsetabsolute={this.props.pageoffsetabsolute}
              drawActivityMonitor={this.props.drawActivityMonitor}
              reportScroll={!this.props.notesmode && this.props.reportScroll}
            ></Blackboard>
            {this.props.notesmode && (
              <BlackboardNotepad
                ref={this.blackboardnotes}
                storage={this.state.localstorage}
                outgoingsink={this.state.localstorage?.incomdispatcher}
                backcolor={this.props.backgroundcolor}
                backclass={''}
                notepadscreen={this}
                bbwidth={this.state.bbwidth}
                bbheight={this.state.bbheight}
                devicePixelRatio={this.state.devicePixelRatio}
                pageoffset={
                  (this.props.pageoffset * this.state.bbheight) /
                  this.state.bbwidth
                }
                pageoffsetabsolute={this.props.pageoffsetabsolute}
                notesmode={true}
                informDraw={this.props.informDraw}
                reportScroll={this.props.reportScroll}
              ></BlackboardNotepad>
            )}
          </Fragment>
        ) : (
          <BlackboardNotepad
            ref={this.blackboard}
            storage={this.storage}
            outgoingsink={this.outgodispatcher}
            backcolor={this.props.backgroundcolor}
            backclass={this.props.backclass}
            bbchannel={this.props.bbchannel}
            notepadscreen={this}
            bbwidth={this.state.bbwidth}
            bbheight={this.state.bbheight}
            reportDrawPosCB={this.props.reportDrawPosCB}
            devicePixelRatio={this.state.devicePixelRatio}
            informDraw={this.props.informDraw}
            drawActivityMonitor={this.props.drawActivityMonitor}
          ></BlackboardNotepad>
        )}
        {this.props.isnotepad && (
          <ToolBox
            ref={this.toolbox}
            bbwidth={this.state.bbwidth}
            bbheight={this.state.bbheight}
            devicePixelRatio={this.state.devicePixelRatio}
            notepad={this}
            startpoll={this.props.startpoll}
            updateSizes={this.props.updateSizes}
            toggleFullscreen={this.props.toggleFullscreen}
            mainstate={this.props.mainstate}
            dispres={this.dispres}
            identobj={this.props.identobj}
            experimental={this.props.experimental}
            features={this.props.features}
            startUpAVBroadcast={this.props.startUpAVBroadcast}
          />
        )}
        {this.props.isnotepad && (
          <UtilBox
            ref={this.confirmbox}
            bbwidth={this.state.bbwidth}
            bbheight={this.state.bbheight}
            notepad={this}
            utilbox={true}
            corner={'rightBottom'}
          />
        )}
        {this.props.isnotepad && (
          <UtilBox
            ref={this.originbox}
            bbwidth={this.state.bbwidth}
            bbheight={this.state.bbheight}
            notepad={this}
            corner={'leftTop'}
          />
        )}
        {(this.props.isnotepad || this.props.notesmode) && (
          <CopyDeleteBox
            ref={this.copydeletebox}
            bbwidth={this.state.bbwidth}
            bbheight={this.state.bbheight}
            notepad={this}
          />
        )}
      </div>
    )
  }
}
