import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { submitStudentChallenge } from '@/lib/challenges/service'
import {
  getChallengeSubmitRetryAfterSeconds,
  recordChallengeSubmitCooldown,
} from '@/lib/challenges/cooldown'
import { SESSION_CLIENT_TYPES } from '@/lib/session-client'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  if (session.user.clientType !== SESSION_CLIENT_TYPES.GODOT) {
    return NextResponse.json({ error: '请在 Godot 客户端中完成代码闯关' }, { status: 403 })
  }

  const body = await request.json()
  const chapterKey = typeof body.chapterKey === 'string' ? body.chapterKey.trim() : ''
  const levelKey = typeof body.levelKey === 'string' ? body.levelKey.trim() : ''
  const code = typeof body.code === 'string' ? body.code : ''
  const judgeResult =
    body?.judgeResult && typeof body.judgeResult === 'object'
      ? {
          passed: Boolean((body.judgeResult as { passed?: unknown }).passed),
          message:
            typeof (body.judgeResult as { message?: unknown }).message === 'string'
              ? (body.judgeResult as { message: string }).message
              : '',
          stdout:
            typeof (body.judgeResult as { stdout?: unknown }).stdout === 'string'
              ? (body.judgeResult as { stdout: string }).stdout
              : '',
          stderr:
            typeof (body.judgeResult as { stderr?: unknown }).stderr === 'string'
              ? (body.judgeResult as { stderr: string }).stderr
              : '',
        }
      : null

  if (!chapterKey || !levelKey || !code.trim() || !judgeResult) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  try {
    const retryAfterSeconds = await getChallengeSubmitRetryAfterSeconds(session.user.id)
    if (retryAfterSeconds > 0) {
      return NextResponse.json(
        {
          error: `提交过于频繁，请 ${retryAfterSeconds} 秒后再试`,
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
          },
        }
      )
    }

    const result = await submitStudentChallenge(session.user.id, {
      chapterKey,
      levelKey,
      code,
      judgeResult,
    })

    await recordChallengeSubmitCooldown(session.user.id)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '提交失败',
      },
      { status: 400 }
    )
  }
}
