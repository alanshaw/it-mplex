const EE = require('events')
const { tap } = require('streaming-iterables')
const pipe = require('it-pipe')
const Coder = require('./lib/coder')

const Types = {
  NEW: 0,
  IN_MESSAGE: 1,
  OUT_MESSAGE: 2,
  IN_CLOSE: 3,
  OUT_CLOSE: 4,
  IN_RESET: 5,
  OUT_RESET: 6
}

const MAX_MSG_SIZE = 1 << 20 // 1MB

class Mplex extends EE {
  constructor (options) {
    super()
    options = options || {}

    if (typeof options === 'function') {
      options = { onStream: options }
    }

    if (options.onStream) {
      this.on('stream', options.onStream)
    }

    this._options = options
  }

  newStream () {

  }

  get sink () {
    return async source => {
      await pipe(
        tap(data => {
          // ensure data is within our max size requirement
          if (data && (data.length >= this._options.maxMsgSize || MAX_MSG_SIZE)) {
            throw new Error('message size too large!')
          }
        }),
        Coder.decode,
        async source => {
          for await (const msg of source) {
            this._onMessage(msg)
          }
        }
      )
    }
  }

  get source () {
    return pipe(
      {
        [Symbol.asyncIterator] () {
          return this
        },
        async next () {
          // WTF HOW TO DO?
        }
      },
      Coder.encode
    )
  }

  _onMessage (msg) {
    this._log('_onMessage', msg)
    const { id, type, data } = msg
    switch (type) {
      // Create a new stream
      case Types.NEW: {
        const chan = this._newStream(id, false, true, data.toString(), this._inChannels)
        nextTick(emitStream, this, chan, id)
        break
      }

      // Push the data into the channel with the matching id if it exists
      case Types.OUT_MESSAGE:
      case Types.IN_MESSAGE: {
        const list = type & 1 ? this._outChannels : this._inChannels
        const chan = list[id]
        if (chan) {
          chan.push(data)
        }
        break
      }

      // Close the channel with the matching id
      case Types.OUT_CLOSE:
      case Types.IN_CLOSE: {
        const list = type & 1 ? this._outChannels : this._inChannels
        const chan = list[id]
        if (chan) {
          chan.close()
        }
        break
      }

      // Destroys the channel with the matching id
      case Types.OUT_RESET:
      case Types.IN_RESET: {
        const list = type & 1 ? this._outChannels : this._inChannels
        const chan = list[id]
        if (chan) {
          chan.destroy()
        }
        break
      }

      default:
        nextTick(emitError, this, new Error('Invalid message type'))
    }
  }
}

module.exports = Mplex
