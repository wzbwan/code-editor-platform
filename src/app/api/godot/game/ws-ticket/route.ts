import { NextRequest, NextResponse } from 'next/server'
import { issueClassDefenseWsTicket } from '@/lib/class-defense/auth'

export const runtime = 'nodejs'

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
}

export async function POST(request: NextRequest) {
  const accessToken = getBearerToken(request)
  const body = await request.json().catch(() => ({}))
  const sessionId = body.sessionId ? String(body.sessionId).trim() : null

  try {
    const ticket = await issueClassDefenseWsTicket({
      accessToken,
      sessionId,
    })
    return NextResponse.json(ticket)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取 WebSocket 凭证失败' },
      { status: 401 }
    )
  }
}
