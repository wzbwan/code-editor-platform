import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  EXAM_EVENT_TYPES,
  EXAM_STATUSES,
  EXAM_STUDENT_STATUSES,
  QUESTION_TYPES,
  UNASSIGNED_CLASS_FILTER,
} from '@/lib/constants'
import { getAllChallengeChapters, getChallengeChapter, getChallengeLevel } from '@/lib/challenges/registry'
import type { ChallengeJudgeConfig, ChallengeJudgeResult, ChallengeValue } from '@/lib/challenges/types'
import {
  evaluateQuestionAnswer,
  getQuestionOptionEntries,
  matchClassFilter,
  parseJson,
  serializeJson,
  shuffleArray,
} from '@/lib/quiz'
import type { GodotChallengeExecutionInput } from '@/lib/challenges/service'

export const EXAM_OBJECTIVE_TYPES = [
  QUESTION_TYPES.SINGLE,
  QUESTION_TYPES.CODE_READING,
  QUESTION_TYPES.MULTIPLE,
  QUESTION_TYPES.JUDGE,
] as const

function normalizeClassName(value?: string | null) {
  return value?.trim() || ''
}

function getStudentClassQuery(className: string) {
  return className === UNASSIGNED_CLASS_FILTER
    ? {
        OR: [{ className: null }, { className: '' }],
      }
    : {
        className,
      }
}

function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, '\n').trim()
}

function isChallengeRecord(value: ChallengeValue): value is { [key: string]: ChallengeValue } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function challengeValuesEqual(left: ChallengeValue, right: ChallengeValue): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }
    return left.every((item, index) => challengeValuesEqual(item, right[index]))
  }

  if (isChallengeRecord(left) || isChallengeRecord(right)) {
    if (!isChallengeRecord(left) || !isChallengeRecord(right)) {
      return false
    }

    const leftKeys = Object.keys(left).sort()
    const rightKeys = Object.keys(right).sort()
    if (!challengeValuesEqual(leftKeys, rightKeys)) {
      return false
    }

    return leftKeys.every((key) => challengeValuesEqual(left[key], right[key]))
  }

  return left === right
}

function parseJudgeConfig(value: string): ChallengeJudgeConfig {
  return JSON.parse(value) as ChallengeJudgeConfig
}

function buildPublicJudge(judge: ChallengeJudgeConfig) {
  if (judge.mode === 'VARIABLES') {
    return {
      mode: 'VARIABLES' as const,
      variableNames: Object.keys(judge.expectedVariables),
    }
  }

  return {
    mode: 'OUTPUT' as const,
  }
}

function judgeExamProgramExecution(input: {
  judge: ChallengeJudgeConfig
  code: string
  execution: GodotChallengeExecutionInput
}): ChallengeJudgeResult {
  if (!input.code.trim()) {
    return {
      passed: false,
      message: '代码不能为空。',
      stdout: input.execution.stdout,
      stderr: input.execution.stderr,
    }
  }

  if (input.execution.timedOut) {
    return {
      passed: false,
      message: '代码执行超时，请检查是否出现死循环。',
      stdout: input.execution.stdout,
      stderr: input.execution.stderr,
    }
  }

  if (typeof input.execution.exitCode === 'number' && input.execution.exitCode !== 0) {
    return {
      passed: false,
      message: '代码未正常执行完成，请先修复运行错误。',
      stdout: input.execution.stdout,
      stderr: input.execution.stderr,
    }
  }

  if (input.judge.mode === 'VARIABLES') {
    if (!input.execution.variables) {
      return {
        passed: false,
        message: '缺少变量判题结果，请先运行代码。',
        stdout: input.execution.stdout,
        stderr: input.execution.stderr,
      }
    }

    for (const [variableName, expectedValue] of Object.entries(input.judge.expectedVariables)) {
      const actual = input.execution.variables[variableName]
      if (!actual || actual.missing) {
        return {
          passed: false,
          message: `缺少变量 ${variableName}，请按要求保存结果。`,
          stdout: input.execution.stdout,
          stderr: input.execution.stderr,
        }
      }

      if (actual.nonJson) {
        return {
          passed: false,
          message: `变量 ${variableName} 的结果无法判定，请使用基础类型或列表保存结果。`,
          stdout: input.execution.stdout,
          stderr: input.execution.stderr,
        }
      }

      if (!challengeValuesEqual((actual.value ?? null) as ChallengeValue, expectedValue)) {
        return {
          passed: false,
          message: `变量 ${variableName} 的结果不正确。`,
          stdout: input.execution.stdout,
          stderr: input.execution.stderr,
        }
      }
    }

    return {
      passed: true,
      message: '程序题通过，结果正确。',
      stdout: input.execution.stdout,
      stderr: input.execution.stderr,
    }
  }

  if (normalizeOutput(input.execution.stdout) !== normalizeOutput(input.judge.expectedOutput)) {
    return {
      passed: false,
      message: '输出结果不正确，请检查输出顺序和格式。',
      stdout: input.execution.stdout,
      stderr: input.execution.stderr,
    }
  }

  return {
    passed: true,
    message: '程序题通过，输出结果正确。',
    stdout: input.execution.stdout,
    stderr: input.execution.stderr,
  }
}

