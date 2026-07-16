import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth-options'
import { getAllChallengeChapters } from '@/lib/challenges/registry'
import { formatAppDateTime } from '@/lib/date-format'
import { roundToOneDecimal } from '@/lib/point-format'
import { prisma } from '@/lib/prisma'
import { matchesStudentQuery } from '@/lib/student-search'
import {
  createExportWorksheet,
  makeUniqueWorksheetName,
  writeExportWorkbook,
} from '@/lib/xlsx-export'

export const runtime = 'nodejs'

interface ChallengeTaskInfo {
  key: string
  title: string
  levelCount: number
  orderIndex: number
  levelMap: Map<
    string,
    {
      title: string
      points: number
      orderIndex: number
    }
  >
}

function buildExportFilename() {
  const timestamp = formatAppDateTime(new Date()).replace(/[/:\s]/g, '-')
  return `代码闯关积分明细-${timestamp}.xlsx`
}

function buildTaskMap(submissionChapterKeys: string[]) {
  const taskMap = new Map<string, ChallengeTaskInfo>()
  const chapters = getAllChallengeChapters()

  chapters.forEach((chapter, orderIndex) => {
    taskMap.set(chapter.key, {
      key: chapter.key,
      title: chapter.title,
      levelCount: chapter.levels.length,
      orderIndex,
      levelMap: new Map(
        chapter.levels.map((level, levelOrderIndex) => [
          level.key,
          {
            title: level.title,
            points: level.points,
            orderIndex: levelOrderIndex,
          },
        ])
      ),
    })
  })

  for (const chapterKey of submissionChapterKeys) {
    if (!taskMap.has(chapterKey)) {
      taskMap.set(chapterKey, {
        key: chapterKey,
        title: `历史任务（${chapterKey}）`,
        levelCount: 0,
        orderIndex: taskMap.size,
        levelMap: new Map(),
      })
    }
  }

  return taskMap
}

