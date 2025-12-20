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
import React from 'react'
import katex from 'katex'

export function detectLatex(string) {
  if (typeof string !== 'string') return false
  return string.indexOf('$') !== -1
}

export function convertToLatex(string) {
  const retarray = []
  let secstart = 0
  let seclatex = false
  for (let curpos = 0; curpos < string.length; curpos++) {
    const curchar = string.charAt(curpos)
    if (curchar === '$') {
      if (seclatex) {
        const html = katex.renderToString(string.substring(secstart, curpos), {
          throwOnError: false,
          displayMode: false
        })
        retarray.push(
          <span
            key={'latex-' + retarray.length}
            dangerouslySetInnerHTML={{ __html: html }}
          ></span>
        )
        secstart = curpos + 1
        seclatex = false
      } else {
        retarray.push(
          <React.Fragment key={'latex-' + retarray.length}>
            {string.substring(secstart, curpos - 1)}{' '}
          </React.Fragment>
        )
        secstart = curpos + 1
        seclatex = true
      }
    }
  }

  retarray.push(
    <React.Fragment key={'latex-' + retarray.length}>
      {string.substring(secstart, string.length)}{' '}
    </React.Fragment>
  )

  return retarray
}

export function maybeUseLatex(item) {
  return detectLatex(item) ? convertToLatex(item) : item
}
