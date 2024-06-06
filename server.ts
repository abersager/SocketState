import * as build from '@remix-run/dev/server-build'
import type { Env } from './env'
import { createEventHandler } from './serverEventer'

export { SocketStateDurableObject } from './do/socket-state-durable-object'

export default {
  fetch: createEventHandler({
    build,
    mode: process.env.NODE_ENV,
    getLoadContext: function (request, env: Env, ctx) {
      return {
        ...env,
      }
    },
  }),
}
