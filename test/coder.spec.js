/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const { expect } = chai
chai.use(dirtyChai)

const pull = require('pull-stream')

const coder = require('../src/lib/coder')

describe('coder', () => {
  it.skip('encodes header', () => {
    pull(
      pull.values([[17, 0, Buffer.from('17')]]),
      coder.encode(),
      pull.collect((err, data) => {
        expect(err).to.not.exist()
        expect(data[0]).to.be.eql(Buffer.from('880102', 'hex'))
      })
    )
  })

  it('decodes header', async () => {
    const source = [Buffer.from('8801023137', 'hex')]
    for await (const msg of coder.decode(source)) {
      msg.data = msg.data.slice() // convert BufferList to Buffer
      expect(msg).to.be.eql({ id: 17, type: 0, data: Buffer.from('17') })
    }
  })

  it.skip('encodes several msgs into buffer', () => {
    pull(
      pull.values([
        [17, 0, Buffer.from('17')],
        [19, 0, Buffer.from('19')],
        [21, 0, Buffer.from('21')]
      ]),
      coder.encode(),
      pull.collect((err, data) => {
        expect(err).to.not.exist()
        expect(Buffer.concat(data)).to.be.eql(Buffer.from('88010231379801023139a801023231', 'hex'))
      })
    )
  })

  it('decodes msgs from buffer', async () => {
    const source = [Buffer.from('88010231379801023139a801023231', 'hex')]

    const res = []
    for await (const msg of coder.decode(source)) {
      msg.data = msg.data.slice() // convert BufferList to Buffer
      res.push(msg)
    }

    expect(res).to.be.deep.eql([
      { id: 17, type: 0, data: Buffer.from('17') },
      { id: 19, type: 0, data: Buffer.from('19') },
      { id: 21, type: 0, data: Buffer.from('21') }
    ])
  })

  it.skip('encodes zero length body msg', () => {
    pull(
      pull.values([[17, 0]]),
      coder.encode(),
      pull.collect((err, data) => {
        expect(err).to.not.exist()
        expect(data[0]).to.be.eql(Buffer.from('880100', 'hex'))
      })
    )
  })

  it('decodes zero length body msg', async () => {
    const source = [Buffer.from('880100', 'hex')]

    for await (const msg of coder.decode(source)) {
      msg.data = msg.data.slice() // convert BufferList to Buffer
      expect(msg).to.be.eql({ id: 17, type: 0, data: Buffer.alloc(0) })
    }
  })
})
