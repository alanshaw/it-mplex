'use strict'

const Mplex = require('./mplex')
const MULTIPLEX_CODEC = require('./lib/codec')

module.exports = () => new Mplex()
module.exports.multicodec = MULTIPLEX_CODEC
