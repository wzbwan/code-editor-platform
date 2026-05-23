import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { recordStudentExamEvent } from '@/lib/exams'

interface Params {
  params: {
    id: string
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const type = String(body.type ?? '').trim()
  if (!type) {
    return NextResponse.json({ error: '缺少事件类型' }, { status: 400 })
  }

  try {
    const result = await recordStudentExamEvent(session.user.id, params.id, {
      type,
      payload: body.payload,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '记录事件失败' },
      { status: 400 }
    )
  }
}
