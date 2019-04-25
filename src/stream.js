'use strict'

const abortable = require('abortable-iterator')
const AbortController = require('abort-controller')
const log = require('debug')('it-mplex:stream')
const pushable = require('it-pushable')
const { InitiatorMessageTypes, ReceiverMessageTypes } = require('./message-types')

module.exports = ({ id, name, send, onEnd, type = 'initiator' }) => {
  const abortController = new AbortController()
  const resetController = new AbortController()
  const Types = type === 'initiator' ? InitiatorMessageTypes : ReceiverMessageTypes

  let sourceEnded = false
  let sinkEnded = false
  let endErr

  const onSourceEnd = err => {
    sourceEnded = true
    if (err) endErr = err
    if (sinkEnded) onEnd(endErr)
  }

  const onSinkEnd = err => {
    sinkEnded = true
    if (err) endErr = err
    if (sourceEnded) onEnd(endErr)
  }

  const stream = {
    close: () => stream.source.end(), // Close for reading
    abort: err => { // Close for reading and writing (local error)
      abortController.abort()
      stream.source.end(err)
    },
    reset: () => { // Close immediately for reading and writing (remote error)
      resetController.abort()
      stream.source.end(new Error('stream reset'))
    },
    sink: async source => {
      source = abortable(source, abortController.signal)
      source = abortable(source, resetController.signal, { abortCode: 'ERR_REMOTE_RESET' })

      if (type === 'initiator') { // If initiator, open a new stream
        send({ id, type: Types.NEW_STREAM, data: name })
      }

      try {
        for await (const data of source) {
          send({ id, type: Types.MESSAGE, data })
        }
      } catch (err) {
        // Send no more data if this stream was remotely reset
        if (err.code === 'ERR_REMOTE_RESET') {
          log(`%s stream %s reset`, type, name || id)
        } else {
          log('%s stream %s error', type, name || id, err)
          send({ id, type: Types.RESET })
        }
        return onSinkEnd(err)
      }

      send({ id, type: Types.CLOSE })
      onSinkEnd()
    },
    source: pushable(onSourceEnd)
  }

  return stream
}
