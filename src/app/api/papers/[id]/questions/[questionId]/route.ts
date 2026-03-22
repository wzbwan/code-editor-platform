import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import {
  deletePracticePaperQuestion,
  updatePracticePaperQuestion,
} from '@/lib/practice'

interface RouteContext {
  params: Promise<{
    id: string
    questionId: string
  }>
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const params = await context.params
  const body = await request.json()

  try {
    const question = await updatePracticePaperQuestion(session.user.id, {
      paperId: params.id,
      questionId: params.questionId,
      content: String(body.content ?? ''),
      type: String(body.type ?? ''),
      score: Number.parseInt(String(body.score ?? '0'), 10),
      optionA: String(body.optionA ?? ''),
      optionB: String(body.optionB ?? ''),
      optionC: String(body.optionC ?? ''),
      optionD: String(body.optionD ?? ''),
      answer: String(body.answer ?? ''),
      scope: String(body.scope ?? ''),
    })

    return NextResponse.json(question)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新题目失败' },
      { status: 400 }
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const params = await context.params

  try {
    await deletePracticePaperQuestion(session.user.id, params.id, params.questionId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除题目失败' },
      { status: 400 }
    )
  }
}
