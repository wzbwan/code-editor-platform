import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { createTrainingSet, deleteTrainingSet } from '@/lib/training'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  const className = String(body.className ?? '').trim()
  const paperId = String(body.paperId ?? '').trim()
  const programQuestions = Array.isArray(body.programQuestions)
    ? body.programQuestions.map((item: any) => ({
        chapterKey: String(item?.chapterKey ?? '').trim(),
        levelKey: String(item?.levelKey ?? '').trim(),
        score:
          item?.score === undefined || item?.score === ''
            ? undefined
            : Number.parseInt(String(item.score), 10),
      }))
    : []

  try {
    const trainingSet = await createTrainingSet(session.user.id, {
      title,
      description,
      className,
      paperId,
      programQuestions,
    })

    return NextResponse.json(trainingSet)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建训练任务失败' },
      { status: 400 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')?.trim()
  if (!id) {
    return NextResponse.json({ error: '缺少训练任务 ID' }, { status: 400 })
  }

  try {
    await deleteTrainingSet(session.user.id, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除训练任务失败' },
      { status: 400 }
    )
  }
}