async function recalculateStudentExamScoreWithTx(
  tx: Prisma.TransactionClient,
  input: {
    examId: string
    studentId: string
  }
) {
  const [objectiveResponses, programQuestions, passedProgramRows] = await Promise.all([
    tx.examObjectiveResponse.findMany({
      where: {
        examId: input.examId,
        studentId: input.studentId,
      },
      select: { awardedScore: true },
    }),
    tx.examProgramQuestion.findMany({
      where: { examId: input.examId },
      select: { id: true, score: true },
    }),
    tx.examProgramSubmission.findMany({
      where: {
        examId: input.examId,
        studentId: input.studentId,
        isPassed: true,
      },
      select: { questionId: true },
    }),
  ])

  const objectiveScore = objectiveResponses.reduce(
    (total, response) => total + response.awardedScore,
    0
  )
  const passedQuestionIds = new Set(passedProgramRows.map((item) => item.questionId))
  const programScore = programQuestions.reduce(
    (total, question) => total + (passedQuestionIds.has(question.id) ? question.score : 0),
    0
  )

  await tx.examStudentSession.update({
    where: {
      examId_studentId: {
        examId: input.examId,
        studentId: input.studentId,
      },
    },
    data: {
      objectiveScore,
      programScore,
      totalScore: objectiveScore + programScore,
    },
  })

  return {
    objectiveScore,
    programScore,
    totalScore: objectiveScore + programScore,
  }
}

async function autoSubmitExpiredSessionIfNeeded(input: {
  examId: string
  studentId: string
  endsAt: Date
}) {
  if (Date.now() <= input.endsAt.getTime()) {
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.examStudentSession.updateMany({
      where: {
        examId: input.examId,
        studentId: input.studentId,
        submittedAt: null,
      },
      data: {
        status: EXAM_STUDENT_STATUSES.AUTO_SUBMITTED,
        submittedAt: input.endsAt,
        autoSubmittedAt: input.endsAt,
      },
    })

    await recalculateStudentExamScoreWithTx(tx, input)
  })
}

async function getOrCreateStudentExamSession(
  exam: {
    id: string
    objectiveQuestions: Array<{
      id: string
      type: string
      optionA: string | null
      optionB: string | null
      optionC: string | null
      optionD: string | null
    }>
  },
  studentId: string
) {
  const existing = await prisma.examStudentSession.findUnique({
    where: {
      examId_studentId: {
        examId: exam.id,
        studentId,
      },
    },
  })

  if (existing) {
    return existing
  }

  const questionOrder = shuffleArray(exam.objectiveQuestions.map((question) => question.id))
  const optionOrder = Object.fromEntries(
    exam.objectiveQuestions.map((question) => [
      question.id,
      shuffleArray(getQuestionOptionEntries(question).map((item) => item.key)),
    ])
  )

  return prisma.examStudentSession.create({
    data: {
      examId: exam.id,
      studentId,
      questionOrder: serializeJson(questionOrder),
      optionOrder: serializeJson(optionOrder),
      lastSeenAt: new Date(),
    },
  })
}

export function listExamChallengeOptions() {
  return getAllChallengeChapters().map((chapter) => ({
    key: chapter.key,
    title: chapter.title,
    levels: chapter.levels.map((level) => ({
      key: level.key,
      title: level.title,
      points: level.points,
    })),
  }))
}

