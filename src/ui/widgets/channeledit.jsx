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
import { Button } from 'primereact/button'
import { Menu } from 'primereact/menu'
import React, { Component } from 'react'
import {
  fiMoveToTop,
  fiAddNotepad,
  fiAddScreen,
  fiScreenNumberOn,
  fiScreenNumberOff
} from '../icons/icons'

export class ChannelEdit extends Component {
  constructor(props) {
    super(props)
    this.availscreensmenu = React.createRef()
    this.availscreensmenuScreenshare = React.createRef()
  }

  render() {
    // ok this is easy, we get two properties availscreens for selection, and channelinfo for the channels
    const availscreensitems = [
      {
        label: 'Move/add to top',
        items: this.props.availscreens.map((el, ind) => {
          let purpose = 'Unknown'
          if (el.purpose === 'notepad') purpose = 'Notepad'
          else if (el.purpose === 'screen') purpose = 'Screen'
          console.log('channel uuid', el.channel, el.uuid)
          return {
            label: ind + 1 + '. ' + purpose,
            purpose,
            command: () =>
              this.props.app.addNotescreenToChannel(this.selchannel, el.uuid)
          }
        })
      }
    ]
    const availscreensitemsScreenshare = [
      {
        label: 'Move/add to top',
        items: availscreensitems[0].items.filter(
          (el) => el.purpose !== 'Notepad'
        )
      }
    ]

    if (!this.props.channelinfo)
      return <React.Fragment>Waiting for data...</React.Fragment>
    const channels = this.props.channelinfo
      .filter(
        (el) =>
          el.type !== 'screenshare' ||
          this.props.availscreenchannels[el.channeluuid]
      )
      .map((el, ind) => {
        let type = 'Unknown'
        if (el.type === 'notebooks') type = 'Room'
        if (el.type === 'screenshare') type = 'Screencast'
        const notescreens = el.notescreens.map((el2) => {
          const index = this.props.availscreens.findIndex(
            (el3) => el3.uuid === el2.uuid
          )
          let purpose = 'Unknown'
          if (el2.purpose === 'notepad') purpose = 'Notepad'
          else if (el2.purpose === 'screen') purpose = 'Screen'

          return (
            <div className='p-m-2 p-shadow-1 p-p-2' key={el2.uuid}>
              {' '}
              {index + 1 + '. ' + purpose}{' '}
            </div>
          )
        })
        console.log('notescreen', el)
        console.log('avail screens', this.props.availscreens)
        notescreens.reverse()

        return (
          <div className='p-mr-2 p-shadow-1'>
            <div className='p-d-flex p-flex-column p-jc-center'>
              <div className='p-m-2 p-p-1' key='haeding'>
                <h3>
                  {ind + 1 + '. ' + type}
                  {ind !== 0 &&
                    el.notescreens.length === 0 &&
                    el.type !== 'screenshare' && (
                      <Button
                        icon='pi pi-trash'
                        className='p-button-rounded p-button-text p-button-sm'
                        onClick={() =>
                          this.props.app.onRemoveChannel(el.channeluuid)
                        }
                      ></Button>
                    )}
                </h3>
              </div>
              <div className='p-m-2 p-p-2' key='header'>
                <div className='p-d-flex'>
                  <div className='p-mr-2'>
                    <Button
                      icon={fiMoveToTop}
                      label={'Move to top'}
                      className='p-button-rounded p-button-text p-button-sm'
                      onClick={(event) => {
                        this.selchannel = el.channeluuid
                        this.availscreensmenu.current.hide(event)
                        this.availscreensmenuScreenshare.current.hide(event)
                        if (el.type !== 'screenshare') {
                          this.availscreensmenu.current.show(event)
                        } else {
                          this.availscreensmenuScreenshare.current.show(event)
                        }
                      }}
                      aria-controls='availscreen_menu'
                      aria-haspopup
                    ></Button>
                  </div>
                </div>
              </div>
              {notescreens}
            </div>
          </div>
        )
      })

    channels.push(
      <div className='p-mr-2 p-shadow-1' key='newwriting'>
        <div
          className='p-d-flex p-flex-column p-jc-center p-ai-center'
          style={{ height: '100%' }}
        >
          <div className='p-mr-2'>
            <Button
              icon='pi pi-plus'
              className='p-button-rounded p-button-text p-button-sm'
              iconPos='right'
              onClick={(event) => {
                this.props.app.onNewWriting()
              }}
            ></Button>
          </div>
        </div>
      </div>
    )

    return (
      <div className='p-d-flex p-flex-column'>
        <div className='p-mb-2' key='channels'>
          <div className='p-d-flex'>
            <Menu
              model={availscreensitems}
              popup
              baseZIndex={3000}
              ref={this.availscreensmenu}
              id='availscreen_menu'
            />
            <Menu
              model={availscreensitemsScreenshare}
              popup
              baseZIndex={3000}
              ref={this.availscreensmenuScreenshare}
              id='availscreen_menu'
            />
            {channels}
          </div>
        </div>
        <div className='p-mb-2' key='buttons'>
          <div className='p-d-flex'>
            <div className='p-mr-2' key='newnotepad'>
              <Button
                label='Notepad'
                icon={fiAddNotepad}
                className='p-button-rounded p-button-text p-button-sm'
                onClick={() => {
                  this.props.app.onOpenNewNotepad()
                }}
              ></Button>
            </div>
            <div className='p-mr-2' key='newscreen'>
              <Button
                label='Screen'
                icon={fiAddScreen}
                className='p-button-rounded p-button-text p-button-sm'
                onClick={(event) => {
                  this.props.app.onOpenNewScreen(event)
                }}
              ></Button>
            </div>
            <div className='p-mr-2 p-ml-auto' key='showscreen'>
              <Button
                label='Numbers'
                icon={
                  this.props.app.state.showscreennumber
                    ? fiScreenNumberOn
                    : fiScreenNumberOff
                }
                className='p-button-rounded p-button-text p-button-sm'
                onClick={() => {
                  this.props.app.updateSizes({
                    showscreennumber: !this.props.app.state.showscreennumber
                  })
                }}
              ></Button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
