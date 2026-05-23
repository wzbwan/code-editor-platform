import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { createExam, deleteExam } from '@/lib/exams'

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
  const startsAt = new Date(String(body.startsAt ?? ''))
  const endsAt = new Date(String(body.endsAt ?? ''))
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

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: '考试时间非法' }, { status: 400 })
  }

  try {
    const exam = await createExam(session.user.id, {
      title,
      description,
      className,
      paperId,
      startsAt,
      endsAt,
      programQuestions,
    })

    return NextResponse.json(exam)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建考试失败' },
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
    return NextResponse.json({ error: '缺少考试 ID' }, { status: 400 })
  }

  try {
    await deleteExam(session.user.id, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除考试失败' },
      { status: 400 }
    )
  }
}