export async function getTeacherExamDashboard(teacherId: string) {
  const [papers, exams, classOptions] = await Promise.all([
    prisma.practicePaper.findMany({
      where: { teacherId },
      include: {
        _count: {
          select: { questions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    prisma.exam.findMany({
      where: { teacherId },
      include: {
        _count: {
          select: {
            objectiveQuestions: true,
            programQuestions: true,
            studentSessions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    getTeacherExamClassOptions(),
  ])

  return {
    papers,
    exams,
    classOptions,
    challengeOptions: listExamChallengeOptions(),
  }
}

export async function getTeacherExamClassOptions() {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { className: true },
  })

  return Array.from(
    new Set(
      students.map((student) => normalizeClassName(student.className) || UNASSIGNED_CLASS_FILTER)
    )
  ).sort((left, right) => left.localeCompare(right))
}

export async function createExam(
  teacherId: string,
  input: {
    title: string
    description?: string
    className: string
    startsAt: Date
    endsAt: Date
    paperId: string
    programQuestions: Array<{ chapterKey: string; levelKey: string; score?: number }>
  }
) {
  const title = input.title.trim()
  const className = input.className.trim()

  if (!title) {
    throw new Error('请填写考试名称')
  }
  if (!className) {
    throw new Error('请选择班级')
  }
  if (!input.paperId.trim()) {
    throw new Error('请选择客观题试卷')
  }
  if (input.endsAt <= input.startsAt) {
    throw new Error('结束时间必须晚于开始时间')
  }

  const paper = await prisma.practicePaper.findFirst({
    where: {
      id: input.paperId,
      teacherId,
    },
    include: {
      questions: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  })

  if (!paper) {
    throw new Error('试卷不存在')
  }

  const objectiveQuestions = paper.questions.filter((question) =>
    EXAM_OBJECTIVE_TYPES.includes(question.type as (typeof EXAM_OBJECTIVE_TYPES)[number])
  )
  if (objectiveQuestions.length === 0) {
    throw new Error('考试至少需要一道单选、代码理解、多选或判断题')
  }

  const programSnapshots = input.programQuestions.map((item, index) => {
    const chapter = getChallengeChapter(item.chapterKey)
    const level = getChallengeLevel(item.chapterKey, item.levelKey)
    if (!chapter || !level) {
      throw new Error(`程序题 ${index + 1} 不存在`)
    }

    return {
      orderIndex: index,
      chapterKey: chapter.key,
      levelKey: level.key,
      chapterTitle: chapter.title,
      title: level.title,
      summary: level.summary,
      description: level.description,
      score:
        Number.isInteger(item.score) && Number(item.score) > 0
          ? Number(item.score)
          : level.points,
      initialCode: level.initialCode,
      judgeJson: JSON.stringify(level.judge),
    }
  })

  return prisma.exam.create({
    data: {
      teacherId,
      title,
      description: input.description?.trim() || null,
      className,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      objectiveQuestions: {
        create: objectiveQuestions.map((question, index) => ({
          orderIndex: index,
          content: question.content,
          type: question.type,
          score: question.score,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          answer: question.answer,
          scope: question.scope,
          sourcePaperQuestionId: question.id,
        })),
      },
      programQuestions: {
        create: programSnapshots,
      },
    },
  })
}

export async function getTeacherExamDetail(teacherId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      teacherId,
    },
    include: {
      objectiveQuestions: {
        orderBy: { orderIndex: 'asc' },
      },
      programQuestions: {
        orderBy: { orderIndex: 'asc' },
      },
      studentSessions: {
        include: {
          student: {
            select: {
              id: true,
              username: true,
              name: true,
              className: true,
            },
          },
          _count: {
            select: {
              events: true,
              programSubmissions: true,
            },
          },
        },
        orderBy: [{ submittedAt: 'asc' }, { startedAt: 'asc' }],
      },
    },
  })

  if (!exam) {
    return null
  }

  const students = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      ...getStudentClassQuery(exam.className),
    },
    select: {
      id: true,
      username: true,
      name: true,
      className: true,
    },
    orderBy: [{ name: 'asc' }, { username: 'asc' }],
  })

  const focusEvents = await prisma.examEvent.groupBy({
    by: ['studentId'],
    where: {
      examId,
      type: EXAM_EVENT_TYPES.FOCUS_LOST,
    },
    _count: { id: true },
  })
  const focusLostCountMap = new Map(focusEvents.map((item) => [item.studentId, item._count.id]))
  const sessionMap = new Map(exam.studentSessions.map((item) => [item.studentId, item]))
  const roster = students.map((student) => {
    const studentSession = sessionMap.get(student.id)
    return {
      student,
      session: studentSession || null,
      focusLostCount: focusLostCountMap.get(student.id) || studentSession?.focusLostCount || 0,
    }
  })

  return {
    exam,
    totalObjectiveScore: exam.objectiveQuestions.reduce((total, question) => total + question.score, 0),
    totalProgramScore: exam.programQuestions.reduce((total, question) => total + question.score, 0),
    roster,
  }
}

export async function applyTeacherExamAction(
  teacherId: string,
  examId: string,
  action: string
) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, teacherId },
    select: { id: true, startsAt: true, endsAt: true },
  })

  if (!exam) {
    throw new Error('考试不存在')
  }

  if (action === 'START') {
    const now = new Date()
    return prisma.exam.update({
      where: { id: exam.id },
      data: {
        status: EXAM_STATUSES.ACTIVE,
        startsAt: exam.startsAt > now ? now : exam.startsAt,
      },
    })
  }

  if (action === 'END') {
    const now = new Date()
    return prisma.exam.update({
      where: { id: exam.id },
      data: {
        status: EXAM_STATUSES.ENDED,
        endsAt: exam.endsAt > now ? now : exam.endsAt,
      },
    })
  }

  if (action === 'PUBLISH') {
    return prisma.exam.update({
      where: { id: exam.id },
      data: { scoresPublished: true },
    })
  }

  if (action === 'UNPUBLISH') {
    return prisma.exam.update({
      where: { id: exam.id },
      data: { scoresPublished: false },
    })
  }

  throw new Error('不支持的操作')
}

