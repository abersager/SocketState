import { Env } from '../env'
import { merge } from 'ts-deepmerge'

import { socketAction, socketLoader } from '../app/routes/_index'
import type { SocketState } from '../app/routes/_index'

type Session = {
  webSocket: WebSocket
  quit?: boolean
}

export class Counter {
  state: DurableObjectState
  sessions: Session[]

  constructor(state: DurableObjectState, env: Env) {
    console.log('constructor')
    this.state = state
    this.sessions = []
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      let pair = new WebSocketPair()

      // We're going to take pair[1] as our end, and return pair[0] to the client.
      await this.handleSession(pair[1])

      // Now we return the other end of the pair to the client.
      console.log('returning')
      return new Response(null, { status: 101, webSocket: pair[0] })
    }

    let socketState = await this.state.storage.get('socketState')
    if (!socketState) {
      socketState = socketLoader()
      await this.state.storage.put('socketState', socketState)
    }

    return new Response(JSON.stringify(socketState), { status: 200 })
  }

  async handleSession(webSocket: WebSocket) {
    // Accept our end of the WebSocket. This tells the runtime that we'll be terminating the
    // WebSocket in JavaScript, not sending it elsewhere.
    webSocket.accept()
    // this.state.acceptWebSocket(webSocket)

    // Create our session and add it to the sessions list.
    // We don't send any messages to the client until it has sent us the initial user info
    // message. Until then, we will queue messages in `session.blockedMessages`.
    let session: Session = { webSocket }
    console.log('adding session')
    this.sessions.push(session)

    webSocket.addEventListener('message', async (message) => {
      try {
        if (session.quit) {
          // Whoops, when trying to send to this WebSocket in the past, it threw an exception and
          // we marked it broken. But somehow we got another message? I guess try sending a
          // close(), which might throw, in which case we'll try to send an error, which will also
          // throw, and whatever, at least we won't accept the message. (This probably can't
          // actually happen. This is defensive coding.)
          webSocket.close(1011, 'WebSocket broken.')
          return
        }

        if ((message.data as string) === 'ping') {
          return
        }

        let data = JSON.parse(message.data as string)
        const eventName = data.event
        if (!eventName) {
          throw `Unknown event ${data}`
        }

        const socketState = (await this.state.storage.get('socketState')) as SocketState

        const changes = socketAction(socketState, eventName, data.payload)

        await this.state.storage.put('socketState', merge(socketState, changes))
        this.broadcast(changes)

        // Save message.
        this.state.storage.put('lastMessage', data)
      } catch (error: any) {
        console.log(message.data)
        // Report any exceptions directly back to the client. As with our handleErrors() this
        // probably isn't what you'd want to do in production, but it's convenient when testing.
        webSocket.send(JSON.stringify({ error: error.stack }))
      }
    })

    // On "close" and "error" events, remove the WebSocket from the sessions list and broadcast
    // a quit message.
    let closeOrErrorHandler = (event: CloseEvent | ErrorEvent) => {
      console.log(event.type)
      console.log(event)
      session.quit = true
      const before = this.sessions.length
      this.sessions = this.sessions.filter((member) => member !== session)
      const after = this.sessions.length
      console.log(`removed session, ${before} -> ${after}`)
    }
    webSocket.addEventListener('close', closeOrErrorHandler)
    webSocket.addEventListener('error', closeOrErrorHandler)
  }

  broadcast(socketState: Partial<SocketState>) {
    const encodedMessage = JSON.stringify(socketState)

    // Iterate over all the sessions sending them messages.
    this.sessions = this.sessions.filter((session) => {
      try {
        session.webSocket.send(encodedMessage)
        return true
      } catch (err) {
        // Whoops, this connection is dead. Remove it from the list and arrange to notify
        // everyone below.
        session.quit = true
        return false
      }
    })
  }
}
