import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const mobileApiToken = process.env.MOBILE_API_TOKEN?.trim()

  if (!mobileApiToken) {
    return NextResponse.json(
      { error: '未配置 MOBILE_API_TOKEN' },
      { status: 503 }
    )
  }

  const body = await request.json()
  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')

  if (!username || !password) {
    return NextResponse.json(
      { error: '用户名和密码不能为空' },
      { status: 400 }
    )
  }

  const teacher = await prisma.user.findFirst({
    where: {
      username,
      role: 'TEACHER',
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      password: true,
    },
  })

  if (!teacher) {
    return NextResponse.json(
      { error: '教师账号不存在或无权限' },
      { status: 401 }
    )
  }

  const passwordMatch = await bcrypt.compare(password, teacher.password)
  if (!passwordMatch) {
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
  }

  return NextResponse.json({
    token: mobileApiToken,
    tokenType: 'Bearer',
    teacher: {
      id: teacher.id,
      username: teacher.username,
      name: teacher.name,
      role: teacher.role,
    },
  })
}
