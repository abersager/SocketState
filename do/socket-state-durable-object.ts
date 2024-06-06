import type { Env } from '../env'
import { merge } from 'ts-deepmerge'

import { initSocketState, reducer } from '../app/routes/socket'
import type { SocketState, MessageEvent } from '../app/routes/socket'

type Session = {
  webSocket: WebSocket
  quit?: boolean
}

type Message = {
  data: string
}

export class SocketStateDurableObject {
  state: DurableObjectState
  sessions: Session[]

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.sessions = []
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      return await this.initWebSocket()
    }

    let socketState = await this.state.storage.get('socketState')

    if (!socketState) {
      socketState = initSocketState()
      await this.state.storage.put('socketState', socketState)
    }

    return new Response(JSON.stringify(socketState), { status: 200 })
  }

  async initWebSocket() {
    let pair = new WebSocketPair()

    // We're going to take pair[1] as our end, and return pair[0] to the client.
    await this.handleSession(pair[1])

    // Now we return the other end of the pair to the client.
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  async handleSession(webSocket: WebSocket) {
    // Accept our end of the WebSocket. This tells the runtime that we'll be terminating the
    // WebSocket in JavaScript, not sending it elsewhere.
    ;(webSocket as any).accept()

    // Create our session and add it to the sessions list.
    // We don't send any messages to the client until it has sent us the initial user info
    // message. Until then, we will queue messages in `session.blockedMessages`.
    let session: Session = { webSocket }
    console.debug('adding session')
    this.sessions.push(session)

    webSocket.addEventListener('message', async (message) => {
      try {
        if (session.quit) {
          console.warn('closing broken session')
          webSocket.close(1011, 'WebSocket broken.')
          return
        }

        // Handle the message
        return this.handleMessage(message)
      } catch (error: any) {
        console.error(message.data)
        webSocket.send(JSON.stringify({ error: error.stack }))
      }
    })

    // On "close" and "error" events, remove the WebSocket from the sessions
    // list and broadcast a quit message
    let closeOrErrorHandler = (event: Event) => {
      console.debug(event)
      session.quit = true
      const before = this.sessions.length
      this.sessions = this.sessions.filter((member) => member !== session)
      const after = this.sessions.length
      console.debug(`removed session, ${before} -> ${after}`)
    }
    webSocket.addEventListener('close', closeOrErrorHandler)
    webSocket.addEventListener('error', closeOrErrorHandler)
  }

  async handleMessage(message: Message) {
    if ((message.data as string) === 'ping') {
      // Keep-alive from useWebSocket, ignore
      return
    }

    // Get current state
    const socketState = (await this.state.storage.get('socketState')) as SocketState

    // Parse incoming message
    const event: MessageEvent = JSON.parse(message.data)

    // Derive new state
    const changes = reducer(socketState, event)

    if (changes) {
      // Store new state
      await this.state.storage.put('socketState', merge(socketState, changes))

      // Broadcast changes
      this.broadcast(changes)
    } else {
      console.warn(`Unknown event ${event}`)
    }

    // Save message.
    this.state.storage.put('lastEvent', event)
  }

  broadcast(socketState: Partial<SocketState>) {
    const encodedMessage = JSON.stringify(socketState)
    console.debug(
      `broadcasting ${encodedMessage} to ${this.sessions.length} session${this.sessions.length === 1 ? '' : 's'}`,
    )

    // Broadcast message to all sessions
    this.sessions = this.sessions.filter((session) => {
      try {
        session.webSocket.send(encodedMessage)
        return true
      } catch (err) {
        // Whoops, this connection is dead. Remove it from the list and arrange
        // to notify everyone below.
        session.quit = true
        return false
      }
    })
  }
}
