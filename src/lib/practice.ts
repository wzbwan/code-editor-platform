import { prisma } from '@/lib/prisma'
import {
  PRACTICE_MODES,
  PRACTICE_STATUSES,
  QUESTION_TYPES,
  UNASSIGNED_CLASS_FILTER,
} from '@/lib/constants'
import {
  calculateQuestionBonusMultiplier,
  evaluateQuestionAnswer,
  getQuestionOptionEntries,
  matchClassFilter,
  parseJson,
  serializeJson,
  shuffleArray,
  type ParsedQuestionInput,
} from '@/lib/quiz'
import { roundToOneDecimal } from '@/lib/point-format'
import { createStudentPointRecord, createStudentPointRecordWithTx } from '@/lib/student-points'

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

function getQuestionByIndex<T>(questions: T[], index: number) {
  return questions[index] || null
}

function getHalfDurationDeadline(startedAt: Date, durationMinutes: number) {
  return startedAt.getTime() + durationMinutes * 60 * 1000 * 0.5
}

export async function getTeacherClassOptions() {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: {
      className: true,
    },
  })

  return Array.from(
    new Set(
      students.map((student) => normalizeClassName(student.className) || UNASSIGNED_CLASS_FILTER)
    )
  ).sort((left, right) => left.localeCompare(right))
}

