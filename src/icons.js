import React from 'react'

import addNotepadIcon from './icons/addnotepad.svg'
import addScreenIcon from './icons/addscreen.svg'
import arrangeScreensIcon from './icons/arrangescreens.svg'
import eyeOffIcon from './icons/eyeoff.svg'
import eyeOnIcon from './icons/eyeon.svg'
import laserpointerIcon from './icons/laserpointer.svg'
import magicwandIcon from './icons/magicwand.svg'
import moveToTopIcon from './icons/movetotop.svg'
import palmAreaDetectionIcon from './icons/palmareadetection.svg'
import penBlocksTouchIcon from './icons/penblockstouch.svg'
import pollIcon from './icons/poll.svg'
import screenNumberOffIcon from './icons/screennumberoff.svg'
import screenNumberOnIcon from './icons/screennumberon.svg'
import wristBottomLeftIcon from './icons/wristbottomleft.svg'
import wristBottomRightIcon from './icons/wristbottomright.svg'
import wristMiddleLeftIcon from './icons/wristmiddleleft.svg'
import wristMiddleRightIcon from './icons/wristmiddleright.svg'
import wristPalmRejectionIcon from './icons/wristpalmrejection.svg'
import wristTopLeftIcon from './icons/wristtopleft.svg'
import wristTopRightIcon from './icons/wristtopright.svg'

function iconMaker(importObj, alttext, size) {
  const msize = size || '40px'
  return () => (
    <React.Fragment>
      <img
        src={importObj}
        className='fiIcons'
        width={msize}
        height={msize}
        alt={alttext}
      />
    </React.Fragment>
  )
}

export const fiAddNotepad = iconMaker(addNotepadIcon, 'add notepad')
export const fiAddScreen = iconMaker(addScreenIcon, 'add screen')
export const fiArrangeScreens = iconMaker(arrangeScreensIcon, 'arrange screens')
export const fiEyeOff = iconMaker(eyeOffIcon, 'not visible')
export const fiEyeOn = iconMaker(eyeOnIcon, 'visible')
export const fiLaserpointer = iconMaker(
  laserpointerIcon,
  'laserpointer',
  '30 px'
)
export const fiMagicwand = iconMaker(magicwandIcon, 'magic wand', '30px')
export const fiMoveToTop = iconMaker(moveToTopIcon, 'move to top')
export const fiPalmAreaDetection = iconMaker(
  palmAreaDetectionIcon,
  'palm area detection',
  '30 px'
)
export const fiPenBlocksTouch = iconMaker(
  penBlocksTouchIcon,
  'pen blocks touch',
  '30px'
)
export const fiPoll = iconMaker(pollIcon, 'poll', '35 px')
export const fiScreenNumberOff = iconMaker(
  screenNumberOffIcon,
  'screen number off',
  '35 px'
)
export const fiScreenNumberOn = iconMaker(
  screenNumberOnIcon,
  'screen number on',
  '35 px'
)
export const fiWristBottomLeft = iconMaker(
  wristBottomLeftIcon,
  'wrist bottom left'
)
export const fiWristBottomRight = iconMaker(
  wristBottomRightIcon,
  'wrist bottom right'
)
export const fiWristMiddleLeft = iconMaker(
  wristMiddleLeftIcon,
  'wrist middle left'
)
export const fiWristMiddleRight = iconMaker(
  wristMiddleRightIcon,
  'wrist middle right'
)
export const fiWristPalmRejection = iconMaker(
  wristPalmRejectionIcon,
  'wrist palm rejection'
)
export const fiWristTopLeft = iconMaker(wristTopLeftIcon, 'wrist top left')
export const fiWristTopRight = iconMaker(wristTopRightIcon, 'wrist top right')
