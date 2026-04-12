import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const className = searchParams.get('className')?.trim() || ''
  const chapterKey = searchParams.get('chapterKey')?.trim() || ''

  const submissions = await prisma.challengeSubmission.findMany({
    where: {
      ...(chapterKey ? { chapterKey } : {}),
      ...(className
        ? {
            student: {
              className,
            },
          }
        : {}),
    },
    orderBy: [{ submittedAt: 'desc' }],
    select: {
      id: true,
      chapterKey: true,
      levelKey: true,
      code: true,
      isPassed: true,
      judgeMessage: true,
      stdout: true,
      stderr: true,
      pointsAwarded: true,
      submittedAt: true,
      student: {
        select: {
          id: true,
          username: true,
          name: true,
          className: true,
        },
      },
    },
  })

  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      className: className || null,
      chapterKey: chapterKey || null,
      count: submissions.length,
      submissions,
    },
    null,
    2
  )

  return new NextResponse(payload, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="challenge-submissions${
        className ? `-${encodeURIComponent(className)}` : ''
      }${chapterKey ? `-${chapterKey}` : ''}.json"`,
    },
  })
}
