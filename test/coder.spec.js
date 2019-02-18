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
  it('encodes header', async () => {
    const source = [{ id: 17, type: 0, data: Buffer.from('17') }]

    let data = Buffer.alloc(0)
    for await (const chunk of coder.encode(source)) {
      data = Buffer.concat([data, chunk])
    }

    const expectedHeader = Buffer.from('880102', 'hex')
    expect(data.slice(0, expectedHeader.length)).to.be.eql(expectedHeader)
  })

  it('decodes header', async () => {
    const source = [Buffer.from('8801023137', 'hex')]
    for await (const msg of coder.decode(source)) {
      msg.data = msg.data.slice() // convert BufferList to Buffer
      expect(msg).to.be.eql({ id: 17, type: 0, data: Buffer.from('17') })
    }
  })

  it('encodes several msgs into buffer', async () => {
    const source = [
      { id: 17, type: 0, data: Buffer.from('17') },
      { id: 19, type: 0, data: Buffer.from('19') },
      { id: 21, type: 0, data: Buffer.from('21') }
    ]

    let data = Buffer.alloc(0)
    for await (const chunk of coder.encode(source)) {
      data = Buffer.concat([data, chunk])
    }

    expect(data).to.be.eql(Buffer.from('88010231379801023139a801023231', 'hex'))
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

  it('encodes zero length body msg', async () => {
    const source = [{ id: 17, type: 0 }]

    let data = Buffer.alloc(0)
    for await (const chunk of coder.encode(source)) {
      data = Buffer.concat([data, chunk])
    }

    expect(data).to.be.eql(Buffer.from('880100', 'hex'))
  })

  it('decodes zero length body msg', async () => {
    const source = [Buffer.from('880100', 'hex')]

    for await (const msg of coder.decode(source)) {
      msg.data = msg.data.slice() // convert BufferList to Buffer
      expect(msg).to.be.eql({ id: 17, type: 0, data: Buffer.alloc(0) })
    }
  })
})
