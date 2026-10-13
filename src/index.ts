import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'http-probe'
export const inject = ['tools']

/** Timeout for a single probe request. Probes are diagnostics; hanging forever helps nobody. */
const PROBE_TIMEOUT_MS = 10_000

/**
 * Registers the `http_probe` tool: fetches a URL and reports status, latency,
 * and selected response headers. Redirects are followed; bodies are not read.
 *
 * @param ctx - plugin context with `tools` ready (declared via `inject`)
 */
export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'http_probe',
    description: 'Probe an HTTP(S) endpoint and report status code, latency and key response headers. Use for quick health checks of APIs and websites. Cancels unread response bodies after receiving headers.',
    parameters: {
      url: { type: 'string', required: true, description: 'Absolute http(s) URL to probe' },
      method: { type: 'string', description: 'HTTP method to use; defaults to HEAD, retried once as GET when HEAD is rejected with 405 or not implemented with 501' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      const url = new URL(args.url)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`http_probe only supports http(s) URLs, got: ${url.protocol}`)
      }
      const method = (args.method ?? 'HEAD').toUpperCase()

      const probe = async (m: string) => {
        const start = performance.now()
        const response = await fetch(url, {
          method: m,
          redirect: 'follow',
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        })
        const latencyMs = Math.round(performance.now() - start)
        // GET responses may stream indefinitely. Release the body without
        // consuming it; a body failure must not discard the received headers.
        if (response.body) {
          await response.body.cancel().catch(() => {})
        }
        return { response, latencyMs, method: m }
      }

      let result = await probe(method)
      if (method === 'HEAD' && [405, 501].includes(result.response.status)) {
        result = await probe('GET')
      }

      const { response, latencyMs } = result
      const headers = ['content-type', 'server', 'cache-control', 'location']
        .map((h) => [h, response.headers.get(h)] as const)
        .filter(([, v]) => v !== null)
        .map(([h, v]) => `${h}: ${v}`)

      return [
        `${result.method} ${response.url}`,
        `status: ${response.status} ${response.statusText}`,
        `latency: ${latencyMs}ms`,
        ...headers,
      ].join('\n')
    },
  }))
}
