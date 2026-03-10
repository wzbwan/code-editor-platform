import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { matchesStudentQuery } from '@/lib/student-search'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')?.trim() || ''

  const users = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: {
      id: true,
      username: true,
      name: true,
      pointBalance: true,
      createdAt: true,
      _count: { select: { submissions: true } },
    },
    orderBy: { username: 'asc' },
  })

  return NextResponse.json(
    query ? users.filter((user) => matchesStudentQuery(user, query)) : users
  )
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

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
    select: {
      id: true,
      username: true,
      name: true,
      pointBalance: true,
      createdAt: true,
    },
  })

  return NextResponse.json(user)
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: '缺少用户ID' }, { status: 400 })
  }

  await prisma.submission.deleteMany({ where: { studentId: id } })
  await prisma.studentPointRecord.deleteMany({ where: { studentId: id } })
  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
