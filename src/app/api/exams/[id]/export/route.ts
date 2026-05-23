import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { getTeacherExamDetail } from '@/lib/exams'

interface Params {
  params: {
    id: string
  }
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const detail = await getTeacherExamDetail(session.user.id, params.id)
  if (!detail) {
    return NextResponse.json({ error: '考试不存在' }, { status: 404 })
  }

  const rows = [
    ['姓名', '账号', '班级', '状态', '客观题分', '程序题分', '总分', '切屏次数', '交卷时间'],
    ...detail.roster.map((item) => [
      item.student.name,
      item.student.username,
      item.student.className || '',
      item.session?.status || '未进入',
      item.session?.objectiveScore ?? 0,
      item.session?.programScore ?? 0,
      item.session?.totalScore ?? 0,
      item.focusLostCount,
      item.session?.submittedAt?.toISOString() || '',
    ]),
  ]
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="exam-${params.id}.csv"`,
    },
  })
}
