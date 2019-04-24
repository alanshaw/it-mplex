const pipe = require('it-pipe')
const pushable = require('it-pushable')
const log = require('debug')('it-mplex:mplex')
const Coder = require('./lib/coder')
const restrictSize = require('./lib/restrict-size')
const Types = require('./lib/message-types')

class Mplex {
  constructor (options) {
    options = options || {}
    options = typeof options === 'function' ? { onStream: options } : options

    this._streamId = 0
    this._streams = { initiators: new Map(), receivers: new Map() }

    this.sink = this._createSink()
    this.source = this._createSource()

    this._options = options
  }

  // Initiate a new stream with the given name
  newStream (name) {
    const id = this._streamId++
    name = name == null ? id.toString() : String(name)

    const stream = {
      sink: async source => {
        this.source.push({ id, type: Types.NEW_STREAM, data: name })

        try {
          for await (const data of source) {
            this.source.push({ id, type: Types.MESSAGE_INITIATOR, data })
          }
        } catch (err) {
          log('error in stream %s', id, err)
          this.source.push({ id, type: Types.RESET_INITIATOR })
          this._streams.initiators.delete(id)
          return
        }

        this.source.push({ id, type: Types.CLOSE_INITIATOR })
        this._streams.initiators.delete(id)
      },
      source: pushable()
    }

    this._streams.initiators.set(id, stream)

    return stream
  }

  _newReceiverStream (id, name) {
    if (this._streams.receivers.has(id)) {
      throw new Error(`stream ${id} already exists!`)
    }

    const stream = {
      sink: async source => {
        try {
          for await (const data of source) {
            this.source.push({ id, type: Types.MESSAGE_RECEIVER, data })
          }
        } catch (err) {
          log('error in stream %s', id, err)
          this.source.push({ id, type: Types.RESET_RECEIVER })
          this._streams.receivers.delete(id)
          return
        }

        this.source.push({ id, type: Types.CLOSE_RECEIVER })
        this._streams.receivers.delete(id)
      },
      source: pushable()
    }

    this._streams.receivers.set(id, stream)

    return stream
  }

  _createSink () {
    return async source => {
      try {
        await pipe(
          restrictSize(this._options.maxMsgSize),
          Coder.decode,
          async source => {
            for await (const msg of source) {
              this._handleIncoming(msg)
            }
          }
        )
      } catch (err) {
        log(err)
        this.source.end(err) // TODO: is this right?
      }
    }
  }

  _createSource () {
    const source = pushable()
    const encodedSource = pipe(source, Coder.encode)
    encodedSource.push = source.push
    encodedSource.end = source.end
    return encodedSource
  }

  _handleIncoming (msg) {
    log('incoming message', msg)
    const { id, type, data } = msg

    // Create a new stream?
    if (type === Types.NEW_STREAM && this._options.onStream) {
      const stream = this._newReceiverStream(id, data.toString())
      return this._options.onStream(stream)
    }

    const list = type & 1 ? this._streams.initiators : this._streams.receivers
    const stream = list.get(id)

    if (!stream) return log('missing stream %s', id)

    switch (type) {
      // Push the data into the channel with the matching id if it exists
      case Types.MESSAGE_INITIATOR:
      case Types.MESSAGE_RECEIVER:
        stream.source.push(data)
        break
      // Close the channel with the matching id
      case Types.CLOSE_INITIATOR:
      case Types.CLOSE_RECEIVER:
        stream.source.end()
        break
      // Destroys the channel with the matching id
      case Types.RESET_INITIATOR:
      case Types.RESET_RECEIVER:
        stream.source.end()
        break
      default:
        log('unknown message type %s', type)
    }
  }
}

module.exports = Mplex
