'use strict';

const fs = require('fs');
const path = require('path');

/**
 * A tiny JSON-file-backed store for bookings. Good enough for ~7 users
 * making a handful of bookings a day - avoids any native DB dependency so
 * `npm install` works reliably on any laptop OS.
 *
 * Writes are serialised through an in-process promise chain so concurrent
 * requests can't interleave and corrupt the file.
 */
class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this._writeChain = Promise.resolve();
    this._ensureFile();
  }

  _ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify({ bookings: [] }, null, 2));
    }
  }

  readAll() {
    const raw = fs.readFileSync(this.filePath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.bookings) ? data.bookings : [];
  }

  _writeAll(bookings) {
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify({ bookings }, null, 2));
    fs.renameSync(tmpPath, this.filePath);
  }

  /**
   * Runs `mutator(currentBookings) -> newBookings` exclusively with respect
   * to other calls on this store instance, then persists the result.
   */
  mutate(mutator) {
    this._writeChain = this._writeChain.then(() => {
      const current = this.readAll();
      const next = mutator(current);
      this._writeAll(next);
      return next;
    });
    return this._writeChain;
  }
}

module.exports = { Store };
