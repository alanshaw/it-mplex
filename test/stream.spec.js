/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const { expect } = chai
chai.use(dirtyChai)
const pipe = require('it-pipe')
const randomBytes = require('random-bytes')
const randomInt = require('random-int')
const { tap, take, collect, consume } = require('streaming-iterables')
const defer = require('p-defer')

const createStream = require('../src/stream')
const { MessageTypes, MessageTypeNames } = require('../src/message-types')

function randomInput (min = 1, max = 100) {
  return Promise.all(
    Array.from(Array(randomInt(min, max)), () => randomBytes(randomInt(1, 128)))
  )
}

function expectMsgType (actual, expected) {
  expect(MessageTypeNames[actual]).to.equal(MessageTypeNames[expected])
}

const infiniteRandom = {
  [Symbol.asyncIterator]: async function * () {
    while (true) yield randomBytes(randomInt(1, 128))
  }
}

describe('stream', () => {
  it('should initiate stream with NEW_STREAM message', async () => {
    const msgs = []
    const mockSend = msg => msgs.push(msg)
    const id = randomInt(1000)
    const stream = createStream({ id, send: mockSend })
    const input = await randomInput()

    await pipe(input, stream)

    expect(msgs[0].id).to.equal(id)
    expectMsgType(msgs[0].type, MessageTypes.NEW_STREAM)
    expect(msgs[0].data).to.deep.equal(id.toString())
  })

  it('should initiate named stream with NEW_STREAM message', async () => {
    const msgs = []
    const mockSend = msg => msgs.push(msg)
    const id = randomInt(1000)
    const name = `STREAM${Date.now()}`
    const stream = createStream({ id, name, send: mockSend })
    const input = await randomInput()

    await pipe(input, stream)

    expect(msgs[0].id).to.equal(id)
    expectMsgType(msgs[0].type, MessageTypes.NEW_STREAM)
    expect(msgs[0].data).to.deep.equal(name)
  })

  it('should send data with MESSAGE_INITIATOR messages if stream initiator', async () => {
    const msgs = []
    const mockSend = msg => msgs.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const stream = createStream({ id, name, send: mockSend, type: 'initiator' })
    const input = await randomInput()

    await pipe(input, stream)

    // First and last should be NEW_STREAM and CLOSE
    const dataMsgs = msgs.slice(1, -1)
    expect(dataMsgs).have.length(input.length)

    dataMsgs.forEach((msg, i) => {
      expect(msg.id).to.equal(id)
      expectMsgType(msg.type, MessageTypes.MESSAGE_INITIATOR)
      expect(msg.data).to.deep.equal(input[i])
    })
  })

  it('should send data with MESSAGE_RECEIVER messages if stream receiver', async () => {
    const msgs = []
    const mockSend = msg => msgs.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const stream = createStream({ id, name, send: mockSend, type: 'receiver' })
    const input = await randomInput()

    await pipe(input, stream)

    // Last should be CLOSE
    const dataMsgs = msgs.slice(0, -1)
    expect(dataMsgs).have.length(input.length)

    dataMsgs.forEach((msg, i) => {
      expect(msg.id).to.equal(id)
      expectMsgType(msg.type, MessageTypes.MESSAGE_RECEIVER)
      expect(msg.data).to.deep.equal(input[i])
    })
  })

  it('should close stream with CLOSE_INITIATOR message if stream initiator', async () => {
    const msgs = []
    const mockSend = msg => msgs.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const stream = createStream({ id, name, send: mockSend, type: 'initiator' })
    const input = await randomInput()

    await pipe(input, stream)

    const closeMsg = msgs[msgs.length - 1]

    expect(closeMsg.id).to.equal(id)
    expectMsgType(closeMsg.type, MessageTypes.CLOSE_INITIATOR)
    expect(closeMsg.data).to.not.exist()
  })

  it('should close stream with CLOSE_RECEIVER message if stream receiver', async () => {
    const msgs = []
    const mockSend = msg => msgs.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const stream = createStream({ id, name, send: mockSend, type: 'receiver' })
    const input = await randomInput()

    await pipe(input, stream)

    const closeMsg = msgs[msgs.length - 1]

    expect(closeMsg.id).to.equal(id)
    expectMsgType(closeMsg.type, MessageTypes.CLOSE_RECEIVER)
    expect(closeMsg.data).to.not.exist()
  })

  it('should reset stream on error with RESET_INITIATOR message if stream initiator', async () => {
    const msgs = []
    const mockSend = msg => msgs.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const stream = createStream({ id, name, send: mockSend, type: 'initiator' })
    const error = new Error(`Boom ${Date.now()}`)
    const input = {
      [Symbol.asyncIterator]: async function * () {
        for (let i = 0; i < randomInt(1, 10); i++) {
          yield randomBytes(randomInt(1, 128))
        }
        throw error
      }
    }

    await pipe(input, stream)

    const resetMsg = msgs[msgs.length - 1]

    expect(resetMsg.id).to.equal(id)
    expectMsgType(resetMsg.type, MessageTypes.RESET_INITIATOR)
    expect(resetMsg.data).to.not.exist()
  })

  it('should reset stream on error with RESET_RECEIVER message if stream receiver', async () => {
    const msgs = []
    const mockSend = msg => msgs.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const stream = createStream({ id, name, send: mockSend, type: 'receiver' })
    const error = new Error(`Boom ${Date.now()}`)
    const input = {
      [Symbol.asyncIterator]: async function * () {
        for (let i = 0; i < randomInt(1, 10); i++) {
          yield randomBytes(randomInt(1, 128))
        }
        throw error
      }
    }

    await pipe(input, stream)

    const resetMsg = msgs[msgs.length - 1]

    expect(resetMsg.id).to.equal(id)
    expectMsgType(resetMsg.type, MessageTypes.RESET_RECEIVER)
    expect(resetMsg.data).to.not.exist()
  })

  it('should close for reading (remote close)', async () => {
    const mockInitiatorSend = msg => receiver.source.push(msg)
    const mockReceiverSend = msg => initiator.source.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const initiator = createStream({ id, name, send: mockInitiatorSend, type: 'initiator' })
    const receiver = createStream({ id, name, send: mockReceiverSend, type: 'receiver' })

    // echo back (on the other side this will be { type: MESSAGE, data: msg })
    pipe(
      receiver,
      tap(msg => {
        // when the initiator sends a CLOSE message, we call close
        if (msg.type === MessageTypes.CLOSE_INITIATOR) {
          receiver.close()
        }
      }),
      receiver
    )

    const input = await randomInput()
    const msgs = await pipe(
      input,
      initiator,
      tap(msg => {
        // when the receiver sends a CLOSE message, we call close
        if (msg.type === MessageTypes.CLOSE_RECEIVER) {
          initiator.close()
        }
      }),
      collect
    )

    // NEW_STREAM should have been echoed back to us
    expectMsgType(msgs[0].type, MessageTypes.MESSAGE_RECEIVER)
    expectMsgType(msgs[0].data.type, MessageTypes.NEW_STREAM)

    // check the receiver echoed back all our data messages
    expect(msgs.slice(1, -2).length).to.equal(input.length)

    msgs.slice(1, -2).forEach((msg, i) => {
      expectMsgType(msg.data.type, MessageTypes.MESSAGE_INITIATOR)
      expect(msg.data.data).to.deep.equal(input[i])
    })

    // ...and echoed back the close message
    expectMsgType(msgs[msgs.length - 2].type, MessageTypes.MESSAGE_RECEIVER)
    expectMsgType(msgs[msgs.length - 2].data.type, MessageTypes.CLOSE_INITIATOR)

    // ...and finally sent a close message
    const closeMsg = msgs[msgs.length - 1]

    expectMsgType(closeMsg.type, MessageTypes.CLOSE_RECEIVER)
    expect(closeMsg.data).to.not.exist()
  })

  it('should close for reading and writing (abort on local error)', async () => {
    const mockInitiatorSend = msg => receiver.source.push(msg)
    const mockReceiverSend = msg => initiator.source.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const initiator = createStream({ id, name, send: mockInitiatorSend, type: 'initiator' })
    const receiver = createStream({ id, name, send: mockReceiverSend, type: 'receiver' })

    // echo back (on the other side this will be { type: MESSAGE, data: msg })
    pipe(
      receiver,
      tap(msg => {
        // when the initiator sends a RESET message, we call reset
        if (msg.type === MessageTypes.RESET_INITIATOR) {
          receiver.reset()
        }
      }),
      receiver
    )

    const input = infiniteRandom
    const error = new Error(`Boom ${Date.now()}`)
    const maxMsgs = randomInt(1, 10)
    const generatedMsgs = []
    const msgs = []

    try {
      let i = 0

      await pipe(
        input,
        tap(msg => generatedMsgs.push(msg)),
        tap(msg => { if (i++ >= maxMsgs) initiator.abort(error) }),
        initiator,
        tap(msg => msgs.push(msg)),
        consume
      )
    } catch (err) {
      expect(err.message).to.equal(error.message)

      // NEW_STREAM should have been echoed back to us
      expectMsgType(msgs[0].type, MessageTypes.MESSAGE_RECEIVER)
      expectMsgType(msgs[0].data.type, MessageTypes.NEW_STREAM)

      expect(msgs).to.have.length(generatedMsgs.length)

      // check the receiver echoed back all our data messages, and nothing else
      msgs.slice(1).forEach((msg, i) => {
        expectMsgType(msg.data.type, MessageTypes.MESSAGE_INITIATOR)
        expect(msg.data.data).to.deep.equal(generatedMsgs[i])
      })
    }
  })

  it('should close for reading and writing (abort on remote error)', async () => {
    const mockInitiatorSend = msg => receiver.source.push(msg)
    const mockReceiverSend = msg => initiator.source.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const initiator = createStream({ id, name, send: mockInitiatorSend, type: 'initiator' })
    const receiver = createStream({ id, name, send: mockReceiverSend, type: 'receiver' })

    const error = new Error(`Boom ${Date.now()}`)
    const maxMsgs = randomInt(1, 10)
    let i = 0

    // echo back (on the other side this will be { type: MESSAGE, data: msg })
    pipe(
      receiver,
      tap(msg => { if (i++ >= maxMsgs) receiver.abort(error) }),
      receiver
    )

    const input = infiniteRandom
    const generatedMsgs = []
    const msgs = []

    try {
      await pipe(
        input,
        tap(msg => generatedMsgs.push(msg)),
        initiator,
        tap(msg => msgs.push(msg)),
        tap(msg => {
          // when the receiver sends a RESET message, we call reset
          if (msg.type === MessageTypes.RESET_RECEIVER) {
            initiator.reset()
          }
        }),
        consume
      )
    } catch (err) {
      expect(err.message).to.equal('stream reset')

      // NEW_STREAM should have been echoed back to us
      expectMsgType(msgs[0].type, MessageTypes.MESSAGE_RECEIVER)
      expectMsgType(msgs[0].data.type, MessageTypes.NEW_STREAM)

      // because the receiver errored we might not have received all our data messages
      expect(msgs.length - 2).to.be.lte(generatedMsgs.length)

      // check the receiver echoed back some/all our data messages
      msgs.slice(1, -1).forEach((msg, i) => {
        expectMsgType(msg.data.type, MessageTypes.MESSAGE_INITIATOR)
        expect(msg.data.data).to.deep.equal(generatedMsgs[i])
      })

      // ...and finally a RESET message
      expectMsgType(msgs[msgs.length - 1].type, MessageTypes.RESET_RECEIVER)
    }
  })

  it('should close immediately for reading and writing (reset on local error)', async () => {
    const mockInitiatorSend = msg => receiver.source.push(msg)
    const mockReceiverSend = msg => initiator.source.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const initiator = createStream({ id, name, send: mockInitiatorSend, type: 'initiator' })
    const receiver = createStream({ id, name, send: mockReceiverSend, type: 'receiver' })

    // echo back (on the other side this will be { type: MESSAGE, data: msg })
    pipe(
      receiver,
      tap(msg => {
        // when the initiator sends a RESET message, we call reset
        if (msg.type === MessageTypes.RESET_INITIATOR) {
          receiver.reset()
        }
      }),
      receiver
    )

    const input = infiniteRandom
    const error = new Error(`Boom ${Date.now()}`)
    const maxMsgs = randomInt(1, 10)
    const generatedMsgs = []
    const msgs = []

    try {
      let i = 0

      await pipe(
        input,
        tap(msg => generatedMsgs.push(msg)),
        tap(msg => { if (i++ >= maxMsgs) throw error }),
        initiator,
        tap(msg => msgs.push(msg)),
        consume
      )
    } catch (err) {
      expect(err.message).to.equal(error.message)

      // NEW_STREAM should have been echoed back to us
      expectMsgType(msgs[0].type, MessageTypes.MESSAGE_RECEIVER)
      expectMsgType(msgs[0].data.type, MessageTypes.NEW_STREAM)

      // because we errored locally we might not receive all the echo messages
      // from the receiver before our source stream is ended
      expect(msgs.length - 1).to.be.lte(generatedMsgs.length)

      // check the receiver echoed back some/all our data messages, and nothing else
      msgs.slice(1).forEach((msg, i) => {
        expectMsgType(msg.data.type, MessageTypes.MESSAGE_INITIATOR)
        expect(msg.data.data).to.deep.equal(generatedMsgs[i])
      })
    }
  })

  it('should close immediately for reading and writing (reset on remote error)', async () => {
    const mockInitiatorSend = msg => receiver.source.push(msg)
    const mockReceiverSend = msg => initiator.source.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const initiator = createStream({ id, name, send: mockInitiatorSend, type: 'initiator' })
    const receiver = createStream({ id, name, send: mockReceiverSend, type: 'receiver' })

    const error = new Error(`Boom ${Date.now()}`)
    const maxMsgs = randomInt(1, 10)
    let i = 0

    // echo back (on the other side this will be { type: MESSAGE, data: msg })
    pipe(
      receiver,
      tap(msg => { if (i++ >= maxMsgs) throw error }),
      receiver
    )

    const input = infiniteRandom
    const generatedMsgs = []
    const msgs = []

    try {
      await pipe(
        input,
        tap(msg => generatedMsgs.push(msg)),
        initiator,
        tap(msg => msgs.push(msg)),
        tap(msg => {
          // when the receiver sends a RESET message, we call reset
          if (msg.type === MessageTypes.RESET_RECEIVER) {
            initiator.reset()
          }
        }),
        consume
      )
    } catch (err) {
      expect(err.message).to.equal('stream reset')

      // NEW_STREAM should have been echoed back to us
      expectMsgType(msgs[0].type, MessageTypes.MESSAGE_RECEIVER)
      expectMsgType(msgs[0].data.type, MessageTypes.NEW_STREAM)

      // because we errored locally we might not receive all the echo messages
      // from the receiver before our source stream is ended
      expect(msgs.length - 2).to.be.lte(generatedMsgs.length)

      // check the receiver echoed back some/all our data messages
      msgs.slice(1, -1).forEach((msg, i) => {
        expectMsgType(msg.data.type, MessageTypes.MESSAGE_INITIATOR)
        expect(msg.data.data).to.deep.equal(generatedMsgs[i])
      })

      // ...and finally a RESET message
      expectMsgType(msgs[msgs.length - 1].type, MessageTypes.RESET_RECEIVER)
    }
  })

  it('should call onEnd only when both sides have closed', async () => {
    const send = msg => stream.source.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const deferred = defer()
    const onEnd = err => err ? deferred.reject(err) : deferred.resolve()
    const stream = createStream({ id, name, send, onEnd })
    const input = await randomInput()

    pipe(input, stream, take(randomInt(1, input.length)), consume)
    await deferred.promise
  })

  it('should call onEnd with error for local error', async () => {
    const send = msg => stream.source.push(msg)
    const id = randomInt(1000)
    const name = id.toString()
    const deferred = defer()
    const onEnd = err => err ? deferred.reject(err) : deferred.resolve()
    const stream = createStream({ id, name, send, onEnd })

    const error = new Error(`Boom ${Date.now()}`)
    const maxMsgs = randomInt(1, 10)
    let i = 0

    pipe(infiniteRandom, tap(msg => { if (i++ >= maxMsgs) throw error }), stream)

    try {
      await deferred.promise
    } catch (err) {
      return expect(err.message).to.equal(error.message)
    }
    throw new Error('did not call onEnd with error')
  })
})
