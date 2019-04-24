const MAX_MSG_SIZE = 1 << 20 // 1MB

module.exports = max => {
  max = max || MAX_MSG_SIZE

  return source => {
    return (async function * restrictSize () {
      for await (const chunk of source) {
        if (chunk && chunk.length >= max) {
          throw Object.assign(new Error('message size too large!'), { code: 'ERR_MSG_TOO_BIG' })
        }
        yield chunk
      }
    })()
  }
}
