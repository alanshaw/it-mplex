const MAX_MSG_SIZE = 1 << 20 // 1MB

module.exports = (source, options) => {
  options = options || {}
  options.maxMsgSize = options.maxMsgSize || MAX_MSG_SIZE

  return (async function * restrictSize () {
    for await (const chunk of source) {
      if (chunk && chunk.length >= options.maxMsgSize) {
        throw Object.assign(new Error('message too large!'), { code: 'ERR_MSG_TOO_BIG' })
      }
      yield chunk
    }
  })()
}
