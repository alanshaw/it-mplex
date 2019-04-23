'use strict'

const Mplex = require('./mplex')
const MULTIPLEX_CODEC = require('./codec')

module.exports = () => new Mplex()
module.exports.multicodec = MULTIPLEX_CODEC