async function buildChallengePointsExportWorkbook(query = '') {
  const allStudents = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: {
      id: true,
      username: true,
      name: true,
      className: true,
    },
    orderBy: { username: 'asc' },
  })
  const students = query
    ? allStudents.filter((student) => matchesStudentQuery(student, query))
    : allStudents
  const studentIds = students.map((student) => student.id)
  const studentMap = new Map(students.map((student) => [student.id, student]))
  const submissions =
    studentIds.length > 0
      ? await prisma.challengeSubmission.findMany({
          where: { studentId: { in: studentIds } },
          select: {
            id: true,
            studentId: true,
            chapterKey: true,
            levelKey: true,
            isPassed: true,
            judgeMessage: true,
            pointsAwarded: true,
            submittedAt: true,
            createdAt: true,
          },
          orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
        })
      : []
  const taskMap = buildTaskMap(submissions.map((submission) => submission.chapterKey))
  const tasks = Array.from(taskMap.values()).sort(
    (left, right) => left.orderIndex - right.orderIndex
  )
  const taskOrderMap = new Map(tasks.map((task, index) => [task.key, index]))

  const attemptNumberBySubmission = new Map<string, number>()
  const attemptCounts = new Map<string, number>()
  for (const submission of submissions) {
    const key = `${submission.studentId}:${submission.chapterKey}:${submission.levelKey}`
    const attemptNumber = (attemptCounts.get(key) ?? 0) + 1
    attemptCounts.set(key, attemptNumber)
    attemptNumberBySubmission.set(submission.id, attemptNumber)
  }

  const sortedSubmissions = [...submissions].sort((left, right) => {
    const taskOrder =
      (taskOrderMap.get(left.chapterKey) ?? Number.MAX_SAFE_INTEGER) -
      (taskOrderMap.get(right.chapterKey) ?? Number.MAX_SAFE_INTEGER)
    if (taskOrder !== 0) {
      return taskOrder
    }

    const leftStudent = studentMap.get(left.studentId)
    const rightStudent = studentMap.get(right.studentId)
    const usernameOrder = (leftStudent?.username ?? '').localeCompare(
      rightStudent?.username ?? ''
    )
    if (usernameOrder !== 0) {
      return usernameOrder
    }

    const task = taskMap.get(left.chapterKey)
    const levelOrder =
      (task?.levelMap.get(left.levelKey)?.orderIndex ?? Number.MAX_SAFE_INTEGER) -
      (task?.levelMap.get(right.levelKey)?.orderIndex ?? Number.MAX_SAFE_INTEGER)
    if (levelOrder !== 0) {
      return levelOrder
    }

    return left.submittedAt.getTime() - right.submittedAt.getTime()
  })

  const workbook = XLSX.utils.book_new()
  const taskSummaryRows = [
    [
      '序号',
      '代码闯关任务',
      '任务Key',
      '关卡数',
      '参与学生数',
      '提交次数',
      '通过次数',
      '获得积分次数',
      '积分合计',
    ],
    ...tasks.map((task, index) => {
      const taskSubmissions = submissions.filter(
        (submission) => submission.chapterKey === task.key
      )
      return [
        index + 1,
        task.title,
        task.key,
        task.levelCount,
        new Set(taskSubmissions.map((submission) => submission.studentId)).size,
        taskSubmissions.length,
        taskSubmissions.filter((submission) => submission.isPassed).length,
        taskSubmissions.filter((submission) => submission.pointsAwarded > 0).length,
        roundToOneDecimal(
          taskSubmissions.reduce(
            (sum, submission) => sum + submission.pointsAwarded,
            0
          )
        ),
      ]
    }),
  ]
  XLSX.utils.book_append_sheet(
    workbook,
    createExportWorksheet(taskSummaryRows, {
      columnWidths: [8, 24, 30, 10, 14, 12, 12, 16, 12],
      numberFormats: {
        0: '0',
        2: '@',
        3: '0',
        4: '0',
        5: '0',
        6: '0',
        7: '0',
        8: '0.0',
      },
    }),
    '任务积分汇总'
  )

  const studentTaskSummaryMap = new Map<
    string,
    {
      studentId: string
      chapterKey: string
      submissionCount: number
      passedSubmissionCount: number
      passedLevelKeys: Set<string>
      awardedCount: number
      points: number
    }
  >()
  for (const submission of submissions) {
    const key = `${submission.studentId}:${submission.chapterKey}`
    const summary = studentTaskSummaryMap.get(key) ?? {
      studentId: submission.studentId,
      chapterKey: submission.chapterKey,
      submissionCount: 0,
      passedSubmissionCount: 0,
      passedLevelKeys: new Set<string>(),
      awardedCount: 0,
      points: 0,
    }
    summary.submissionCount += 1
    if (submission.isPassed) {
      summary.passedSubmissionCount += 1
      summary.passedLevelKeys.add(submission.levelKey)
    }
    if (submission.pointsAwarded > 0) {
      summary.awardedCount += 1
    }
    summary.points += submission.pointsAwarded
    studentTaskSummaryMap.set(key, summary)
  }

  const studentTaskSummaries = Array.from(studentTaskSummaryMap.values()).sort(
    (left, right) => {
      const leftStudent = studentMap.get(left.studentId)
      const rightStudent = studentMap.get(right.studentId)
      return (
        (leftStudent?.username ?? '').localeCompare(rightStudent?.username ?? '') ||
        (taskOrderMap.get(left.chapterKey) ?? Number.MAX_SAFE_INTEGER) -
          (taskOrderMap.get(right.chapterKey) ?? Number.MAX_SAFE_INTEGER)
      )
    }
  )
  const studentTaskRows = [
    [
      '序号',
      '姓名',
      '用户名',
      '班级',
      '代码闯关任务',
      '任务Key',
      '提交次数',
      '通过提交次数',
      '已通关关卡数',
      '获得积分次数',
      '任务积分合计',
    ],
    ...studentTaskSummaries.map((summary, index) => {
      const student = studentMap.get(summary.studentId)
      const task = taskMap.get(summary.chapterKey)
      return [
        index + 1,
        student?.name ?? '',
        student?.username ?? '',
        student?.className ?? '',
        task?.title ?? summary.chapterKey,
        summary.chapterKey,
        summary.submissionCount,
        summary.passedSubmissionCount,
        summary.passedLevelKeys.size,
        summary.awardedCount,
        roundToOneDecimal(summary.points),
      ]
    }),
  ]
  XLSX.utils.book_append_sheet(
    workbook,
    createExportWorksheet(studentTaskRows, {
      columnWidths: [8, 14, 20, 18, 24, 30, 12, 16, 16, 16, 16],
      numberFormats: {
        0: '0',
        2: '@',
        5: '@',
        6: '0',
        7: '0',
        8: '0',
        9: '0',
        10: '0.0',
      },
    }),
    '学生任务汇总'
  )

  const usedSheetNames = new Set(['任务积分汇总', '学生任务汇总'])
  tasks.forEach((task, taskIndex) => {
    const taskSubmissions = sortedSubmissions.filter(
      (submission) => submission.chapterKey === task.key
    )
    const taskRows = [
      [
        '序号',
        '姓名',
        '用户名',
        '班级',
        '关卡',
        '关卡Key',
        '关卡设置积分',
        '本关第几次提交',
        '是否通过',
        '是否首次通关得分',
        '本次获得积分',
        '提交时间',
        '判题信息',
      ],
      ...taskSubmissions.map((submission, index) => {
        const student = studentMap.get(submission.studentId)
        const level = task.levelMap.get(submission.levelKey)
        return [
          index + 1,
          student?.name ?? '',
          student?.username ?? '',
          student?.className ?? '',
          level?.title ?? `历史关卡（${submission.levelKey}）`,
          submission.levelKey,
          level?.points ?? '',
          attemptNumberBySubmission.get(submission.id) ?? '',
          submission.isPassed ? '是' : '否',
          submission.pointsAwarded > 0 ? '是' : '否',
          roundToOneDecimal(submission.pointsAwarded),
          formatAppDateTime(submission.submittedAt),
          submission.judgeMessage,
        ]
      }),
    ]
    const worksheet = createExportWorksheet(taskRows, {
      columnWidths: [8, 14, 20, 18, 34, 30, 14, 16, 12, 20, 16, 22, 42],
      numberFormats: { 0: '0', 2: '@', 5: '@', 6: '0.0', 7: '0', 10: '0.0' },
    })
    const sheetName = makeUniqueWorksheetName(
      `${String(taskIndex + 1).padStart(2, '0')}-${task.title}`,
      usedSheetNames,
      `任务${taskIndex + 1}`
    )
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  })

  return workbook
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')?.trim() || ''
  const workbook = await buildChallengePointsExportWorkbook(query)

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
