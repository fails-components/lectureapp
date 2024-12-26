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
import React, { Component } from 'react'

export class ColorPickerButton extends Component {
  constructor(props) {
    super(props)

    this.onClick = this.onClick.bind(this)
  }

  onClick() {
    this.props.toolbox.selectColor(
      this.props.pickerid,
      this.props.color,
      this.props.mysize
    )
  }

  render() {
    let addclass = ' '
    if (this.props.addclass) addclass += this.props.addclass
    const selbuttonclass = (cond, add) =>
      cond
        ? (add || '') +
          'p-button-primary p-button-raised p-button-rounded tbChild' +
          addclass
        : 'p-button-secondary p-button-raised p-button-rounded tbChild' +
          addclass

    if (!this.props.strokecolor) {
      if (this.props.alpha > 0)
        return (
          <Button
            icon={
              <svg viewBox='-20 -20 40 40' width='100%' height='100%'>
                {this.props.size < 15 && (
                  <circle
                    cx='0'
                    cy='0'
                    r={15}
                    stroke='#001A00'
                    strokeWidth='0'
                    fill='#001A00'
                  />
                )}
                <circle
                  cx='0'
                  cy='0'
                  r={this.props.size * this.props.sizefac}
                  stroke='#001A00'
                  strokeWidth='0'
                  fill={this.props.color}
                  fillOpacity={this.props.alpha}
                />
              </svg>
            }
            key={2}
            onClick={this.onClick}
            className={selbuttonclass(this.props.selected)}
          />
        )
      else
        return (
          <Button
            icon={
              <svg viewBox='-20 -20 40 40' width='100%' height='100%'>
                <line
                  x1='-10'
                  y1='-10'
                  x2='10'
                  y2='10'
                  stroke='#fff'
                  strokeWidth='3'
                />
                <line
                  x1='-10'
                  y1='10'
                  x2='10'
                  y2='-10'
                  stroke='#fff'
                  strokeWidth='3'
                />
              </svg>
            }
            key={4}
            onClick={this.onClick}
            className={selbuttonclass(this.props.selected)}
          />
        )
    } else
      return (
        <Button
          icon={
            <svg viewBox='-20 -20 40 40' width='100%' height='100%'>
              <rect
                x='-10'
                y='-10'
                width='20'
                height='20'
                stroke={this.props.strokecolor}
                strokeWidth='1'
                fill={this.props.color}
                fillOpacity={this.props.alpha}
              />
            </svg>
          }
          key={4}
          onClick={this.onClick}
          className={selbuttonclass(this.props.selected)}
        />
      )
  }
}