export async function getTeacherQuizDashboard(teacherId: string) {
  const [questions, papers, sessions, classOptions] = await Promise.all([
    prisma.questionBankItem.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.practicePaper.findMany({
      where: { teacherId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            questionBankId: true,
            content: true,
            type: true,
            score: true,
          },
        },
        _count: {
          select: {
            questions: true,
            sessions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.practiceSession.findMany({
      where: { teacherId },
      include: {
        paper: {
          select: {
            title: true,
          },
        },
        _count: {
          select: {
            students: true,
            responses: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    getTeacherClassOptions(),
  ])

  return {
    questions,
    papers,
    sessions,
    classOptions,
  }
}

export async function getTeacherPracticePaperDetail(teacherId: string, paperId: string) {
  return prisma.practicePaper.findFirst({
    where: {
      id: paperId,
      teacherId,
    },
    include: {
      questions: {
        orderBy: { orderIndex: 'asc' },
      },
      _count: {
        select: {
          questions: true,
          sessions: true,
        },
      },
    },
  })
}

export async function deleteQuestionBankItem(teacherId: string, questionId: string) {
  const question = await prisma.questionBankItem.findFirst({
    where: {
      id: questionId,
      teacherId,
    },
    select: {
      id: true,
    },
  })

  if (!question) {
    throw new Error('题目不存在')
  }

  await prisma.questionBankItem.delete({
    where: { id: question.id },
  })
}

export async function createQuestionBankItems(
  teacherId: string,
  rows: ParsedQuestionInput[]
) {
  if (rows.length === 0) {
    return []
  }

  return prisma.$transaction(
    rows.map((row) =>
      prisma.questionBankItem.create({
        data: {
          teacherId,
          content: row.content,
          type: row.type,
          score: row.score,
          optionA: row.optionA,
          optionB: row.optionB,
          optionC: row.optionC,
          optionD: row.optionD,
          answer: row.answer,
          scope: row.scope,
        },
      })
    )
  )
}

export async function createPracticePaperFromQuestionBank(
  teacherId: string,
  input: {
    title: string
    description?: string
    questionBankIds: string[]
  }
) {
  const questions = await prisma.questionBankItem.findMany({
    where: {
      teacherId,
      id: {
        in: input.questionBankIds,
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (questions.length === 0) {
    throw new Error('请选择至少一道题目')
  }

  return prisma.practicePaper.create({
    data: {
      teacherId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      questions: {
        create: questions.map((question, index) => ({
          orderIndex: index,
          questionBankId: question.id,
          content: question.content,
          type: question.type,
          score: question.score,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          answer: question.answer,
          scope: question.scope,
        })),
      },
    },
    include: {
      _count: {
        select: {
          questions: true,
        },
      },
    },
  })
}

export async function createPracticePaperFromImportedQuestions(
  teacherId: string,
  input: {
    title: string
    description?: string
    importToBank: boolean
    rows: ParsedQuestionInput[]
  }
) {
  if (input.rows.length === 0) {
    throw new Error('没有可导入的题目')
  }

  return prisma.$transaction(async (tx) => {
    const createdBankItems = input.importToBank
      ? await Promise.all(
          input.rows.map((row) =>
            tx.questionBankItem.create({
              data: {
                teacherId,
                content: row.content,
                type: row.type,
                score: row.score,
                optionA: row.optionA,
                optionB: row.optionB,
                optionC: row.optionC,
                optionD: row.optionD,
                answer: row.answer,
                scope: row.scope,
              },
            })
          )
        )
      : []

    return tx.practicePaper.create({
      data: {
        teacherId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        questions: {
          create: input.rows.map((row, index) => ({
            orderIndex: index,
            questionBankId: createdBankItems[index]?.id || null,
            content: row.content,
            type: row.type,
            score: row.score,
            optionA: row.optionA,
            optionB: row.optionB,
            optionC: row.optionC,
            optionD: row.optionD,
            answer: row.answer,
            scope: row.scope,
          })),
        },
      },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
    })
  })
}

export async function updatePracticePaper(
  teacherId: string,
  input: {
    paperId: string
    title?: string
    description?: string
    questionBankIds?: string[]
  }
) {
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

  const nextTitle = input.title?.trim()
  const nextDescription =
    input.description !== undefined ? input.description.trim() : undefined

  if (
    input.questionBankIds &&
    input.questionBankIds.length > 0
  ) {
    const sessionCount = await prisma.practiceSession.count({
      where: {
        paperId: paper.id,
      },
    })

    if (sessionCount > 0) {
      throw new Error('试卷已有练习记录，不能替换题目')
    }

    const questions = await prisma.questionBankItem.findMany({
      where: {
        teacherId,
        id: {
          in: input.questionBankIds,
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (questions.length === 0) {
      throw new Error('请选择至少一道题目')
    }

    return prisma.$transaction(async (tx) => {
      await tx.paperQuestion.deleteMany({
        where: { paperId: paper.id },
      })

      return tx.practicePaper.update({
        where: { id: paper.id },
        data: {
          title: nextTitle || paper.title,
          description:
            nextDescription !== undefined ? nextDescription || null : paper.description,
          questions: {
            create: questions.map((question, index) => ({
              orderIndex: index,
              questionBankId: question.id,
              content: question.content,
              type: question.type,
              score: question.score,
              optionA: question.optionA,
              optionB: question.optionB,
              optionC: question.optionC,
              optionD: question.optionD,
              answer: question.answer,
              scope: question.scope,
            })),
          },
        },
        include: {
          questions: {
            orderBy: { orderIndex: 'asc' },
            select: {
              id: true,
              questionBankId: true,
              content: true,
              type: true,
              score: true,
            },
          },
          _count: {
            select: {
              questions: true,
              sessions: true,
            },
          },
        },
      })
    })
  }

  return prisma.practicePaper.update({
    where: { id: paper.id },
    data: {
      title: nextTitle || paper.title,
      description:
        nextDescription !== undefined ? nextDescription || null : paper.description,
    },
    include: {
      questions: {
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          questionBankId: true,
          content: true,
          type: true,
          score: true,
        },
      },
      _count: {
        select: {
          questions: true,
          sessions: true,
        },
      },
    },
  })
}

export async function updatePracticePaperQuestion(
  teacherId: string,
  input: {
    paperId: string
    questionId: string
    content: string
    type: string
    score: number
    optionA?: string
    optionB?: string
    optionC?: string
    optionD?: string
    answer: string
    scope?: string
  }
) {
  const paper = await prisma.practicePaper.findFirst({
    where: {
      id: input.paperId,
      teacherId,
    },
    include: {
      _count: {
        select: {
          sessions: true,
        },
      },
      questions: {
        where: {
          id: input.questionId,
        },
        select: {
          id: true,
        },
      },
    },
  })

  if (!paper || paper.questions.length === 0) {
    throw new Error('题目不存在')
  }

  if (paper._count.sessions > 0) {
    throw new Error('试卷已有练习记录，不能再修改题目')
  }

  const content = input.content.trim()
  const answer = input.answer.trim()
  const scope = input.scope?.trim() || null

  if (!content) {
    throw new Error('请填写题目内容')
  }

  if (!answer) {
    throw new Error('请填写答案')
  }

  if (!Number.isInteger(input.score) || input.score <= 0) {
    throw new Error('分值必须是正整数')
  }

  return prisma.paperQuestion.update({
    where: { id: input.questionId },
    data: {
      content,
      type: input.type,
      score: input.score,
      optionA: input.optionA?.trim() || null,
      optionB: input.optionB?.trim() || null,
      optionC: input.optionC?.trim() || null,
      optionD: input.optionD?.trim() || null,
      answer,
      scope,
    },
  })
}

export async function deletePracticePaperQuestion(
  teacherId: string,
  paperId: string,
  questionId: string
) {
  const paper = await prisma.practicePaper.findFirst({
    where: {
      id: paperId,
      teacherId,
    },
    include: {
      _count: {
        select: {
          questions: true,
          sessions: true,
        },
      },
      questions: {
        where: {
          id: questionId,
        },
        select: {
          id: true,
        },
      },
    },
  })

  if (!paper || paper.questions.length === 0) {
    throw new Error('题目不存在')
  }

  if (paper._count.sessions > 0) {
    throw new Error('试卷已有练习记录，不能再删除题目')
  }

  if (paper._count.questions <= 1) {
    throw new Error('试卷至少需要保留一道题目')
  }

  await prisma.$transaction(async (tx) => {
    await tx.paperQuestion.delete({
      where: { id: questionId },
    })

    const remainingQuestions = await tx.paperQuestion.findMany({
      where: { paperId },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
      },
    })

    for (let index = 0; index < remainingQuestions.length; index += 1) {
      const question = remainingQuestions[index]
      await tx.paperQuestion.update({
        where: { id: question.id },
        data: {
          orderIndex: index,
        },
      })
    }
  })
}

export async function deletePracticePaper(teacherId: string, paperId: string) {
  const paper = await prisma.practicePaper.findFirst({
    where: {
      id: paperId,
      teacherId,
    },
    select: {
      id: true,
    },
  })

  if (!paper) {
    throw new Error('试卷不存在')
  }

  await prisma.practicePaper.delete({
    where: { id: paper.id },
  })
}

export async function createPracticeSession(
  teacherId: string,
  input: {
    paperId: string
    className: string
    mode: string
    durationMinutes?: number | null
  }
) {
  const paper = await prisma.practicePaper.findFirst({
    where: {
      id: input.paperId,
      teacherId,
    },
    include: {
      _count: {
        select: {
          questions: true,
        },
      },
    },
  })

  if (!paper) {
    throw new Error('试卷不存在')
  }

  if (paper._count.questions === 0) {
    throw new Error('试卷没有题目，无法开始练习')
  }

  if (
    input.mode === PRACTICE_MODES.PAPER &&
    (!input.durationMinutes || input.durationMinutes <= 0)
  ) {
    throw new Error('整卷练习必须设置答题时长')
  }

  return prisma.practiceSession.create({
    data: {
      teacherId,
      paperId: paper.id,
      className: input.className,
      mode: input.mode,
      durationMinutes:
        input.mode === PRACTICE_MODES.PAPER ? input.durationMinutes || null : null,
      status:
        input.mode === PRACTICE_MODES.PAPER
          ? PRACTICE_STATUSES.ACTIVE
          : PRACTICE_STATUSES.PENDING,
      startedAt:
        input.mode === PRACTICE_MODES.PAPER ? new Date() : null,
      questionStartedAt:
        input.mode === PRACTICE_MODES.QUESTION ? null : new Date(),
    },
  })
}

export async function getTeacherPracticeSessionView(teacherId: string, sessionId: string) {
  const session = await prisma.practiceSession.findFirst({
    where: {
      id: sessionId,
      teacherId,
    },
    include: {
      paper: {
        include: {
          questions: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
      students: {
        include: {
          student: {
            select: {
              id: true,
              username: true,
              name: true,
              className: true,
              pointBalance: true,
            },
          },
        },
        orderBy: { submittedAt: 'asc' },
      },
      responses: {
        include: {
          student: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
        orderBy: { submittedAt: 'asc' },
      },
    },
  })

  if (!session) {
    return null
  }

  const totalStudents = await prisma.user.count({
    where: {
      role: 'STUDENT',
      ...getStudentClassQuery(session.className),
    },
  })

  const currentQuestion = getQuestionByIndex(
    session.paper.questions,
    session.currentQuestionIndex
  )
  const currentQuestionResponses = currentQuestion
    ? session.responses.filter(
        (response) => response.paperQuestionId === currentQuestion.id
      )
    : []

  return {
    session,
    totalStudents,
    currentQuestion,
    currentQuestionResponses,
    submittedCount:
      session.mode === PRACTICE_MODES.PAPER
        ? session.students.filter((student) => student.submittedAt).length
        : currentQuestionResponses.length,
  }
}

export async function deletePracticeSession(teacherId: string, sessionId: string) {
  const session = await prisma.practiceSession.findFirst({
    where: {
      id: sessionId,
      teacherId,
    },
    include: {
      _count: {
        select: {
          responses: true,
        },
      },
    },
  })

  if (!session) {
    throw new Error('练习会话不存在')
  }

  if (session._count.responses > 0) {
    throw new Error('已有学生答题记录，不能删除该练习')
  }

  await prisma.practiceSession.delete({
    where: { id: session.id },
  })
}

export async function applyTeacherPracticeAction(
  teacherId: string,
  sessionId: string,
  action: string
) {
  const sessionView = await getTeacherPracticeSessionView(teacherId, sessionId)
  if (!sessionView) {
    throw new Error('练习会话不存在')
  }

  const { session, currentQuestion, totalStudents, currentQuestionResponses } = sessionView

  if (action === 'START_QUESTION') {
    if (session.mode !== PRACTICE_MODES.QUESTION) {
      throw new Error('当前不是逐题练习')
    }

    return prisma.practiceSession.update({
      where: { id: session.id },
      data: {
        status: PRACTICE_STATUSES.ACTIVE,
        startedAt: session.startedAt || new Date(),
        questionStartedAt: new Date(),
      },
    })
  }

  if (action === 'END_QUESTION') {
    if (session.mode !== PRACTICE_MODES.QUESTION || !currentQuestion) {
      throw new Error('当前没有可结束的题目')
    }

    const unsettledResponses = currentQuestionResponses.filter((response) => !response.settledAt)
    const correctResponses = unsettledResponses
      .filter((response) => response.isCorrect)
      .sort((left, right) => left.submittedAt.getTime() - right.submittedAt.getTime())

    const rankByResponseId = new Map(
      correctResponses.map((response, index) => [response.id, index + 1] as const)
    )

    for (const response of unsettledResponses) {
      const rank = rankByResponseId.get(response.id) || 0
      const multiplier = response.isCorrect
        ? calculateQuestionBonusMultiplier(rank, totalStudents)
        : 0
      const awardedPointDelta = multiplier
        ? roundToOneDecimal(currentQuestion.score * multiplier)
        : 0

      await prisma.practiceResponse.update({
        where: { id: response.id },
        data: {
          awardedPointDelta,
          settledAt: new Date(),
        },
      })

      if (awardedPointDelta > 0) {
        await createStudentPointRecord({
          studentId: response.studentId,
          delta: awardedPointDelta,
          reason: `逐题练习《${session.paper.title}》第 ${session.currentQuestionIndex + 1} 题答对奖励`,
          operatorId: teacherId,
        })
      }
    }

    return prisma.practiceSession.update({
      where: { id: session.id },
      data: {
        status: PRACTICE_STATUSES.REVIEW,
      },
    })
  }

  if (action === 'NEXT_QUESTION') {
    if (session.mode !== PRACTICE_MODES.QUESTION) {
      throw new Error('当前不是逐题练习')
    }

    const nextIndex = session.currentQuestionIndex + 1
    if (nextIndex >= session.paper.questions.length) {
      return prisma.practiceSession.update({
        where: { id: session.id },
        data: {
          status: PRACTICE_STATUSES.ENDED,
          endedAt: new Date(),
        },
      })
    }

    return prisma.practiceSession.update({
      where: { id: session.id },
      data: {
        currentQuestionIndex: nextIndex,
        status: PRACTICE_STATUSES.ACTIVE,
        questionStartedAt: new Date(),
      },
    })
  }

  if (action === 'END_SESSION') {
    return prisma.practiceSession.update({
      where: { id: session.id },
      data: {
        status: PRACTICE_STATUSES.ENDED,
        endedAt: new Date(),
      },
    })
  }

  throw new Error('不支持的操作')
}

async function getOrCreateStudentSession(sessionId: string, studentId: string) {
  const existing = await prisma.practiceSessionStudent.findUnique({
    where: {
      sessionId_studentId: {
        sessionId,
        studentId,
      },
    },
  })

  if (existing) {
    return existing
  }

  return prisma.practiceSessionStudent.create({
    data: {
      sessionId,
      studentId,
      startedAt: new Date(),
    },
  })
}

async function getOrCreatePaperStudentSession(
  session: {
    id: string
    paper: {
      questions: Array<{
        id: string
        optionA: string | null
        optionB: string | null
        optionC: string | null
        optionD: string | null
      }>
    }
  },
  studentId: string
) {
  const existing = await prisma.practiceSessionStudent.findUnique({
    where: {
      sessionId_studentId: {
        sessionId: session.id,
        studentId,
      },
    },
  })

  if (existing) {
    return existing
  }

  const randomizedQuestions = shuffleArray(
    session.paper.questions.map((question) => question.id)
  )
  const optionOrder = Object.fromEntries(
    session.paper.questions.map((question) => [
      question.id,
      shuffleArray(getQuestionOptionEntries(question).map((item) => item.key)),
    ])
  )

  return prisma.practiceSessionStudent.create({
    data: {
      sessionId: session.id,
      studentId,
      startedAt: new Date(),
      questionOrder: serializeJson(randomizedQuestions),
      optionOrder: serializeJson(optionOrder),
    },
  })
}

export async function getStudentActivePracticeView(studentId: string) {
  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: 'STUDENT',
    },
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

  const classFilter = normalizeClassName(student.className) || UNASSIGNED_CLASS_FILTER

  const sessions = await prisma.practiceSession.findMany({
    where: {
      status: {
        in: [PRACTICE_STATUSES.ACTIVE, PRACTICE_STATUSES.REVIEW],
      },
    },
    include: {
      paper: {
        include: {
          questions: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 20,
  })

  const session =
    sessions.find((item) => matchClassFilter(student.className, item.className)) || null

  if (!session) {
    return null
  }

  if (session.mode === PRACTICE_MODES.QUESTION) {
    const currentQuestion = getQuestionByIndex(
      session.paper.questions,
      session.currentQuestionIndex
    )
    if (!currentQuestion || session.status !== PRACTICE_STATUSES.ACTIVE) {
      return {
        session,
        mode: session.mode,
        student,
        question: null,
        totalQuestions: session.paper.questions.length,
        currentQuestionIndex: session.currentQuestionIndex,
        hasSubmitted: false,
      }
    }

    const response = await prisma.practiceResponse.findUnique({
      where: {
        sessionId_studentId_paperQuestionId: {
          sessionId: session.id,
          studentId,
          paperQuestionId: currentQuestion.id,
        },
      },
      select: {
        answer: true,
      },
    })

    return {
      session,
      mode: session.mode,
      student,
      question: {
        ...currentQuestion,
        options: getQuestionOptionEntries(currentQuestion),
        submittedAnswer: response?.answer || '',
      },
      totalQuestions: session.paper.questions.length,
      currentQuestionIndex: session.currentQuestionIndex,
      hasSubmitted: Boolean(response),
    }
  }

  const studentSession = await getOrCreatePaperStudentSession(session, studentId)
  const questionOrder = parseJson<string[]>(studentSession.questionOrder, []) || []
  const optionOrder =
    parseJson<Record<string, string[]>>(studentSession.optionOrder, {}) || {}
  const responses = await prisma.practiceResponse.findMany({
    where: {
      sessionId: session.id,
      studentId,
    },
    select: {
      paperQuestionId: true,
      answer: true,
    },
  })
  const responseMap = new Map(
    responses.map((response) => [response.paperQuestionId, response.answer] as const)
  )
  const orderedQuestions = questionOrder
    .map((questionId) =>
      session.paper.questions.find((question) => question.id === questionId)
    )
    .filter(
      (
        question
      ): question is (typeof session.paper.questions)[number] => Boolean(question)
    )
    .map((question) => {
      const optionKeys = optionOrder[question.id] || getQuestionOptionEntries(question).map((item) => item.key)
      const optionMap = new Map(getQuestionOptionEntries(question).map((item) => [item.key, item.value] as const))

      return {
        ...question,
        options: optionKeys
          .map((key) => ({
            key,
            value: optionMap.get(key) || '',
          }))
          .filter((item) => item.value),
        submittedAnswer: responseMap.get(question.id) || '',
      }
    })

  return {
    session,
    mode: session.mode,
    student,
    hasSubmitted: Boolean(studentSession.submittedAt),
    deadlineAt:
      session.startedAt && session.durationMinutes
        ? new Date(session.startedAt.getTime() + session.durationMinutes * 60 * 1000)
        : null,
    rawScore: studentSession.rawScore,
    finalScore: studentSession.finalScore,
    bonusMultiplier: studentSession.bonusMultiplier,
    questions: orderedQuestions,
  }
}

export async function submitQuestionPracticeAnswer(
  studentId: string,
  sessionId: string,
  answer: string
) {
  const session = await prisma.practiceSession.findFirst({
    where: {
      id: sessionId,
      mode: PRACTICE_MODES.QUESTION,
      status: PRACTICE_STATUSES.ACTIVE,
    },
    include: {
      paper: {
        include: {
          questions: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
    },
  })

  if (!session) {
    throw new Error('当前没有进行中的逐题练习')
  }

  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: 'STUDENT',
      ...getStudentClassQuery(session.className),
    },
  })

  if (!student) {
    throw new Error('你不在本次练习班级范围内')
  }

  const currentQuestion = getQuestionByIndex(
    session.paper.questions,
    session.currentQuestionIndex
  )

  if (!currentQuestion) {
    throw new Error('当前题目不存在')
  }

  const existingResponse = await prisma.practiceResponse.findUnique({
    where: {
      sessionId_studentId_paperQuestionId: {
        sessionId: session.id,
        studentId,
        paperQuestionId: currentQuestion.id,
      },
    },
  })

  if (existingResponse) {
    throw new Error('本题已提交，不能重复作答')
  }

  const studentSession = await getOrCreateStudentSession(session.id, studentId)
  const isCorrect = evaluateQuestionAnswer(currentQuestion, answer)

  return prisma.practiceResponse.create({
    data: {
      sessionId: session.id,
      studentSessionId: studentSession.id,
      studentId,
      paperQuestionId: currentQuestion.id,
      answer,
      isCorrect,
      awardedScore: isCorrect ? currentQuestion.score : 0,
    },
  })
}

export async function submitPaperPracticeAnswers(
  studentId: string,
  sessionId: string,
  answers: Array<{ paperQuestionId: string; answer: string }>
) {
  const session = await prisma.practiceSession.findFirst({
    where: {
      id: sessionId,
      mode: PRACTICE_MODES.PAPER,
      status: PRACTICE_STATUSES.ACTIVE,
    },
    include: {
      paper: {
        include: {
          questions: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
    },
  })

  if (!session) {
    throw new Error('当前没有进行中的整卷练习')
  }

  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: 'STUDENT',
      ...getStudentClassQuery(session.className),
    },
  })

  if (!student) {
    throw new Error('你不在本次练习班级范围内')
  }

  if (
    session.startedAt &&
    session.durationMinutes &&
    Date.now() > session.startedAt.getTime() + session.durationMinutes * 60 * 1000
  ) {
    throw new Error('答题时间已结束')
  }

  const studentSession = await getOrCreatePaperStudentSession(session, studentId)
  if (studentSession.submittedAt) {
    throw new Error('试卷已提交，不能重复提交')
  }

  const answerMap = new Map(
    answers.map((item) => [item.paperQuestionId, item.answer] as const)
  )
  const responsesToCreate = session.paper.questions.map((question) => {
    const answer = answerMap.get(question.id) || ''
    const isCorrect = evaluateQuestionAnswer(question, answer)

    return {
      sessionId: session.id,
      studentSessionId: studentSession.id,
      studentId,
      paperQuestionId: question.id,
      answer,
      isCorrect,
      awardedScore: isCorrect ? question.score : 0,
    }
  })

  const rawScore = responsesToCreate.reduce(
    (total, response) => total + (response.awardedScore || 0),
    0
  )
  const bonusMultiplier =
    session.startedAt && session.durationMinutes
      ? Date.now() <= getHalfDurationDeadline(session.startedAt, session.durationMinutes)
        ? 1.2
        : 1
      : 1
  const finalScore = roundToOneDecimal(rawScore * bonusMultiplier)
  const awardedPointDelta = finalScore

  await prisma.$transaction(async (tx) => {
    for (const response of responsesToCreate) {
      await tx.practiceResponse.create({
        data: response,
      })
    }

    await tx.practiceSessionStudent.update({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId,
        },
      },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        rawScore,
        finalScore,
        bonusMultiplier,
        awardedPointDelta,
      },
    })

    if (awardedPointDelta > 0) {
      await createStudentPointRecordWithTx(tx, {
        studentId: student.id,
        delta: awardedPointDelta,
        reason: `整卷练习《${session.paper.title}》得分奖励`,
        occurredAt: new Date(),
        source: 'WEB',
        operatorId: session.teacherId,
      })
    }
  })

  return {
    rawScore,
    finalScore,
    bonusMultiplier,
    awardedPointDelta,
  }
}
