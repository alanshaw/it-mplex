/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const { expect } = chai
chai.use(dirtyChai)
const pipe = require('it-pipe')
const randomBytes = require('random-bytes')
const { tap, consume, collect } = require('streaming-iterables')

const restrictSize = require('../src/restrict-size')

describe('restrict-size', () => {
  it('should throw when size is too big', async () => {
    const input = [
      { data: await randomBytes(8) },
      { data: await randomBytes(64) },
      { data: await randomBytes(16) }
    ]

    const output = []

    try {
      await pipe(
        input,
        restrictSize(32),
        tap(chunk => output.push(chunk)),
        consume
      )
    } catch (err) {
      expect(err.code).to.equal('ERR_MSG_TOO_BIG')
      expect(output).to.have.length(1)
      expect(output[0]).to.deep.equal(input[0])
      return
    }
    throw new Error('did not restrict size')
  })

  it('should allow message with no data property', async () => {
    const output = await pipe(
      [{}],
      restrictSize(32),
      collect
    )
    expect(output).to.deep.equal([{}])
  })
})
