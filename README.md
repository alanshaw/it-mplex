# it-mplex

> JavaScript implementation of [mplex](https://github.com/libp2p/specs/tree/master/mplex).

## Install

```sh
npm install it-mplex
```

## Usage

```js
const Mplex = require('it-mplex')
const pipe = require('it-pipe')

const muxer = new Mplex({
  onStream: stream => { // Receive a duplex stream from the remote
    // ...receive data from the remote and optionally send data back
  }
})

pipe(conn, muxer, conn) // conn is duplex connection to another peer

const stream = muxer.newStream() // Create a new duplex stream to the remote

// Use the duplex stream to send some data to the remote...
pipe([1, 2, 3], stream)
```

## API

### `const muxer = new Mplex([options])`

Create a new _duplex_ stream that can be piped together with a connection in order to allow multiplexed communications.

e.g.

```js
const Mplex = require('it-mplex')
const pipe = require('it-pipe')

// Create a duplex muxer
const muxer = new Mplex()

// Use the muxer in a pipeline
pipe(conn, muxer, conn) // conn is duplex connection to another peer
```

`options` is an optional `Object` that may have the following properties:

* `onStream` - A function called when receiving a new stream from the remote. e.g.
    ```js
    // Receive a new stream on the muxed connection
    const onStream = stream => {
      // Read from this stream and write back to it (echo server)
      pipe(
        stream,
        source => (async function * () {
          for await (const data of source) yield data
        })()
        stream
      )
    }
    const muxer = new Mplex({ onStream })
    // ...
    ```
    **Note:** The `onStream` function can be passed in place of the `options` object. i.e.
    ```js
    new Mplex(stream => { /* ... */ })
    ```
* `signal` - An [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) which can be used to abort the muxer, _including_ all of it's multiplexed connections. e.g.
    ```js
    const controller = new AbortController()
    const muxer = new Mplex({ signal: controller.signal })

    pipe(conn, muxer, conn)

    controller.abort()
    ```
* `maxMsgSize` - The maximum size in bytes the data field of multiplexed messages may contain (default 1MB)

### `muxer.onStream`

Use this property as an alternative to passing `onStream` as an option to the `Mplex` constructor.

### `const stream = muxer.newStream([options])`

Initiate a new stream with the remote. Returns a [duplex stream](https://gist.github.com/alanshaw/591dc7dd54e4f99338a347ef568d6ee9#duplex-it).

e.g.

```js
// Create a new stream on the muxed connection
const stream = muxer.newStream()

// Use this new stream like any other duplex stream:
pipe([1, 2, 3], stream, consume)
```

In addition to `sink` and `source` properties, this stream also has the following API, that will normally _not_ be used by stream consumers.

#### `stream.close()`

Closes the stream for **reading**. If iterating over the source of this stream in a `for await of` loop, it will return (exit the loop) after any buffered data has been consumed.

This function is called automatically by the muxer when it receives a `CLOSE` message from the remote.

The source will return normally, the sink will continue to consume.

#### `stream.abort([err])`

Closes the stream for **reading** _and_ **writing**. This should be called when a _local error_ has occurred.

Note, if called without an error any buffered data in the source can still be consumed and the stream will end normally.

This will cause a `RESET` message to be sent to the remote, _unless_ the sink has already ended.

The sink will return and the source will throw if an error is passed or return normally if not.

#### `stream.reset()`

Closes the stream _immediately_ for **reading** _and_ **writing**. This should be called when a _remote error_ has occurred.

This function is called automatically by the muxer when it receives a `RESET` message from the remote.

The sink will return and the source will throw.
