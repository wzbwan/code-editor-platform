'use client'

import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useEffect, useRef, useState } from 'react'

interface Props {
  assignmentTitle: string
  code: string
}

interface RunnerSession {
  runnerUrl: string
  sharedToken: string
  timeoutSeconds: number
}

interface RunnerInfoResponse {
  status: string
  listenAddress: string
  allowedOrigins: string[]
  supportsInteractive?: boolean
  python?: {
    name: string
    args: string[]
    version: string
  }
}

interface RunnerCreateSessionResponse {
  session: {
    id: string
    command: {
      name: string
      args: string[]
      version: string
    }
    running: boolean
    startedAt: string
  }
}

interface RunnerEvent {
  type: 'start' | 'stdout' | 'stderr' | 'error' | 'exit'
  data?: string
  message?: string
  exitCode?: number
  durationMs?: number
  timedOut?: boolean
  command?: {
    name: string
    args: string[]
    version: string
  }
}

function sanitizePythonFilename(input: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'assignment'}.py`
}

function toAnsiRed(text: string) {
  return `\x1b[31m${text}\x1b[0m`
}

function toAnsiCyan(text: string) {
  return `\x1b[36m${text}\x1b[0m`
}

export default function LocalRunnerTerminal({ assignmentTitle, code }: Props) {
  const terminalContainerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const runnerSessionRef = useRef<RunnerSession | null>(null)
  const activeSessionIdRef = useRef<string | null>(null)
  const inputBufferRef = useRef('')
  const runningRef = useRef(false)

  const [runnerInfo, setRunnerInfo] = useState<RunnerInfoResponse | null>(null)
  const [runnerStatus, setRunnerStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'error'
  >('idle')
  const [runnerMessage, setRunnerMessage] = useState('')
  const [running, setRunning] = useState(false)

  const writeTerminal = (text: string) => {
    terminalRef.current?.write(text)
  }

  const writeLine = (text: string) => {
    terminalRef.current?.write(`${text}\r\n`)
  }

  const closeStream = () => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    activeSessionIdRef.current = null
    inputBufferRef.current = ''
    runningRef.current = false
    setRunning(false)
  }

  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      theme: {
        background: '#020617',
        foreground: '#e2e8f0',
      },
      convertEol: true,
      rows: 18,
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    if (terminalContainerRef.current) {
      terminal.open(terminalContainerRef.current)
      fitAddon.fit()
    }

    writeLine('准备连接本地运行器...')

    const resize = () => fitAddon.fit()
    window.addEventListener('resize', resize)

    const disposable = terminal.onData(async (data) => {
      if (
        !runningRef.current ||
        !activeSessionIdRef.current ||
        !runnerSessionRef.current
      ) {
        return
      }

      if (data === '\u0003') {
        await handleStop()
        return
      }

      if (data === '\r') {
        writeTerminal('\r\n')
        const payload = inputBufferRef.current + '\n'
        inputBufferRef.current = ''
        await sendInput(payload)
        return
      }

      if (data === '\u007f') {
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1)
          writeTerminal('\b \b')
        }
        return
      }

      if (data >= ' ') {
        inputBufferRef.current += data
        writeTerminal(data)
      }
    })

    return () => {
      disposable.dispose()
      window.removeEventListener('resize', resize)
      closeStream()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  const getRunnerSession = async () => {
    if (runnerSessionRef.current) {
      return runnerSessionRef.current
    }

    const res = await fetch('/api/local-runner/session')
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || '无法获取本地运行器配置')
    }

    runnerSessionRef.current = data
    return data as RunnerSession
  }

  const connectRunner = async () => {
    setRunnerStatus('connecting')
    setRunnerMessage('')

    try {
      const session = await getRunnerSession()
      const res = await fetch(`${session.runnerUrl}/v1/info`, {
        headers: session.sharedToken
          ? {
              'X-Runner-Token': session.sharedToken,
            }
          : undefined,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '本地运行器连接失败')
      }

      setRunnerInfo(data)
      setRunnerStatus('connected')
      setRunnerMessage(
        data.python
          ? `已连接本机 Python：${data.python.version}`
          : '已连接本地运行器'
      )
      return { session, info: data as RunnerInfoResponse }
    } catch (error) {
      setRunnerStatus('error')
      setRunnerMessage(
        error instanceof Error
          ? `${error.message}。请确认本地运行器已启动。`
          : '连接失败，请确认本地运行器已启动。'
      )
      throw error
    }
  }

  const handleStreamEvent = (event: RunnerEvent) => {
    switch (event.type) {
      case 'start':
        if (event.command) {
          writeLine(
            toAnsiCyan(
              `\n[runner] 使用 ${event.command.name}${
                event.command.args.length > 0
                  ? ` ${event.command.args.join(' ')}`
                  : ''
              } 运行，版本：${event.command.version}\n`
            )
          )
        }
        break
      case 'stdout':
        if (event.data) {
          writeTerminal(event.data)
        }
        break
      case 'stderr':
        if (event.data) {
          writeTerminal(toAnsiRed(event.data))
        }
        break
      case 'error':
        writeLine(toAnsiRed(`[runner error] ${event.message || '未知错误'}`))
        break
      case 'exit':
        writeLine(
          toAnsiCyan(
            `\n[runner] 运行结束，退出码 ${event.exitCode ?? -1}，耗时 ${
              event.durationMs ?? 0
            } ms${event.timedOut ? '，已超时终止' : ''}`
          )
        )
        closeStream()
        break
      default:
        break
    }
  }

  const attachStream = (runnerUrl: string, sharedToken: string, sessionId: string) => {
    const params = new URLSearchParams()
    if (sharedToken) {
      params.set('token', sharedToken)
    }

    const eventSource = new EventSource(
      `${runnerUrl}/v1/sessions/${sessionId}/stream?${params.toString()}`
    )

    eventSource.onmessage = (message) => {
      const payload = JSON.parse(message.data) as RunnerEvent
      handleStreamEvent(payload)
    }

    eventSource.onerror = () => {
      eventSource.close()
      eventSourceRef.current = null
      if (runningRef.current) {
        runningRef.current = false
        setRunning(false)
        setRunnerStatus('error')
        setRunnerMessage('与本地运行器的实时连接已断开')
        writeLine(toAnsiRed('\n[runner] 实时连接已断开'))
      }
    }

    eventSourceRef.current = eventSource
  }

  const handleRun = async () => {
    if (!code.trim()) {
      setRunnerMessage('代码不能为空')
      return
    }

    setRunnerMessage('')

    try {
      const session =
        runnerStatus === 'connected' && runnerSessionRef.current
          ? runnerSessionRef.current
          : (await connectRunner()).session

      closeStream()
      terminalRef.current?.clear()
      inputBufferRef.current = ''

      const res = await fetch(`${session.runnerUrl}/v1/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.sharedToken
            ? {
                'X-Runner-Token': session.sharedToken,
              }
            : {}),
        },
        body: JSON.stringify({
          code,
          timeoutSeconds: session.timeoutSeconds,
          filename: sanitizePythonFilename(assignmentTitle),
        }),
      })
      const data = (await res.json()) as
        | RunnerCreateSessionResponse
        | { error: string }

      if (!res.ok) {
        throw new Error('error' in data ? data.error : '启动运行失败')
      }

      if (!('session' in data)) {
        throw new Error('本地运行器没有返回会话信息')
      }

      runningRef.current = true
      setRunning(true)
      setRunnerStatus('connected')
      setRunnerMessage('程序正在运行，可直接在下方终端输入内容')
      activeSessionIdRef.current = data.session.id

      attachStream(session.runnerUrl, session.sharedToken, data.session.id)
    } catch (error) {
      runningRef.current = false
      setRunning(false)
      setRunnerStatus('error')
      setRunnerMessage(
        error instanceof Error ? error.message : '启动运行失败，请稍后重试'
      )
      writeLine(toAnsiRed(`[runner] ${error instanceof Error ? error.message : '运行失败'}`))
    }
  }

  const sendInput = async (data: string) => {
    if (!activeSessionIdRef.current || !runnerSessionRef.current) {
      return
    }

    const res = await fetch(
      `${runnerSessionRef.current.runnerUrl}/v1/sessions/${activeSessionIdRef.current}/stdin`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(runnerSessionRef.current.sharedToken
            ? {
                'X-Runner-Token': runnerSessionRef.current.sharedToken,
              }
            : {}),
        },
        body: JSON.stringify({ data }),
      }
    )

    if (!res.ok) {
      const response = await res.json().catch(() => ({ error: '发送输入失败' }))
      setRunnerMessage(response.error || '发送输入失败')
    }
  }

  const handleStop = async () => {
    if (!activeSessionIdRef.current || !runnerSessionRef.current) {
      return
    }

    await fetch(
      `${runnerSessionRef.current.runnerUrl}/v1/sessions/${activeSessionIdRef.current}/stop`,
      {
        method: 'POST',
        headers: runnerSessionRef.current.sharedToken
          ? {
              'X-Runner-Token': runnerSessionRef.current.sharedToken,
            }
          : undefined,
      }
    )
  }

  const handleClear = () => {
    terminalRef.current?.clear()
    setRunnerMessage('')
  }

  return (
    <div className="mt-6 rounded-lg bg-white shadow overflow-hidden">
      <div className="bg-slate-900 px-4 py-3 text-white flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">本机 Python 交互终端</div>
          <div className="text-xs text-slate-300">
            支持实时输出、input() 输入和停止当前运行
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={connectRunner}
            disabled={runnerStatus === 'connecting' || running}
            className="rounded bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600 disabled:opacity-50"
          >
            {runnerStatus === 'connecting' ? '连接中...' : '连接运行器'}
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="rounded bg-emerald-600 px-4 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            {running ? '运行中...' : '运行代码'}
          </button>
          <button
            onClick={handleStop}
            disabled={!running}
            className="rounded bg-rose-600 px-4 py-2 text-sm hover:bg-rose-500 disabled:opacity-50"
          >
            停止
          </button>
        </div>
      </div>

      <div className="border-b bg-slate-50 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              runnerStatus === 'connected'
                ? 'bg-emerald-100 text-emerald-700'
                : runnerStatus === 'error'
                  ? 'bg-red-100 text-red-700'
                  : runnerStatus === 'connecting'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-200 text-slate-700'
            }`}
          >
            {runnerStatus === 'connected'
              ? running
                ? '运行中'
                : '已连接'
              : runnerStatus === 'error'
                ? '连接失败'
                : runnerStatus === 'connecting'
                  ? '连接中'
                  : '未连接'}
          </span>
          {runnerInfo?.python && (
            <span className="text-slate-600">
              {runnerInfo.python.name}
              {runnerInfo.python.args.length > 0
                ? ` ${runnerInfo.python.args.join(' ')}`
                : ''}
              {' / '}
              {runnerInfo.python.version}
            </span>
          )}
        </div>
        {runnerMessage && <p className="mt-2 text-slate-600">{runnerMessage}</p>}
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            运行过程中直接在终端区域输入内容，按回车发送给程序。
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
          >
            清空终端
          </button>
        </div>
        <div
          ref={terminalContainerRef}
          className="local-runner-terminal rounded-lg border bg-slate-950 p-2"
        />
      </div>
    </div>
  )
}
