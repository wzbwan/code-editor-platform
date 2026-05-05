import { NextRequest, NextResponse } from 'next/server'
import { loginGodotChallengeStudent } from '@/lib/godot-challenges/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')

  try {
    const result = await loginGodotChallengeStudent({
      username,
      password,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '登录失败' },
      { status: 401 }
    )
  }
}
