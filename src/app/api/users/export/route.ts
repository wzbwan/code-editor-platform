import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth-options'
import { POINT_SOURCE } from '@/lib/constants'
import { formatAppDate, formatAppDateTime } from '@/lib/date-format'
import { roundToOneDecimal } from '@/lib/point-format'
import { prisma } from '@/lib/prisma'
import { matchesStudentQuery } from '@/lib/student-search'
import { createExportWorksheet, writeExportWorkbook } from '@/lib/xlsx-export'

export const runtime = 'nodejs'

function buildExportFilename() {
  const timestamp = formatAppDateTime(new Date()).replace(/[/:\s]/g, '-')
  return `学生信息与积分-${timestamp}.xlsx`
}

async function buildStudentPointsExportWorkbook(query = '') {
  const allStudents = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: {
      id: true,
      username: true,
      name: true,
      className: true,
      pointBalance: true,
      createdAt: true,
    },
    orderBy: { username: 'asc' },
  })
  const students = query
    ? allStudents.filter((student) => matchesStudentQuery(student, query))
    : allStudents
  const studentIds = students.map((student) => student.id)
  const otherPointGroups =
    studentIds.length > 0
      ? await prisma.studentPointRecord.groupBy({
          by: ['studentId'],
          where: {
            studentId: { in: studentIds },
            source: { not: POINT_SOURCE.CHALLENGE },
          },
          _sum: { delta: true },
        })
      : []
  const otherPointsByStudent = new Map(
    otherPointGroups.map((group) => [
      group.studentId,
      roundToOneDecimal(group._sum.delta ?? 0),
    ])
  )

  const rows = [
    ['序号', '姓名', '用户名', '班级', '注册时间', '总积分', '其他积分（除代码闯关）'],
    ...students.map((student, index) => [
      index + 1,
      student.name,
      student.username,
      student.className || '',
      formatAppDate(student.createdAt),
      roundToOneDecimal(student.pointBalance),
      otherPointsByStudent.get(student.id) ?? 0,
    ]),
  ]

  const workbook = XLSX.utils.book_new()
  const worksheet = createExportWorksheet(rows, {
    columnWidths: [8, 14, 20, 18, 14, 12, 24],
    numberFormats: {
      0: '0',
      2: '@',
      5: '0.0',
      6: '0.0',
    },
  })
  XLSX.utils.book_append_sheet(workbook, worksheet, '学生信息与积分')

  return workbook
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')?.trim() || ''
  const workbook = await buildStudentPointsExportWorkbook(query)

  const buffer = writeExportWorkbook(workbook)
  const filename = buildExportFilename()

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
