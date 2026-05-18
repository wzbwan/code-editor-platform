import { NextResponse } from 'next/server'
import {
  createStudentChallengeAttempt,
  getStudentChallengeLevelViewForGodot,
} from '@/lib/challenges/service'
import { verifyGodotChallengeBearerRequest } from '@/lib/godot-challenges/auth'

export const runtime = 'nodejs'

interface Props {
  params: Promise<{
    chapterKey: string
    levelKey: string
  }>
}

export async function GET(request: Request, { params }: Props) {
  const student = await verifyGodotChallengeBearerRequest(request)
  if (!student) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { chapterKey, levelKey } = await params

  try {
    const data = await getStudentChallengeLevelViewForGodot(student.id, chapterKey, levelKey)
    if (!data) {
      return NextResponse.json({ error: '关卡不存在' }, { status: 404 })
    }

    if (!data.level.isAccessible) {
      return NextResponse.json({ error: '当前关卡尚未解锁' }, { status: 403 })
    }

    const attempt = await createStudentChallengeAttempt({
      studentId: student.id,
      chapterKey,
      levelKey,
    })

    return NextResponse.json({
      attemptId: attempt.id,
      ...data,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取关卡失败' },
      { status: 400 }
    )
  }
}
