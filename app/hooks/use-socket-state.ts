import { useLoaderData } from '@remix-run/react'
import useWebSocket from 'react-use-websocket'
import { useEffect, useState } from 'react'

export default function useSocketState<StateT, MessageT>(url: string): [StateT, (message: MessageT) => void] {
  const loaderData = useLoaderData() as string
  const [socketState, setSocketState] = useState<StateT>(JSON.parse(loaderData))

  const { lastMessage, sendJsonMessage } = useWebSocket(url, {
    shouldReconnect: () => {
      return true
    },
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

  return [socketState, sendJsonMessage]
}
