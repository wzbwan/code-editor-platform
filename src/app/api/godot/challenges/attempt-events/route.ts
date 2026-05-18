import { NextRequest, NextResponse } from 'next/server'
import {
  ChallengeAttemptError,
  recordStudentChallengeAttemptEvent,
} from '@/lib/challenges/service'
import { verifyGodotChallengeBearerRequest } from '@/lib/godot-challenges/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const student = await verifyGodotChallengeBearerRequest(request)
  if (!student) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const result = await recordStudentChallengeAttemptEvent(student.id, {
      attemptId: typeof body.attemptId === 'string' ? body.attemptId : '',
      chapterKey: typeof body.chapterKey === 'string' ? body.chapterKey : '',
      levelKey: typeof body.levelKey === 'string' ? body.levelKey : '',
      type: typeof body.type === 'string' ? body.type : '',
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '记录答题尝试事件失败'
    if (error instanceof ChallengeAttemptError) {
      return NextResponse.json(
        {
          error: message,
          ...(error.attemptStatus ? { attemptStatus: error.attemptStatus } : {}),
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
