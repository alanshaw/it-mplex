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