export async function deleteExam(teacherId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, teacherId },
    include: {
      _count: {
        select: {
          studentSessions: true,
          objectiveResponses: true,
          programSubmissions: true,
        },
      },
    },
  })

  if (!exam) {
    throw new Error('考试不存在')
  }

  if (
    exam._count.studentSessions > 0 ||
    exam._count.objectiveResponses > 0 ||
    exam._count.programSubmissions > 0
  ) {
    throw new Error('已有学生考试记录，不能删除该考试')
  }

  await prisma.exam.delete({ where: { id: exam.id } })
}

export async function getStudentActiveExam(studentId: string) {
  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: 'STUDENT',
    },
    select: { className: true },
  })

  if (!student) {
    return null
  }

  const now = new Date()
  return prisma.exam.findFirst({
    where: {
      status: EXAM_STATUSES.ACTIVE,
      startsAt: { lte: now },
      endsAt: { gt: now },
      OR: [
        { className: normalizeClassName(student.className) },
        ...(normalizeClassName(student.className) ? [] : [{ className: UNASSIGNED_CLASS_FILTER }]),
      ],
    },
    orderBy: { startsAt: 'desc' },
    select: {
      id: true,
      title: true,
      endsAt: true,
    },
  })
}

export async function getStudentExamView(studentId: string, examId: string) {
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: 'STUDENT' },
    select: {
      id: true,
      name: true,
      username: true,
      className: true,
    },
  })

  if (!student) {
    return null
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      objectiveQuestions: {
        orderBy: { orderIndex: 'asc' },
      },
      programQuestions: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  })

  if (!exam || !matchClassFilter(student.className, exam.className)) {
    return null
  }

  const now = new Date()
  const isOpen =
    exam.status === EXAM_STATUSES.ACTIVE &&
    exam.startsAt <= now &&
    exam.endsAt > now
  const canEnter = isOpen || exam.scoresPublished
  if (!canEnter) {
    return {
      exam: {
        id: exam.id,
        title: exam.title,
        status: exam.status,
        startsAt: exam.startsAt,
        endsAt: exam.endsAt,
        scoresPublished: exam.scoresPublished,
      },
      student,
      canEnter: false,
    }
  }

  const studentSession = await getOrCreateStudentExamSession(exam, studentId)
  await autoSubmitExpiredSessionIfNeeded({
    examId,
    studentId,
    endsAt: exam.endsAt,
  })

  const [freshStudentSession, objectiveResponses, latestProgramSubmissions] = await Promise.all([
    prisma.examStudentSession.findUniqueOrThrow({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
    }),
    prisma.examObjectiveResponse.findMany({
      where: { examId, studentId },
      select: {
        questionId: true,
        answer: true,
      },
    }),
    prisma.examProgramSubmission.findMany({
      where: { examId, studentId },
      orderBy: { submittedAt: 'desc' },
    }),
  ])

  const responseMap = new Map(objectiveResponses.map((response) => [response.questionId, response.answer] as const))
  const questionOrder = parseJson<string[]>(freshStudentSession.questionOrder, []) || []
  const optionOrder = parseJson<Record<string, string[]>>(freshStudentSession.optionOrder, {}) || {}
  const orderedObjectiveQuestions = questionOrder
    .map((questionId) => exam.objectiveQuestions.find((question) => question.id === questionId))
    .filter((question): question is (typeof exam.objectiveQuestions)[number] => Boolean(question))
    .map((question) => {
      const optionKeys = optionOrder[question.id] || getQuestionOptionEntries(question).map((item) => item.key)
      const optionMap = new Map(getQuestionOptionEntries(question).map((item) => [item.key, item.value] as const))

      return {
        id: question.id,
        content: question.content,
        type: question.type,
        score: question.score,
        options: optionKeys
          .map((key) => ({ key, value: optionMap.get(key) || '' }))
          .filter((item) => item.value),
        submittedAnswer: responseMap.get(question.id) || '',
      }
    })

  const latestProgramSubmissionByQuestionId = new Map<string, (typeof latestProgramSubmissions)[number]>()
  const passedProgramQuestionIds = new Set<string>()
  for (const submission of latestProgramSubmissions) {
    if (!latestProgramSubmissionByQuestionId.has(submission.questionId)) {
      latestProgramSubmissionByQuestionId.set(submission.questionId, submission)
    }
    if (submission.isPassed) {
      passedProgramQuestionIds.add(submission.questionId)
    }
  }

  const programQuestions = exam.programQuestions.map((question) => {
    const latestSubmission = latestProgramSubmissionByQuestionId.get(question.id)
    const judge = parseJudgeConfig(question.judgeJson)
    return {
      id: question.id,
      orderIndex: question.orderIndex,
      chapterTitle: question.chapterTitle,
      title: question.title,
      summary: question.summary,
      description: question.description,
      score: question.score,
      initialCode: latestSubmission?.code || question.initialCode,
      publicJudge: buildPublicJudge(judge),
      latestJudgeMessage: latestSubmission?.judgeMessage || null,
      latestStdout: latestSubmission?.stdout || null,
      latestStderr: latestSubmission?.stderr || null,
      latestSubmittedAt: latestSubmission?.submittedAt || null,
      isPassed: passedProgramQuestionIds.has(question.id),
    }
  })

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      status: exam.status,
      startsAt: exam.startsAt,
      endsAt: exam.endsAt,
      scoresPublished: exam.scoresPublished,
    },
    student,
    canEnter: true,
    isOpen,
    session: freshStudentSession,
    objectiveQuestions: orderedObjectiveQuestions,
    programQuestions,
  }
}

