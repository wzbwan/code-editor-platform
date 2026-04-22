import { NextRequest, NextResponse } from 'next/server'
import { consumeGodotSessionBootstrap, issueNextAuthSessionCookie } from '@/lib/godot-auth'
import { SESSION_CLIENT_TYPES } from '@/lib/session-client'

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

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim() || ''

  if (!code) {
    return buildExchangeErrorResponse('缺少会话交换码，请返回 Godot 重新登录。', 400)
  }

  const bootstrap = await consumeGodotSessionBootstrap(code)
  if (!bootstrap) {
    return buildExchangeErrorResponse('会话交换码无效或已过期，请返回 Godot 重新登录。', 400)
  }

  const redirectUrl = new URL(bootstrap.targetPath, request.nextUrl.origin)
  const response = NextResponse.redirect(redirectUrl)

  await issueNextAuthSessionCookie(response, {
    id: bootstrap.user.id,
    name: bootstrap.user.name,
    username: bootstrap.user.username,
    role: bootstrap.user.role,
    clientType: SESSION_CLIENT_TYPES.GODOT,
    origin: request.nextUrl.origin,
  })

  return response
}
