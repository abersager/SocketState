import type { V2_MetaFunction } from '@remix-run/cloudflare'
import { useCallback } from 'react'

import useSocketState from '../hooks/use-socket-state'
import type { SocketState, MessageEvent } from './socket'
export { loader } from './socket'

export const meta: V2_MetaFunction = () => {
  return [{ title: 'SocketState demo' }]
}

type ResponseBody = { counter: number } | { error: unknown }

function hasError(response: ResponseBody): response is { error: unknown } {
  return (response as { error: unknown }).error != null
}

export default function Index() {
  const [socketState, sendMessage] = useSocketState<SocketState, MessageEvent>('ws://localhost:8787/socket')

  const handleClickIncrease = useCallback(() => sendMessage({ name: 'increase' }), [sendMessage])

  const handleClickDecrease = useCallback(() => sendMessage({ name: 'decrease', amount: 4 }), [sendMessage])

  if (hasError(socketState)) {
    console.error(socketState.error)
    return <h1>There has been an error</h1>
  }

  if (!socketState) {
    return <div>Loading…</div>
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.4' }}>
      <h1>Counter: {socketState.counter}</h1>
      <button onClick={handleClickIncrease}>Increase</button>
      <button onClick={handleClickDecrease}>Decrease</button>
    </div>
  )
}
