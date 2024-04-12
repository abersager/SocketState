import type { LoaderArgs, V2_MetaFunction } from '@remix-run/cloudflare'
import { useLoaderData, useMatches } from '@remix-run/react'
import { json } from 'react-router'
import useWebSocket from 'react-use-websocket'
import { useCallback, useEffect, useState } from 'react'
export { loader } from './socket'

export const meta: V2_MetaFunction = () => {
  return [{ title: 'New Remix App' }]
}

export type SocketState = {
  counter: number
  error?: unknown
}

export const socketLoader = (): SocketState => {
  return {
    counter: 0,
  }
}

export const socketAction = (socketState: SocketState, eventName: string, payload: unknown): Partial<SocketState> => {
  if (eventName === 'increase') {
    return { counter: socketState.counter + 1 }
  }
  if (eventName === 'decrease') {
    return { counter: socketState.counter - 1 }
  }
  console.error(`Unknown event ${eventName}`)
  return {}
}

type ResponseBody = { counter: number } | { error: unknown }

function hasError(response: ResponseBody): response is { error: unknown } {
  return (response as { error: unknown }).error != null
}

export const handle = (...args: any) => {
  console.log('handle')
  console.log(...args)
  return { handle: true }
}

export default function Index() {
  const matches = useMatches()
  console.log(matches)
  const loaderData = useLoaderData<typeof loader>() as string
  const [socketState, setSocketState] = useState<SocketState>(JSON.parse(loaderData))

  // sendMessage
  const { lastMessage, readyState, getWebSocket, sendJsonMessage } = useWebSocket('ws://localhost:8787/socket', {
    shouldReconnect: () => {
      return true
    },
    heartbeat: true,
    reconnectAttempts: 1000,
    reconnectInterval: (lastAttemptNumber: number) => {
      return Math.min(1000 * 2 ** lastAttemptNumber, 30000)
    },
  })

  useEffect(() => {
    if (!lastMessage) {
      return
    }
    const payload = JSON.parse(lastMessage.data as string)
    if (!payload) {
      console.warn('No payload', lastMessage)
      return
    }

    setSocketState(payload)
  }, [lastMessage])

  const handleClickIncrease = useCallback(() => sendJsonMessage({ event: 'increase' }), [])

  const handleClickDecrease = useCallback(() => sendJsonMessage({ event: 'decrease' }), [])

  if (hasError(socketState)) {
    console.error(socketState.error)
    return <h1>There has been an error :(</h1>
  }

  if (!socketState) {
    return <div>Loading…</div>
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.4' }}>
      <h1>Counter: {socketState.counter}</h1>
      <button onClick={handleClickIncrease}>Increase</button>
      <button onClick={handleClickDecrease}>Decrease</button>
      <div>Last message: {JSON.stringify(lastMessage, null, 2)}</div>
    </div>
  )
}
