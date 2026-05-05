import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import {
  deleteTeacherClassDefenseMonsterType,
  updateTeacherClassDefenseMonsterType,
} from '@/lib/class-defense/service'

interface Props {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, { params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  try {
    const monster = await updateTeacherClassDefenseMonsterType(session.user.id, id, body)
    return NextResponse.json(monster)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新怪物失败' },
      { status: 400 }
    )
  }
}

export async function DELETE(_: NextRequest, { params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params

  try {
    const result = await deleteTeacherClassDefenseMonsterType(session.user.id, id)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除怪物失败' },
      { status: 400 }
    )
  }
}
