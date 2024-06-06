import type { LoaderArgs } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'

export type SocketState = {
  counter: number
  error?: unknown
}

export type MessageEvent = IncreaseEvent | DecreaseEvent

type IncreaseEvent = {
  name: 'increase'
}

type DecreaseEvent = {
  name: 'decrease'
  amount: number
}

export function initSocketState(): SocketState {
  return {
    counter: 0,
  }
}

export async function loader(args: LoaderArgs) {
  const durableObject = args.context.SOCKET_STATE_DURABLE_OBJECT as DurableObjectNamespace
  try {
    const durableObjectId = durableObject.idFromName('foo')
    return await durableObject.get(durableObjectId).fetch(args.request)
  } catch (err) {
    return json({ error: err })
  }
}

export function reducer(socketState: SocketState, event: MessageEvent): Partial<SocketState> {
  if (event.name === 'increase') {
    return { counter: socketState.counter + 1 }
  }

  if (event.name === 'decrease') {
    return { counter: socketState.counter - (event.amount || 1) }
  }
}
