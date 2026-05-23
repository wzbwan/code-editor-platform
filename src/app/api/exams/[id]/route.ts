import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { applyTeacherExamAction } from '@/lib/exams'

interface Params {
  params: {
    id: string
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const action = String(body.action ?? '').trim()

  if (!action) {
    return NextResponse.json({ error: '缺少操作类型' }, { status: 400 })
  }

  try {
    const exam = await applyTeacherExamAction(session.user.id, params.id, action)
    return NextResponse.json(exam)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作考试失败' },
      { status: 400 }
    )
  }
}
