# it-mplex

```js
const mplex = require('it-mplex')
const pipe = require('it-pipe')

// Create a duplex muxer
const mc = mplex()

// Use the muxer in a pipeline
pipe(conn, mc, conn) // conn is a interface-libp2p-connection

// Create a new stream on the muxed connection
const stream = mc.newStream()

// Use this new stream like so:
pipe([1, 2, 3], stream, consume)
```

How does the other end create a stream?

```js
// Receive a new stream on the muxed connection
const onStream = stream => {
  // Read from this stream and write back to it (echo server)
  pipe(
    stream,
    source => {
      return (async function * () {
        for await (const data of source) {
          yield data
        }
      })()
    }
    stream
  )
}
const mc = mplex(onStream)
```

Abort the muxer and abort all the muxed streams:

```js
const controller = new AbortController()
const mc = mplex({ signal: abortController.signal, onStream })

pipe(conn, mc, conn)

controller.abort()
```
