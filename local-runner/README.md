# Local Runner

`local-runner` 是学生电脑上的本地 Python 运行器。

它负责：

- 监听本机 `127.0.0.1`
- 接收网页里的 Python 代码
- 调用学生电脑上的 Python 执行
- 把标准输出、错误输出和退出状态实时回传给网页
- 支持 `input()` 这类交互输入
- 通过 Origin + 共享 Token 限制可访问来源

当前实现是一个轻量 Go 服务，不依赖 Electron，也不要求学生手动复制代码到 VS Code。

## 目录结构

- `cmd/runner/main.go`：程序入口
- `internal/config`：配置加载
- `internal/auth`：Origin 与 Token 校验
- `internal/python`：Python 探测、单次运行、交互会话
- `internal/server`：HTTP/SSE API

## 主要接口

- `GET /health`
  返回运行器状态和本机 Python 探测结果。
- `GET /v1/info`
  供网页连通性检查和环境探测使用。
- `POST /v1/run`
  单次同步执行，适合脚本或调试。
- `POST /v1/sessions`
  创建一个交互运行会话。
- `GET /v1/sessions/:id/stream?token=...`
  通过 Server-Sent Events 持续接收输出流和退出事件。
- `POST /v1/sessions/:id/stdin`
  向正在运行的 Python 进程写入输入内容。
- `POST /v1/sessions/:id/stop`
  停止当前会话。

说明：

- Python 进程以 `-u` 启动，标准输出和错误输出是无缓冲的，这样 `input("提示")` 的提示文字能及时显示在网页终端里。
- 网页端当前使用的是 `xterm.js`，终端就嵌在作业页面内部。

## 环境变量

- `RUNNER_PORT`
  监听端口，默认 `18423`
- `RUNNER_ALLOWED_ORIGINS`
  允许访问的网页来源，逗号分隔；为空时默认放行所有 Origin
- `RUNNER_SHARED_TOKEN`
  网页调用运行器时携带的共享 Token
- `RUNNER_PYTHON_COMMAND`
  显式指定 Python 命令
- `RUNNER_PYTHON_ARGS`
  显式指定 Python 启动参数
- `RUNNER_MAX_RUN_SECONDS`
  最大运行时长，默认 `300`
- `RUNNER_WORKDIR`
  临时运行目录，默认 `./runner-data`

## 开发命令

在本目录执行：

```bash
go run ./cmd/runner
```

构建：

```bash
go build -o ./bin/local-runner ./cmd/runner
```

打包学生分发版本：

```bash
./package-release.sh
```

脚本会生成：

- `release/local-runner-windows-amd64.zip`
- `release/local-runner-linux-amd64.tar.gz`
- `release/local-runner-linux-arm64.tar.gz`

分发包内已经包含启动脚本，并预置以下配置：

- `RUNNER_ALLOWED_ORIGINS=https://python.zengbao.wang`
- `RUNNER_SHARED_TOKEN=code-editor-platform-python-zengbao-wang`

如果你的 Go 环境不在 `PATH` 里，可以直接使用绝对路径，例如：

```bash
/usr/local/go/bin/go run ./cmd/runner
```

## 本地调试

健康检查：

```bash
curl http://127.0.0.1:18423/health
```

同步运行：

```bash
curl -X POST http://127.0.0.1:18423/v1/run \
  -H 'Content-Type: application/json' \
  -H 'X-Runner-Token: dev-token' \
  -d '{
    "code": "name = input(\"name? \")\nprint(\"hello\", name)",
    "stdin": "Alice\n",
    "timeoutSeconds": 5
  }'
```

## 当前前端配合方式

学生作业页会先请求服务端接口 `/api/local-runner/session`，拿到：

- `runnerUrl`
- `sharedToken`
- `timeoutSeconds`
  当前网页默认会传 `300` 秒给运行器；交互式 `input()` 等待时间也算在这个时长内。

然后前端直接连接本机运行器：

1. 调 `GET /v1/info` 检查连通性
2. 调 `POST /v1/sessions` 启动 Python 会话
3. 用 `EventSource` 连接 `/v1/sessions/:id/stream`
4. 学生在网页终端里的输入会被转发到 `/v1/sessions/:id/stdin`
5. 点击“停止”时调用 `/v1/sessions/:id/stop`

**任务来源与内容**
