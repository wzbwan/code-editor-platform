import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import {
  createClassDefenseSession,
  listTeacherClassDefenseSessions,
} from '@/lib/class-defense/service'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const sessions = await listTeacherClassDefenseSessions(session.user.id)
  return NextResponse.json({ sessions })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const className = String(body.className ?? '').trim()
  const paperId = body.paperId ? String(body.paperId).trim() : null
  const config = body.config ?? undefined

  try {
    const created = await createClassDefenseSession(session.user.id, {
      className,
      paperId,
      config,
    })
    return NextResponse.json(created)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建守护班级失败' },
      { status: 400 }
    )
  }
}
