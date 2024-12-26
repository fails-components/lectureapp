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
