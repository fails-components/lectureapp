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
import {
  faEraser,
  faHighlighter,
  faPen,
  faUndoAlt
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from 'primereact/button'
import { fiMagicwand } from '../icons/icons'
import { ToolHandling } from './toolhandling'

export class NoteTools extends ToolHandling {
  constructor(args) {
    super(args)
    this.state = {}
    this.setStateDefaults(this.state)
    this.state.devicePixelRatio = window.devicePixelRatio || 1.0
  }

  blackboard() {
    if (!this.props.getnotepad) return
    const notepad = this.props.getnotepad()
    if (!notepad) return

    if (!notepad.blackboardnotes) return
    return notepad.blackboardnotes.current
  }

  componentDidMount() {
    this.setDefaults()
    // select defaults after mount
    this.resizeeventlistener = (event) => {
      const iwidth = window.innerWidth
      const iheight = window.innerHeight

      this.props.updateSizes({ scrollheight: iheight / iwidth })
      this.setState({
        bbwidth: iwidth,
        bbheight: iheight,
        devicePixelRatio: window.devicePixelRatio || 1
      })
    }

    window.addEventListener('resize', this.resizeeventlistener)

    if (
      this.state.bbwidth !== window.innerWidth ||
      this.state.bbheight !== window.innerHeight
    ) {
      this.setState({
        bbwidth: window.innerWidth,
        bbheight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1
      })
    }
  }

  render() {
    const ttopts = {
      className: 'teal-tooltip',
      position: 'top',
      showDelay: 1000
    }

    if (!this.state.cantooltip) ttopts.disable = true

    const setclass =
      'p-button-secondary p-button-raised p-button-rounded ' +
      this.props.addclass

    const selbuttonclass = (cond, add) =>
      cond
        ? (add || '') +
          'p-button-raised p-button-rounded ' +
          this.props.addclass
        : 'p-button-secondary p-button-raised p-button-rounded ' +
          this.props.addclass

    const magicbutton = (
      <Button
        icon={fiMagicwand}
        tooltip='Select magically'
        tooltipOptions={ttopts}
        key={8}
        onClick={(e) => this.selectTool(8)}
        className={selbuttonclass(this.state.selectedButtonid === 8)}
      />
    )

    const eraserbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faEraser} />}
        tooltip='Erase'
        tooltipOptions={ttopts}
        key={3}
        onClick={(e) => this.selectTool(3)}
        className={selbuttonclass(this.state.selectedButtonid === 3)}
      />
    )

    const markerbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faHighlighter} />}
        tooltip='Use marker'
        tooltipOptions={ttopts}
        key={4}
        onClick={(e) => {
          this.selectTool(4)
        }}
        className={selbuttonclass(this.state.selectedButtonid === 4)}
      />
    )

    const penbutton = (
      <Button
        icon={<FontAwesomeIcon icon={faPen} />}
        tooltip='Use pen, click twice for pen sizes'
        tooltipOptions={ttopts}
        key={5}
        onClick={(e) => {
          this.selectTool(5)
        }}
        className={selbuttonclass(this.state.selectedButtonid === 5)}
      />
    )
    const undobutton = (
      <Button
        icon={<FontAwesomeIcon icon={faUndoAlt} />}
        tooltip='Undo last command'
        tooltipOptions={ttopts}
        key={9}
        onClick={this.undo}
        className={setclass}
      />
    )

    const maintools = []
    maintools.push(penbutton)
    maintools.push(markerbutton)
    maintools.push(eraserbutton)
    maintools.push(magicbutton)
    if (this.state.canundo) maintools.push(undobutton)

    const { colorwheel, pensizewheel, tmcolorwheel } = this.getColorButtons({
      addclass: this.props.addclass
    })

    if (this.state.selectedButtonid === 5) {
      if (this.state.secondtoolstep === 1) {
        maintools.push(<div key='colorwheel'>{colorwheel} </div>)
      } else if (this.state.secondtoolstep === 2) {
        maintools.push(<div key='pensizewheel'>{pensizewheel} </div>)
      }
    }
    if (this.state.selectedButtonid === 4) {
      if (this.state.secondtoolstep === 1) {
        maintools.push(<div key='tmcolorwheel'>{tmcolorwheel} </div>)
      }
    }

    return maintools
  }
}
