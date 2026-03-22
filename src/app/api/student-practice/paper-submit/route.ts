import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { submitPaperPracticeAnswers } from '@/lib/practice'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const sessionId = String(body.sessionId ?? '').trim()
  const answers = Array.isArray(body.answers) ? body.answers : []

  if (!sessionId) {
    return NextResponse.json({ error: '缺少练习会话ID' }, { status: 400 })
  }

  try {
    const result = await submitPaperPracticeAnswers(
      session.user.id,
      sessionId,
      answers
    )
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提交失败' },
      { status: 400 }
    )
  }
}
