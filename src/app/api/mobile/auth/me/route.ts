import { NextResponse } from 'next/server'
import { authenticateMobileApiRequest } from '@/lib/mobile-api'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const auth = await authenticateMobileApiRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  if (!auth.operatorId) {
    return NextResponse.json({
      teacher: {
        id: null,
        username: null,
        name: auth.operatorLabel,
        role: 'TEACHER',
      },
    })
  }

  const teacher = await prisma.user.findFirst({
    where: {
      id: auth.operatorId,
      role: 'TEACHER',
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
    },
  })

  if (!teacher) {
    return NextResponse.json({ error: '教师账号不存在' }, { status: 404 })
  }

  return NextResponse.json({ teacher })
}
