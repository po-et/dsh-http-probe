# dsh-http-probe

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds an `http_probe` tool: the agent can check the status code, latency and key response headers of any HTTP(S) endpoint without reading response bodies. Useful for API health checks and quick "is this site up?" questions.

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件，提供 `http_probe` 工具：让 agent 可以探测任意 HTTP(S) 端点的状态码、延迟和关键响应头（不读取响应体）。适合 API 健康检查和"这个服务挂了吗"类问题。

HEAD is the default; a 405 (method not allowed) or 501 (method not implemented) response is retried once as GET. This supports servers that implement GET but omit HEAD. An explicit GET returning either status is reported without a retry. GET bodies are cancelled after the headers arrive, including streaming bodies, so a completed probe does not leave a response downloading until timeout. Latency measures the time to receive the headers. If an unread body has already failed, the received status and headers are still reported.

默认使用 HEAD，遇到 405（不允许该方法）或 501（未实现该方法）时回退一次 GET，兼容只实现 GET 的服务。显式 GET 若返回这些状态码，则直接报告，不再重试。获取响应头后会取消 GET 响应体，包括持续流式响应；探测结束即释放响应，延迟统计为获取响应头耗时。未读取的响应体若已失败，仍保留已经收到的状态码和响应头。

## Install / 安装

> Not on npm yet, so install straight from GitHub. pnpm will ask you to allow this package's build script once (dsh prints the exact line to add); that's the `prepare` step compiling TypeScript.

```sh
dsh plugin --profile web add github:po-et/dsh-http-probe
```

Then ask the agent something like: *"Probe https://example.com and tell me if it's healthy."*

## Development / 开发

```sh
npm install
npm run build
npm test        # build and test with local HTTP servers; no external endpoint required
npm run dev     # dsh web --patch ./dev.cordis.yml, then open http://127.0.0.1:3080
```

`dev.cordis.yml` loads the built plugin by absolute path; edit it if you cloned this repo to a different location. Rebuild after changing `src/`.

## License

[MIT](LICENSE)
