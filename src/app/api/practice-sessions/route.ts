import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { createPracticeSession } from '@/lib/practice'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const paperId = String(body.paperId ?? '').trim()
  const className = String(body.className ?? '').trim()
  const mode = String(body.mode ?? '').trim()
  const durationMinutes =
    body.durationMinutes === null || body.durationMinutes === undefined || body.durationMinutes === ''
      ? null
      : Number.parseInt(String(body.durationMinutes), 10)

  if (!paperId || !className || !mode) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
  }

  try {
    const practiceSession = await createPracticeSession(session.user.id, {
      paperId,
      className,
      mode,
      durationMinutes,
    })

    return NextResponse.json(practiceSession)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建练习失败' },
      { status: 400 }
    )
  }
}
