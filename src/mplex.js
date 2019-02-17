const restrictSize =

module.exports = (source, options) => {
  options = options || {}

  source = restrictSize(source, { maxMsgSize: options.maxMsgSize })

  // TODO: how to start flowing?
  for await (const chunk of source) {

  }

  const mplex = {
    [Symbol.asyncIterator] () {
      return mplex
    }

    next () {

    }

    return () {

    }
  }

  return mplex
}