async function assertStudentExamWritable(studentId: string, examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      className: true,
      status: true,
      startsAt: true,
      endsAt: true,
    },
  })
  if (!exam) {
    throw new Error('考试不存在')
  }

  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: 'STUDENT',
      ...getStudentClassQuery(exam.className),
    },
    select: { id: true },
  })
  if (!student) {
    throw new Error('你不在本次考试班级范围内')
  }

  const now = new Date()
  if (exam.status !== EXAM_STATUSES.ACTIVE || exam.startsAt > now) {
    throw new Error('考试尚未开始')
  }

  const studentSession = await prisma.examStudentSession.findUnique({
    where: {
      examId_studentId: {
        examId,
        studentId,
      },
    },
  })
  if (!studentSession) {
    throw new Error('请先进入考试页面')
  }

  await autoSubmitExpiredSessionIfNeeded({
    examId,
    studentId,
    endsAt: exam.endsAt,
  })

  if (exam.endsAt <= now) {
    throw new Error('考试时间已结束')
  }

  if (studentSession.submittedAt) {
    throw new Error('试卷已提交，不能继续作答')
  }

  return { exam, studentSession }
}

export async function saveExamObjectiveAnswer(
  studentId: string,
  examId: string,
  input: {
    questionId: string
    answer: string
  }
) {
  const { studentSession } = await assertStudentExamWritable(studentId, examId)
  const question = await prisma.examObjectiveQuestion.findFirst({
    where: {
      id: input.questionId,
      examId,
    },
  })
  if (!question) {
    throw new Error('题目不存在')
  }

  const answer = input.answer.trim()
  const isCorrect = evaluateQuestionAnswer(question, answer)
  const awardedScore = isCorrect ? question.score : 0

  return prisma.$transaction(async (tx) => {
    await tx.examObjectiveResponse.upsert({
      where: {
        examId_studentId_questionId: {
          examId,
          studentId,
          questionId: question.id,
        },
      },
      update: {
        answer,
        isCorrect,
        awardedScore,
        submittedAt: new Date(),
      },
      create: {
        examId,
        studentSessionId: studentSession.id,
        studentId,
        questionId: question.id,
        answer,
        isCorrect,
        awardedScore,
      },
    })

    return recalculateStudentExamScoreWithTx(tx, { examId, studentId })
  })
}

