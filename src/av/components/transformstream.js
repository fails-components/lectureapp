/*
    Fails Components (Fancy Automated Internet Lecture System - Components)
    Copyright (C)  2022- (FAILS Components)  Marten Richter <marten.richter@freenet.de>

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
export class AVTransformStream {
  // note actually a transform stream would be more suitable, but it is not available in firefox
  constructor(args) {
    this.write = this.write.bind(this)

    if (args && args.outputs) {
      this.outputs = args.outputs
      this.outputmain = args.outputmain
      this.multipleout = true
    } else {
      this.outputs = [1]
      this.outputmain = 1
      this.multipleout = false
    }

    this.startReadable = this.startReadable.bind(this)
    this.pullReadable = this.pullReadable.bind(this)
    this.newPendingWrit = this.newPendingWrit.bind(this)

    this.highWaterMarkReadable = args?.highWaterMarkReadable || 2
    this.highWaterMarkWritable = args?.highWaterMarkWritable || 2

    this.resetOutput()

    this.writable = new WritableStream(
      {
        start(controller) {},
        write: this.write,
        close(controller) {},
        abort(reason) {}
      },
      { highWaterMark: this.highWaterMarkWritable }
    )
  }

  setSkipframeCallback(callback) {
    this.informSkipframe = callback
  }

  resetInput() {
    if (this.pendigwrit) {
      const res = this.pendigwrit.resolve
      delete this.pendingwrit
      res(true) // means skip = true
    }
  }

  resetOutput() {
    if (this.multipleout) {
      const oldreadableController = this.readableController
      this.readable = {}
      this.readableController = {}
      for (const out of this.outputs) {
        this.readable[out] = new ReadableStream(
          {
            start: (controller) => this.startReadable(controller, out),
            pull: (controller) => this.pullReadable(controller, out)
          },
          { highWaterMark: this.highWaterMarkReadable }
        )
      }
      for (const out of this.outputs) {
        if (oldreadableController && oldreadableController[out]) {
          try {
            oldreadableController[out].close()
          } catch (error) {
            console.log('problem close resetOutput:', error)
          }
        }
      }
    } else {
      const oldreadableController = this.readableController
      this.readable = new ReadableStream(
        {
          start: this.startReadable,
          pull: this.pullReadable
        },
        { highWaterMark: this.highWaterMarkReadable }
      )
      if (oldreadableController)
        try {
          oldreadableController.close()
        } catch (error) {
          console.log('problem close resetOutput:', error)
        }
    }
  }

  async write(chunk) {
    // console.log('AVTransform write chunk', this.constructor.name, chunk)
    const finalchunk = await this.transform(chunk)

    if (!finalchunk) return

    let controller
    if (this.multipleout) controller = this.readableController[this.outputmain]
    else controller = this.readableController

    if ((controller && controller.desiredSize <= 0) || !controller) {
      // console.log('block output ')
      const readprom = new Promise(this.newPendingWrit)
      const skip = await readprom
      if (skip) return // we should skip, due to resetInput
    }
    if (!this.multipleout) {
      if (Array.isArray(finalchunk)) {
        finalchunk.forEach((el) => {
          this.readableController.enqueue(el)
        })
      } else {
        this.readableController.enqueue(finalchunk)
      }
    } else {
      for (const out of this.outputs) {
        const curchunk = finalchunk[out]
        if (
          this.readableController[out].desiredSize <= 0 &&
          out !== this.outputmain
        ) {
          // console.log('skip output ', out)
          if (this.informSkipframe) this.informSkipframe(out)
          continue
        }
        if (curchunk) {
          if (Array.isArray(curchunk)) {
            curchunk.forEach((el) => {
              this.readableController[out].enqueue(el)
            })
          } else {
            this.readableController[out].enqueue(curchunk)
          }
        }
      }
    }
  }

  enqueueChunk(chunk) {
    this.readableController.enqueue(chunk)
  }

  newPendingWrit(resolve, reject) {
    if (this.pendigwrit) throw new Error('No more then one pending writ')
    if (
      (this.readableController && this.readableController.desiredSize <= 0) ||
      !this.readableController
    ) {
      this.pendingwrit = { resolve, reject }
    } else resolve()
  }

  startReadable(controller, out) {
    if (typeof out === 'undefined') this.readableController = controller
    else this.readableController[out] = controller
  }

  pullReadable(controller, out) {
    if (controller.desiredSize <= 0) return

    if (this.pendingwrit && (!out || out === this.outputmain)) {
      this.pendingwrit.resolve()
      this.pendingwrit = null
    }
  }
}
