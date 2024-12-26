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
import Dexie from 'dexie'

export class DBManager {
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
