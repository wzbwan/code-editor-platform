import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import {
  createTeacherClassDefenseMonsterType,
  listTeacherClassDefenseMonsterTypes,
} from '@/lib/class-defense/service'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const monsters = await listTeacherClassDefenseMonsterTypes(session.user.id)
  return NextResponse.json({ monsters })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()

  try {
    const monster = await createTeacherClassDefenseMonsterType(session.user.id, body)
    return NextResponse.json(monster)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建怪物失败' },
      { status: 400 }
    )
  }
}
