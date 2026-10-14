import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { apply } from '../lib/index.js'

function registeredTool() {
  let tool
  apply({ tools: { register(value) { tool = value } } })
  assert.equal(tool.name, 'http_probe')
  return tool
}

async function serve(t, handler) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })
  return `http://127.0.0.1:${server.address().port}`
}

for (const [method, headStatus] of [[undefined, 405], [undefined, 501], ['GET', 405]]) {
  test(`${method ?? `HEAD ${headStatus} fallback`} releases a streaming GET response after reporting headers`, async (t) => {
    const requests = []
    let resolveClosed
    const closed = new Promise((resolve) => { resolveClosed = resolve })
    const base = await serve(t, (request, response) => {
      requests.push(request.method)
      if (request.method === 'HEAD') {
        response.writeHead(headStatus)
        response.end()
        return
      }
      response.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' })
      response.write('a body the probe should not consume\n')
      const interval = setInterval(() => response.write('more body\n'), 25)
      response.on('close', () => {
        clearInterval(interval)
        resolveClosed(true)
      })
    })

    const args = method ? { url: `${base}/stream`, method } : { url: `${base}/stream` }
    const result = await registeredTool().execute(args)
    assert.match(result, /^GET http:\/\/127\.0\.0\.1:/)
    assert.match(result, /status: 200 OK/)
    assert.match(result, /content-type: text\/plain/)
    assert.match(result, /cache-control: no-store/)
    assert.deepEqual(requests, method ? ['GET'] : ['HEAD', 'GET'])
    assert.equal(await Promise.race([closed, delay(2000, false)]), true,
      'the streaming response remains open after the probe has returned')
  })
}

test('default HEAD keeps status and headers without a GET retry', async (t) => {
  const requests = []
  const base = await serve(t, (request, response) => {
    requests.push(request.method)
    response.writeHead(204, { server: 'probe-test' })
    response.end()
  })
  const result = await registeredTool().execute({ url: `${base}/health` })
  assert.match(result, /^HEAD /)
  assert.match(result, /status: 204 No Content/)
  assert.match(result, /server: probe-test/)
  assert.deepEqual(requests, ['HEAD'])
})

for (const status of [405, 501]) {
  test(`explicit GET reports a ${status} without retrying`, async (t) => {
    const requests = []
    const base = await serve(t, (request, response) => {
      requests.push(request.method)
      response.writeHead(status)
      response.end('method not allowed')
    })
    const result = await registeredTool().execute({ url: base, method: 'get' })
    assert.match(result, /^GET /)
    assert.match(result, new RegExp(`status: ${status} `))
    assert.deepEqual(requests, ['GET'])
  })
}

test('redirects report the final URL', async (t) => {
  const base = await serve(t, (request, response) => {
    if (request.url === '/redirect') {
      response.writeHead(302, { location: '/health' })
    } else {
      response.writeHead(200)
    }
    response.end()
  })
  const result = await registeredTool().execute({ url: `${base}/redirect` })
  assert.equal(result.split('\n')[0], `HEAD ${base}/health`)
  assert.match(result, /status: 200 OK/)
})

test('non-HTTP URLs are rejected', async () => {
  await assert.rejects(registeredTool().execute({ url: 'file:///tmp/probe' }), /only supports http\(s\)/)
})

test('an already errored body does not discard the received status and headers', async (t) => {
  const body = new ReadableStream({ start(controller) { controller.error(new Error('body terminated')) } })
  const response = new Response(body, { status: 503, headers: { server: 'probe-test' } })
  t.mock.method(globalThis, 'fetch', async () => response)
  const result = await registeredTool().execute({ url: 'http://example.test', method: 'GET' })
  assert.match(result, /status: 503/)
  assert.match(result, /server: probe-test/)
})


test('cloned streaming response reports headers without waiting for another reader', async (t) => {
  const base = await serve(t, (_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain', server: 'cloned-stream-test' })
    response.write('streaming body\n')
    const interval = setInterval(() => response.write('more body\n'), 25)
    response.on('close', () => clearInterval(interval))
  })
  const nativeFetch = globalThis.fetch
  let otherReader
  t.mock.method(globalThis, 'fetch', async (...args) => {
    otherReader = await nativeFetch(...args)
    return otherReader.clone()
  })
  t.after(async () => { await otherReader?.body?.cancel().catch(() => {}) })

  const result = await Promise.race([
    registeredTool().execute({ url: `${base}/stream`, method: 'GET' }),
    delay(1000, null),
  ])
  assert.notEqual(result, null, 'headers are available but probe waits for the other response reader')
  assert.match(result, /status: 200 OK/)
  assert.match(result, /server: cloned-stream-test/)
  assert.equal(otherReader.body.locked, false)
})
