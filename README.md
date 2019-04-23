# v2

```js
const mplex = require('mplex-it')
const pipe = require('it-pipe')

// Create a duplex muxer
const mc = mplex()

// Use the muxer in a pipeline
pipe(conn, mc, conn) // conn is a interface-libp2p-connection

// Create a new stream on the muxed connection
const stream = await mc.newStream()

// Use this new stream like so:
pipe([1, 2, 3], stream, consume)

// Receive a new stream on the muxed connection
const onStream = stream => { /* ... */ }

mc.on('stream', onStream)

// Also...can be passed to mplex as optional param
// const mc = mplex(onStream)

// later, close the connection:
await conn.close()
```

# v1

```js
const mplex = require('mplex-it')

// Create a muxed connection
const mc = mplex(conn) // conn is a interface-libp2p-connection

//. Create a new stream on the muxed connection
const stream = await mc.newStream()

// Receive a new stream on the muxed connection
const onStream = stream => { /* ... */ }

mc.on('stream', onStream)

// Also...can be passed to mplex as second param
// const mc = mplex(conn, onStream)

// Close the connection
await mc.close()
```