export async function submitExamProgramAnswer(
  studentId: string,
  examId: string,
  input: {
    questionId: string
    code: string
    execution: GodotChallengeExecutionInput
  }
) {
  const { studentSession } = await assertStudentExamWritable(studentId, examId)
  const question = await prisma.examProgramQuestion.findFirst({
    where: {
      id: input.questionId,
      examId,
    },
  })
  if (!question) {
    throw new Error('程序题不存在')
  }

  const judgeResult = judgeExamProgramExecution({
    judge: parseJudgeConfig(question.judgeJson),
    code: input.code,
    execution: input.execution,
  })
  const awardedScore = judgeResult.passed ? question.score : 0

  return prisma.$transaction(async (tx) => {
    await tx.examProgramSubmission.create({
      data: {
        examId,
        studentSessionId: studentSession.id,
        studentId,
        questionId: question.id,
        code: input.code,
        isPassed: judgeResult.passed,
        judgeMessage: judgeResult.message,
        stdout: judgeResult.stdout || null,
        stderr: judgeResult.stderr || null,
        awardedScore,
      },
    })

    const score = await recalculateStudentExamScoreWithTx(tx, { examId, studentId })

    return {
      ...judgeResult,
      awardedScore,
      score,
    }
  })
}

export async function submitStudentExam(studentId: string, examId: string) {
  const { exam } = await assertStudentExamWritable(studentId, examId)
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    await tx.examStudentSession.update({
      where: {
        examId_studentId: {
          examId: exam.id,
          studentId,
        },
      },
      data: {
        status: EXAM_STUDENT_STATUSES.SUBMITTED,
        submittedAt: now,
      },
    })

    return recalculateStudentExamScoreWithTx(tx, { examId: exam.id, studentId })
  })
}

export async function recordStudentExamEvent(
  studentId: string,
  examId: string,
  input: {
    type: string
    payload?: unknown
  }
) {
  const eventType = input.type.trim()
  if (
    eventType !== EXAM_EVENT_TYPES.FOCUS_LOST &&
    eventType !== EXAM_EVENT_TYPES.FOCUS_RETURNED &&
    eventType !== EXAM_EVENT_TYPES.HEARTBEAT
  ) {
    throw new Error('事件类型非法')
  }

  const view = await getStudentExamView(studentId, examId)
  if (!view?.canEnter || !('session' in view) || !view.session) {
    throw new Error('考试不存在或不可进入')
  }
  const studentSession = view.session

  const now = new Date()
  return prisma.$transaction(async (tx) => {
    await tx.examEvent.create({
      data: {
        examId,
        studentSessionId: studentSession.id,
        studentId,
        type: eventType,
        payload:
          input.payload === undefined || input.payload === null
            ? null
            : JSON.stringify(input.payload).slice(0, 2000),
        occurredAt: now,
      },
    })

    await tx.examStudentSession.update({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
      data:
        eventType === EXAM_EVENT_TYPES.FOCUS_LOST
          ? {
              focusLostCount: { increment: 1 },
              firstFocusLostAt: studentSession.firstFocusLostAt || now,
              lastSeenAt: now,
            }
          : {
              lastSeenAt: now,
            },
    })

    return { success: true }
  })
}
