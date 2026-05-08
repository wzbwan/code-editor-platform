import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function buildExchangeErrorResponse(message: string, status: number) {
  return new NextResponse(
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Godot 会话失效</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; }
      .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .card { max-width: 480px; background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 18px; padding: 28px; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.35); }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { margin: 0; line-height: 1.7; color: #cbd5e1; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>会话已失效</h1>
        <p>${message}</p>
      </div>
    </div>
  </body>
</html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    }
  )
}

export async function GET() {
  return buildExchangeErrorResponse(
    'Godot WebView 访问代码闯关已停用，请在 Godot 原生客户端中登录并进入代码闯关。',
    410
  )
}
