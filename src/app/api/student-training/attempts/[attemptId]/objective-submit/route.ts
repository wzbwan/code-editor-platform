import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { submitTrainingObjectiveAnswer } from '@/lib/training'

interface Params {
  params: {
    attemptId: string
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const questionId = String(body.questionId ?? '').trim()
  const answer = String(body.answer ?? '').trim()
  if (!questionId) {
    return NextResponse.json({ error: '缺少题目 ID' }, { status: 400 })
  }

  try {
    const result = await submitTrainingObjectiveAnswer(session.user.id, params.attemptId, {
      questionId,
      answer,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提交答案失败' },
      { status: 400 }
    )
  }
}
