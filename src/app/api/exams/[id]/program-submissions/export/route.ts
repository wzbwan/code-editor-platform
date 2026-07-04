import { format } from 'date-fns'
import JSZip from 'jszip'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

interface Params {
  params: {
    id: string
  }
}

function sanitizeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]/g, '_') || '未命名'
}

function formatDateTime(value: Date) {
  return format(value, 'yyyy-MM-dd HH:mm:ss')
}

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const exam = await prisma.exam.findFirst({
    where: {
      id: params.id,
      teacherId: session.user.id,
    },
    select: {
      title: true,
      className: true,
      startsAt: true,
      endsAt: true,
      programQuestions: {
        select: {
          id: true,
          orderIndex: true,
          title: true,
          score: true,
        },
        orderBy: { orderIndex: 'asc' },
      },
      programSubmissions: {
        select: {
          code: true,
          isPassed: true,
          judgeMessage: true,
          awardedScore: true,
          submittedAt: true,
          studentId: true,
          questionId: true,
          student: {
            select: {
              username: true,
              name: true,
              className: true,
            },
          },
          question: {
            select: {
              orderIndex: true,
              title: true,
              score: true,
            },
          },
        },
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      },
    },
  })

  if (!exam) {
    return NextResponse.json({ error: '考试不存在' }, { status: 404 })
  }

  const latestSubmissionByStudentQuestion = new Map<
    string,
    (typeof exam.programSubmissions)[number]
  >()

  for (const submission of exam.programSubmissions) {
    const key = `${submission.studentId}:${submission.questionId}`
    if (!latestSubmissionByStudentQuestion.has(key)) {
      latestSubmissionByStudentQuestion.set(key, submission)
    }
  }

  const latestSubmissions = Array.from(latestSubmissionByStudentQuestion.values()).sort(
    (left, right) =>
      left.student.name.localeCompare(right.student.name, 'zh-Hans-CN') ||
      left.student.username.localeCompare(right.student.username) ||
      left.question.orderIndex - right.question.orderIndex
  )

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([
    [
      '用户名',
      '姓名',
      '班级',
      '题号',
      '题目',
      '题目分值',
      '本题得分',
      '是否通过',
      '判题信息',
      '提交时间',
      '文件路径',
    ],
    ...latestSubmissions.map((submission) => {
      const studentFolder = `${sanitizeFilename(submission.student.username)}-${sanitizeFilename(
        submission.student.name
      )}`
      const questionName = `第${submission.question.orderIndex}题-${sanitizeFilename(
        submission.question.title
      )}.py`

      return [
        submission.student.username,
        submission.student.name,
        submission.student.className || '',
        submission.question.orderIndex,
        submission.question.title,
        submission.question.score,
        submission.awardedScore,
        submission.isPassed ? '通过' : '未通过',
        submission.judgeMessage,
        formatDateTime(submission.submittedAt),
        `${studentFolder}/${questionName}`,
      ]
    }),
  ])
  XLSX.utils.book_append_sheet(workbook, worksheet, '程序题提交信息')

  const zip = new JSZip()
  const examInfo = [
    `# ${exam.title}`,
    '',
    `班级：${exam.className}`,
    `考试时间：${formatDateTime(exam.startsAt)} 至 ${formatDateTime(exam.endsAt)}`,
    `程序题数量：${exam.programQuestions.length}`,
    `已导出源码文件：${latestSubmissions.length}`,
    '',
    '说明：每名学生每道程序题仅导出最后一次提交源码。',
  ].join('\n')

  zip.file('考试信息.md', examInfo)
  zip.file('提交信息.xlsx', XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))

  for (const submission of latestSubmissions) {
    const studentFolder = `${sanitizeFilename(submission.student.username)}-${sanitizeFilename(
      submission.student.name
    )}`
    const questionName = `第${submission.question.orderIndex}题-${sanitizeFilename(
      submission.question.title
    )}.py`

    zip.file(`${studentFolder}/${questionName}`, submission.code)
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  })
  const filename = `${sanitizeFilename(exam.title)}-程序题源码.zip`

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
