import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  TRAINING_ATTEMPT_STATUSES,
  TRAINING_SET_STATUSES,
  UNASSIGNED_CLASS_FILTER,
} from '@/lib/constants'
import { getChallengeChapter, getChallengeLevel } from '@/lib/challenges/registry'
import type { GodotChallengeExecutionInput } from '@/lib/challenges/service'
import {
  EXAM_OBJECTIVE_TYPES,
  buildPublicJudge,
  judgeExamProgramExecution,
  listExamChallengeOptions,
  parseJudgeConfig,
} from '@/lib/exams'
import {
  evaluateQuestionAnswer,
  getQuestionOptionEntries,
  matchClassFilter,
  parseJson,
  serializeJson,
  shuffleArray,
} from '@/lib/quiz'
import { getTeacherClassOptions } from '@/lib/practice'

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

async function recalculateTrainingAttemptScoreWithTx(
  tx: Prisma.TransactionClient,
  attemptId: string
) {
  const attempt = await tx.trainingAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: { trainingSetId: true, studentId: true },
  })

  const [objectiveResponses, programQuestions, passedProgramRows] = await Promise.all([
    tx.trainingObjectiveResponse.findMany({
      where: { attemptId },
      select: { awardedScore: true },
    }),
    tx.trainingProgramQuestion.findMany({
      where: { trainingSetId: attempt.trainingSetId },
      select: { id: true, score: true },
    }),
    tx.trainingProgramSubmission.findMany({
      where: {
        attemptId,
        studentId: attempt.studentId,
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

  await tx.trainingAttempt.update({
    where: { id: attemptId },
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

export async function getTeacherTrainingDashboard(teacherId: string) {
  const [papers, trainingSets, classOptions] = await Promise.all([
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
    prisma.trainingSet.findMany({
      where: { teacherId },
      include: {
        _count: {
          select: {
            objectiveQuestions: true,
            programQuestions: true,
            attempts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    getTeacherClassOptions(),
  ])

  return {
    papers,
    trainingSets,
    classOptions,
    challengeOptions: listExamChallengeOptions(),
  }
}

export async function createTrainingSet(
  teacherId: string,
  input: {
    title: string
    description?: string
    className: string
    paperId: string
    programQuestions: Array<{ chapterKey: string; levelKey: string; score?: number }>
  }
) {
  const title = input.title.trim()
  const className = input.className.trim()

  if (!title) {
    throw new Error('请填写训练名称')
  }
  if (!className) {
    throw new Error('请选择班级')
  }
  if (!input.paperId.trim()) {
    throw new Error('请选择客观题试卷')
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
    throw new Error('训练至少需要一道单选、代码理解、多选或判断题')
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

  return prisma.trainingSet.create({
    data: {
      teacherId,
      title,
      description: input.description?.trim() || null,
      className,
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

export async function createTrainingSets(
  teacherId: string,
  input: {
    title: string
    description?: string
    classNames: string[]
    paperId: string
    programQuestions: Array<{ chapterKey: string; levelKey: string; score?: number }>
  }
) {
  const classNames = Array.from(
    new Set(input.classNames.map((className) => className.trim()).filter(Boolean))
  )

  if (classNames.length === 0) {
    throw new Error('请选择班级')
  }

  const trainingSets = []
  for (const className of classNames) {
    trainingSets.push(
      await createTrainingSet(teacherId, {
        title: input.title,
        description: input.description,
        className,
        paperId: input.paperId,
        programQuestions: input.programQuestions,
      })
    )
  }

  return trainingSets
}

export async function applyTeacherTrainingAction(
  teacherId: string,
  trainingSetId: string,
  action: string
) {
  const trainingSet = await prisma.trainingSet.findFirst({
    where: { id: trainingSetId, teacherId },
    select: { id: true },
  })
  if (!trainingSet) {
    throw new Error('训练任务不存在')
  }

  const now = new Date()
  if (action === 'PUBLISH') {
    return prisma.trainingSet.update({
      where: { id: trainingSet.id },
      data: {
        status: TRAINING_SET_STATUSES.PUBLISHED,
        publishedAt: now,
        archivedAt: null,
      },
    })
  }

  if (action === 'ARCHIVE') {
    return prisma.trainingSet.update({
      where: { id: trainingSet.id },
      data: {
        status: TRAINING_SET_STATUSES.ARCHIVED,
        archivedAt: now,
      },
    })
  }

  if (action === 'DRAFT') {
    return prisma.trainingSet.update({
      where: { id: trainingSet.id },
      data: {
        status: TRAINING_SET_STATUSES.DRAFT,
        publishedAt: null,
        archivedAt: null,
      },
    })
  }

  throw new Error('不支持的操作')
}

export async function deleteTrainingSet(teacherId: string, trainingSetId: string) {
  const trainingSet = await prisma.trainingSet.findFirst({
    where: { id: trainingSetId, teacherId },
    include: {
      _count: {
        select: {
          attempts: true,
          objectiveResponses: true,
          programSubmissions: true,
        },
      },
    },
  })

  if (!trainingSet) {
    throw new Error('训练任务不存在')
  }

  if (
    trainingSet._count.attempts > 0 ||
    trainingSet._count.objectiveResponses > 0 ||
    trainingSet._count.programSubmissions > 0
  ) {
    throw new Error('已有学生练习记录，不能删除该训练任务')
  }

  await prisma.trainingSet.delete({ where: { id: trainingSet.id } })
}

export async function getTeacherTrainingAnalytics(teacherId: string, trainingSetId: string) {
  const trainingSet = await prisma.trainingSet.findFirst({
    where: { id: trainingSetId, teacherId },
    include: {
      objectiveQuestions: {
        orderBy: { orderIndex: 'asc' },
      },
      programQuestions: {
        orderBy: { orderIndex: 'asc' },
      },
      attempts: {
        include: {
          student: {
            select: {
              id: true,
              username: true,
              name: true,
              className: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      },
    },
  })

  if (!trainingSet) {
    return null
  }

  const students = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      ...getStudentClassQuery(trainingSet.className),
    },
    select: {
      id: true,
      username: true,
      name: true,
      className: true,
    },
    orderBy: [{ name: 'asc' }, { username: 'asc' }],
  })

  const [objectiveResponses, programSubmissions] = await Promise.all([
    prisma.trainingObjectiveResponse.findMany({
      where: { trainingSetId },
      select: {
        questionId: true,
        isCorrect: true,
      },
    }),
    prisma.trainingProgramSubmission.findMany({
      where: { trainingSetId },
      select: {
        questionId: true,
        isPassed: true,
      },
    }),
  ])

  const attemptsByStudent = new Map<string, typeof trainingSet.attempts>()
  for (const attempt of trainingSet.attempts) {
    const rows = attemptsByStudent.get(attempt.studentId) || []
    rows.push(attempt)
    attemptsByStudent.set(attempt.studentId, rows)
  }

  const roster = students.map((student) => {
    const attempts = attemptsByStudent.get(student.id) || []
    const completedAttempts = attempts.filter(
      (attempt) => attempt.status === TRAINING_ATTEMPT_STATUSES.COMPLETED
    )
    const latestAttempt = attempts[0] || null
    const bestScore = completedAttempts.reduce(
      (best, attempt) => Math.max(best, attempt.totalScore),
      0
    )

    return {
      student,
      attemptCount: attempts.length,
      completedCount: completedAttempts.length,
      bestScore,
      latestScore: latestAttempt?.totalScore ?? null,
      latestAt: latestAttempt?.completedAt || latestAttempt?.startedAt || null,
      latestStatus: latestAttempt?.status || null,
    }
  })

  const objectiveStats = trainingSet.objectiveQuestions.map((question) => {
    const rows = objectiveResponses.filter((response) => response.questionId === question.id)
    const correctCount = rows.filter((response) => response.isCorrect).length
    return {
      id: question.id,
      title: `客观题 ${question.orderIndex + 1}`,
      content: question.content,
      score: question.score,
      submitCount: rows.length,
      correctCount,
      wrongCount: rows.length - correctCount,
      correctRate: rows.length > 0 ? correctCount / rows.length : null,
    }
  })

  const programStats = trainingSet.programQuestions.map((question) => {
    const rows = programSubmissions.filter((submission) => submission.questionId === question.id)
    const passedCount = rows.filter((submission) => submission.isPassed).length
    return {
      id: question.id,
      title: question.title,
      content: question.description,
      score: question.score,
      submitCount: rows.length,
      correctCount: passedCount,
      wrongCount: rows.length - passedCount,
      correctRate: rows.length > 0 ? passedCount / rows.length : null,
    }
  })

  return {
    trainingSet,
    totalObjectiveScore: trainingSet.objectiveQuestions.reduce(
      (total, question) => total + question.score,
      0
    ),
    totalProgramScore: trainingSet.programQuestions.reduce(
      (total, question) => total + question.score,
      0
    ),
    roster,
    questionStats: [...objectiveStats, ...programStats].sort(
      (left, right) => right.wrongCount - left.wrongCount
    ),
  }
}

export async function getStudentTrainingHome(studentId: string) {
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: 'STUDENT' },
    select: { id: true, className: true },
  })
  if (!student) {
    return []
  }

  const trainingSets = await prisma.trainingSet.findMany({
    where: {
      status: TRAINING_SET_STATUSES.PUBLISHED,
      OR: [
        { className: normalizeClassName(student.className) },
        ...(normalizeClassName(student.className) ? [] : [{ className: UNASSIGNED_CLASS_FILTER }]),
      ],
    },
    include: {
      _count: {
        select: {
          objectiveQuestions: true,
          programQuestions: true,
        },
      },
      attempts: {
        where: { studentId },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  })

  return trainingSets.map((trainingSet) => {
    const completedAttempts = trainingSet.attempts.filter(
      (attempt) => attempt.status === TRAINING_ATTEMPT_STATUSES.COMPLETED
    )
    return {
      id: trainingSet.id,
      title: trainingSet.title,
      description: trainingSet.description,
      className: trainingSet.className,
      publishedAt: trainingSet.publishedAt,
      objectiveQuestionCount: trainingSet._count.objectiveQuestions,
      programQuestionCount: trainingSet._count.programQuestions,
      attemptCount: trainingSet.attempts.length,
      bestScore: completedAttempts.reduce(
        (best, attempt) => Math.max(best, attempt.totalScore),
        0
      ),
      latestAttempt: trainingSet.attempts[0] || null,
    }
  })
}

async function assertStudentCanUseTrainingSet(studentId: string, trainingSetId: string) {
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: 'STUDENT' },
    select: { id: true, className: true },
  })
  if (!student) {
    throw new Error('学生不存在')
  }

  const trainingSet = await prisma.trainingSet.findUnique({
    where: { id: trainingSetId },
    include: {
      objectiveQuestions: {
        orderBy: { orderIndex: 'asc' },
      },
      programQuestions: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  })
  if (!trainingSet || !matchClassFilter(student.className, trainingSet.className)) {
    throw new Error('训练任务不存在')
  }
  if (trainingSet.status !== TRAINING_SET_STATUSES.PUBLISHED) {
    throw new Error('训练任务未发布')
  }

  return { student, trainingSet }
}

export async function startStudentTrainingAttempt(studentId: string, trainingSetId: string) {
  const { trainingSet } = await assertStudentCanUseTrainingSet(studentId, trainingSetId)
  const objectiveQuestionIds = shuffleArray(
    trainingSet.objectiveQuestions.map((question) => question.id)
  )
  const optionOrder = Object.fromEntries(
    trainingSet.objectiveQuestions.map((question) => [
      question.id,
      shuffleArray(getQuestionOptionEntries(question).map((item) => item.key)),
    ])
  )

  return prisma.trainingAttempt.create({
    data: {
      trainingSetId,
      studentId,
      questionOrder: serializeJson(objectiveQuestionIds),
      optionOrder: serializeJson(optionOrder),
    },
  })
}

export async function getStudentTrainingAttemptView(studentId: string, attemptId: string) {
  const attempt = await prisma.trainingAttempt.findFirst({
    where: {
      id: attemptId,
      studentId,
    },
    include: {
      trainingSet: {
        include: {
          objectiveQuestions: {
            orderBy: { orderIndex: 'asc' },
          },
          programQuestions: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
      objectiveResponses: true,
      programSubmissions: {
        orderBy: { submittedAt: 'desc' },
      },
    },
  })

  if (!attempt) {
    return null
  }
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { className: true },
  })
  if (!matchClassFilter(student?.className || null, attempt.trainingSet.className)) {
    return null
  }

  const responseMap = new Map(
    attempt.objectiveResponses.map((response) => [response.questionId, response] as const)
  )
  const questionOrder = parseJson<string[]>(attempt.questionOrder, []) || []
  const optionOrder = parseJson<Record<string, string[]>>(attempt.optionOrder, {}) || {}
  const orderedObjectiveQuestions = questionOrder
    .map((questionId) =>
      attempt.trainingSet.objectiveQuestions.find((question) => question.id === questionId)
    )
    .filter(
      (question): question is (typeof attempt.trainingSet.objectiveQuestions)[number] =>
        Boolean(question)
    )
    .map((question) => {
      const response = responseMap.get(question.id)
      const optionKeys =
        optionOrder[question.id] || getQuestionOptionEntries(question).map((item) => item.key)
      const optionMap = new Map(
        getQuestionOptionEntries(question).map((item) => [item.key, item.value] as const)
      )

      return {
        id: question.id,
        content: question.content,
        type: question.type,
        score: question.score,
        options: optionKeys
          .map((key) => ({ key, value: optionMap.get(key) || '' }))
          .filter((item) => item.value),
        submittedAnswer: response?.answer || '',
        isCorrect: response?.isCorrect ?? null,
        awardedScore: response?.awardedScore ?? null,
        correctAnswer: response ? question.answer : null,
      }
    })

  const latestProgramSubmissionByQuestionId = new Map<string, (typeof attempt.programSubmissions)[number]>()
  const passedProgramQuestionIds = new Set<string>()
  for (const submission of attempt.programSubmissions) {
    if (!latestProgramSubmissionByQuestionId.has(submission.questionId)) {
      latestProgramSubmissionByQuestionId.set(submission.questionId, submission)
    }
    if (submission.isPassed) {
      passedProgramQuestionIds.add(submission.questionId)
    }
  }

  const programQuestions = attempt.trainingSet.programQuestions.map((question) => {
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
    trainingSet: {
      id: attempt.trainingSet.id,
      title: attempt.trainingSet.title,
      description: attempt.trainingSet.description,
      status: attempt.trainingSet.status,
    },
    attempt: {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      objectiveScore: attempt.objectiveScore,
      programScore: attempt.programScore,
      totalScore: attempt.totalScore,
    },
    objectiveQuestions: orderedObjectiveQuestions,
    programQuestions,
  }
}

async function assertTrainingAttemptWritable(studentId: string, attemptId: string) {
  const attempt = await prisma.trainingAttempt.findFirst({
    where: {
      id: attemptId,
      studentId,
    },
    include: {
      trainingSet: true,
    },
  })
  if (!attempt) {
    throw new Error('练习记录不存在')
  }
  if (attempt.trainingSet.status !== TRAINING_SET_STATUSES.PUBLISHED) {
    throw new Error('训练任务已下架')
  }
  if (attempt.status !== TRAINING_ATTEMPT_STATUSES.IN_PROGRESS) {
    throw new Error('本次练习已完成')
  }

  return attempt
}

export async function submitTrainingObjectiveAnswer(
  studentId: string,
  attemptId: string,
  input: {
    questionId: string
    answer: string
  }
) {
  const attempt = await assertTrainingAttemptWritable(studentId, attemptId)
  const question = await prisma.trainingObjectiveQuestion.findFirst({
    where: {
      id: input.questionId,
      trainingSetId: attempt.trainingSetId,
    },
  })
  if (!question) {
    throw new Error('题目不存在')
  }

  const answer = input.answer.trim()
  if (!answer) {
    throw new Error('请选择答案')
  }

  const isCorrect = evaluateQuestionAnswer(question, answer)
  const awardedScore = isCorrect ? question.score : 0

  const score = await prisma.$transaction(async (tx) => {
    const existingResponse = await tx.trainingObjectiveResponse.findUnique({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId: question.id,
        },
      },
      select: { id: true },
    })

    if (existingResponse) {
      throw new Error('本题已提交，不能修改答案')
    }

    await tx.trainingObjectiveResponse.create({
      data: {
        trainingSetId: attempt.trainingSetId,
        attemptId,
        studentId,
        questionId: question.id,
        answer,
        isCorrect,
        awardedScore,
      },
    })

    return recalculateTrainingAttemptScoreWithTx(tx, attemptId)
  })

  return {
    isCorrect,
    awardedScore,
    correctAnswer: question.answer,
    score,
  }
}

export async function submitTrainingProgramAnswer(
  studentId: string,
  attemptId: string,
  input: {
    questionId: string
    code: string
    execution: GodotChallengeExecutionInput
  }
) {
  const attempt = await assertTrainingAttemptWritable(studentId, attemptId)
  const question = await prisma.trainingProgramQuestion.findFirst({
    where: {
      id: input.questionId,
      trainingSetId: attempt.trainingSetId,
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
    await tx.trainingProgramSubmission.create({
      data: {
        trainingSetId: attempt.trainingSetId,
        attemptId,
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

    const score = await recalculateTrainingAttemptScoreWithTx(tx, attemptId)
    return {
      ...judgeResult,
      awardedScore,
      score,
    }
  })
}

export async function completeTrainingAttempt(studentId: string, attemptId: string) {
  await assertTrainingAttemptWritable(studentId, attemptId)
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const score = await recalculateTrainingAttemptScoreWithTx(tx, attemptId)
    await tx.trainingAttempt.update({
      where: { id: attemptId },
      data: {
        status: TRAINING_ATTEMPT_STATUSES.COMPLETED,
        completedAt: now,
      },
    })

    return score
  })
}
