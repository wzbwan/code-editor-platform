import { NextRequest, NextResponse } from 'next/server'
import { loginClassDefenseStudent } from '@/lib/class-defense/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')

  try {
    const result = await loginClassDefenseStudent({
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
