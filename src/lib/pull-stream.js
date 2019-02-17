const toPull = require('async-iterator-to-pull-stream')

exports.toPull = {
  through (factory, ...args) {
    return function (read) {
      const source = (async function * () {
        const readNext = () => new Promise((resolve, reject) => {
          read()
        })
      })()

      //return a readable function!
      return function (end, cb) {
        read(end, function (end, data) {
          cb(end, data != null ? map(data) : null)
        })
      }
    }
  }
}
