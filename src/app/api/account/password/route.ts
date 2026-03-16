import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const currentPassword = String(body.currentPassword ?? '')
  const newPassword = String(body.newPassword ?? '')

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: '请填写完整密码信息' }, { status: 400 })
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: '新密码至少 6 位' }, { status: 400 })
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: '新密码不能与当前密码相同' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      password: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 })
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.password)
  if (!passwordMatch) {
    return NextResponse.json({ error: '当前密码不正确' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
    },
  })

  return NextResponse.json({ success: true })
}
