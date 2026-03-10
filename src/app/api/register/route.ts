import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { username, password, name } = body

  if (!username || !password || !name) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({
    where: { username },
  })

  if (existing) {
    return NextResponse.json({ error: '用户名已存在' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: { username, password: hashedPassword, name },
    select: { id: true, username: true, name: true, pointBalance: true },
  })

  return NextResponse.json(user)
}
