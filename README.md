# dsh-http-probe

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds an `http_probe` tool: the agent can check the status code, latency and key response headers of any HTTP(S) endpoint without downloading response bodies. Useful for API health checks and quick "is this site up?" questions.

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件，提供 `http_probe` 工具：让 agent 可以探测任意 HTTP(S) 端点的状态码、延迟和关键响应头（不下载响应体）。适合 API 健康检查和"这个服务挂了吗"类问题。

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
npm run dev     # dsh web --patch ./dev.cordis.yml, then open http://127.0.0.1:3080
```

`dev.cordis.yml` loads the built plugin by absolute path; edit it if you cloned this repo to a different location. Rebuild after changing `src/`.

## License

[MIT](LICENSE)
