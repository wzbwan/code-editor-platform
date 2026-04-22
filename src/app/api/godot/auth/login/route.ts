import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { createGodotSessionBootstrap } from '@/lib/godot-auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')
  const nextPath = typeof body.nextPath === 'string' ? body.nextPath : null

  if (!username || !password) {
    return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 })
  }

  const student = await prisma.user.findFirst({
    where: {
      username,
      role: 'STUDENT',
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      password: true,
    },
  })

  if (!student) {
    return NextResponse.json({ error: '学生账号不存在或无权限' }, { status: 401 })
  }

  const passwordMatch = await bcrypt.compare(password, student.password)
  if (!passwordMatch) {
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
  }

  const bootstrap = await createGodotSessionBootstrap({
    userId: student.id,
    targetPath: nextPath,
  })

  const origin = request.nextUrl.origin
  const exchangeUrl = new URL('/api/godot/auth/exchange', origin)
  exchangeUrl.searchParams.set('code', bootstrap.code)

  return NextResponse.json({
    launchUrl: exchangeUrl.toString(),
    expiresAt: bootstrap.expiresAt.toISOString(),
    targetPath: bootstrap.targetPath,
    user: {
      id: student.id,
      username: student.username,
      name: student.name,
      role: student.role,
    },
  })
}
