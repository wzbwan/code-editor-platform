import { format } from 'date-fns'
import JSZip from 'jszip'
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

function sanitizeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]/g, '_') || '未命名'
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const assignmentId = searchParams.get('assignmentId')

  if (!assignmentId) {
    return NextResponse.json({ error: '缺少作业ID' }, { status: 400 })
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      teacherId: session.user.id,
    },
    select: {
      title: true,
      description: true,
      dueDate: true,
      submissions: {
        include: {
          student: {
            select: {
              username: true,
              name: true,
              className: true,
            },
          },
        },
        orderBy: { submittedAt: 'asc' },
      },
    },
  })

  if (!assignment) {
    return NextResponse.json({ error: '作业不存在' }, { status: 404 })
  }

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['用户名', '姓名', '班级', '提交时间'],
    ...assignment.submissions.map((submission) => [
      submission.student.username,
      submission.student.name,
      submission.student.className || '',
      format(submission.submittedAt, 'yyyy-MM-dd HH:mm:ss'),
    ]),
  ])
  XLSX.utils.book_append_sheet(workbook, worksheet, '提交信息')

  const zip = new JSZip()
  const requirementContent = [
    `# ${assignment.title}`,
    '',
    assignment.description,
    ...(assignment.dueDate
      ? ['', `截止时间：${format(assignment.dueDate, 'yyyy-MM-dd HH:mm:ss')}`]
      : []),
  ].join('\n')

  zip.file('作业要求.md', requirementContent)
  zip.file('提交信息.xlsx', XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))

  for (const submission of assignment.submissions) {
    zip.file(
      `${sanitizeFilename(submission.student.username)}-${sanitizeFilename(
        submission.student.name
      )}.py`,
      submission.code
    )
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  })
  const filename = `${sanitizeFilename(assignment.title)}-作业提交.zip`

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
