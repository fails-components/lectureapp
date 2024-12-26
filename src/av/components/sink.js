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
export class AVSink {
  constructor(args) {
    this.write = this.write.bind(this)
    this.closeWritable = this.closeWritable.bind(this)

    this.highWaterMarkWritable = args?.highWaterMarkWritable || 2

    this.writable = new WritableStream(
      {
        start(controller) {},
        write: this.write,
        close: this.closeWritable,
        abort(reason) {}
      },
      { highWaterMark: this.highWaterMarkWritable }
    )
  }

  async closeWritable(controller) {
    if (this.close) await this.close()
  }

  async write(chunk) {
    if (!chunk) return
    await this.process(chunk)
  }
}
