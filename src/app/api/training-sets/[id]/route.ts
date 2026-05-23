import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { applyTeacherTrainingAction } from '@/lib/training'

interface Params {
  params: {
    id: string
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
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
    const trainingSet = await applyTeacherTrainingAction(session.user.id, params.id, action)
    return NextResponse.json(trainingSet)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作训练任务失败' },
      { status: 400 }
    )
  }
}
