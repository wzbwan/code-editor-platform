import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import {
  applyTeacherClassDefenseAction,
  getTeacherClassDefenseSession,
} from '@/lib/class-defense/service'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(_: NextRequest, { params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params
  const data = await getTeacherClassDefenseSession(session.user.id, id)
  if (!data) {
    return NextResponse.json({ error: '守护班级会话不存在' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, { params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const action = String(body.action ?? '').trim()

  if (!action) {
    return NextResponse.json({ error: '缺少操作类型' }, { status: 400 })
  }

  try {
    const data = await applyTeacherClassDefenseAction(session.user.id, id, action)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 400 }
    )
  }
}
