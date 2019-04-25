const Mplex = require('.')
const AbortController = require('abort-controller')
const pull = require('pull-stream/pull')
const toPull = require('async-iterator-to-pull-stream')
const { Connection } = require('interface-connection')
const EE = require('events')
const noop = () => {}

function create (conn, isListener) {
  const abortController = new AbortController()
  const adapterMuxer = Object.assign(new EE(), {
    newStream (cb) {
      cb = cb || noop
      const stream = muxer.newStream()
      const conn = new Connection(toPull.duplex(stream))
      cb(null, conn)
      return conn
    },
    end (err, cb) {
      if (typeof err === 'function') {
        cb = err
        err = null
      }
      cb = cb || noop
      abortController.abort()
      cb()
    }
  })

  const muxer = new Mplex({
    signal: abortController.signal,
    onStream: stream => {
      adapterMuxer.emit('stream', new Connection(toPull.duplex(stream)))
    }
  })

  pull(conn, toPull.duplex(muxer), conn)

  return adapterMuxer
}

module.exports = create
module.exports.multicodec = Mplex.multicodec
module.exports.dialer = conn => create(conn, false)
module.exports.listener = conn => create(conn, true)
