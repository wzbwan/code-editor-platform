import { prisma } from '@/lib/prisma'
import { evaluateQuestionAnswer, getQuestionOptionEntries, parseJson } from '@/lib/quiz'
import { roundToOneDecimal } from '@/lib/point-format'

interface CliOptions {
  username: string
  sessionId?: string
  days: number
}

function parseArgs(argv: string[]): CliOptions {
  let username = ''
  let sessionId = ''
  let days = 30

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = argv[index + 1]

    if ((current === '--username' || current === '-u') && next) {
      username = next.trim()
      index += 1
      continue
    }

    if ((current === '--session-id' || current === '-s') && next) {
      sessionId = next.trim()
      index += 1
      continue
    }

    if (current === '--days' && next) {
      days = Number(next)
      index += 1
      continue
    }
  }

  if (!username) {
    throw new Error('请传入 --username <学生用户名>')
  }

  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('--days 必须是正数')
  }

  return {
    username,
    sessionId: sessionId || undefined,
    days,
  }
}

function formatDate(value?: Date | null) {
  return value ? value.toISOString() : '-'
}

function printSection(title: string) {
  console.log(`\n=== ${title} ===`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const since = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000)

  const student = await prisma.user.findFirst({
    where: {
      username: options.username,
      role: 'STUDENT',
    },
    select: {
      id: true,
      username: true,
      name: true,
      className: true,
    },
  })

  if (!student) {
    throw new Error(`未找到学生：${options.username}`)
  }

  const studentSession = await prisma.practiceSessionStudent.findFirst({
    where: {
      studentId: student.id,
      submittedAt: {
        gte: since,
      },
      session: {
        id: options.sessionId,
        mode: 'PAPER',
      },
    },
    orderBy: [{ submittedAt: 'desc' }],
    include: {
      session: {
        include: {
          paper: {
            include: {
              questions: {
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
      },
      responses: {
        orderBy: { submittedAt: 'asc' },
        include: {
          paperQuestion: true,
        },
      },
    },
  })

  if (!studentSession) {
    throw new Error(
      options.sessionId
        ? `未找到该学生在整卷会话 ${options.sessionId} 的提交记录`
        : `最近 ${options.days} 天未找到该学生的整卷提交记录`
    )
  }

  const questionOrder = parseJson<string[]>(studentSession.questionOrder, []) || []
  const optionOrder =
    parseJson<Record<string, string[]>>(studentSession.optionOrder, {}) || {}
  const responseMap = new Map(
    studentSession.responses.map((response) => [response.paperQuestionId, response] as const)
  )

  const orderedQuestions = (questionOrder.length > 0
    ? questionOrder
        .map((questionId) =>
          studentSession.session.paper.questions.find((question) => question.id === questionId)
        )
        .filter(
          (
            question
          ): question is (typeof studentSession.session.paper.questions)[number] => Boolean(question)
        )
    : studentSession.session.paper.questions
  ).map((question) => {
    const displayedOptionKeys =
      optionOrder[question.id] || getQuestionOptionEntries(question).map((item) => item.key)
    const optionMap = new Map(getQuestionOptionEntries(question).map((item) => [item.key, item.value] as const))

    return {
      question,
      response: responseMap.get(question.id) || null,
      displayedOptions: displayedOptionKeys
        .map((key) => ({
          key,
          value: optionMap.get(key) || '',
        }))
        .filter((item) => item.value),
    }
  })

  const recomputedRawScore = orderedQuestions.reduce((sum, item) => {
    return sum + (item.response?.awardedScore || 0)
  }, 0)
  const recomputedFinalScore = roundToOneDecimal(
    recomputedRawScore * (studentSession.bonusMultiplier || 1)
  )

  printSection('会话概况')
  console.log(`学生: ${student.name} (${student.username})`)
  console.log(`班级: ${student.className || '-'}`)
  console.log(`会话ID: ${studentSession.sessionId}`)
  console.log(`试卷: ${studentSession.session.paper.title}`)
  console.log(`提交时间: ${formatDate(studentSession.submittedAt)}`)
  console.log(`原始分(库内): ${studentSession.rawScore ?? 0}`)
  console.log(`原始分(逐题重算): ${recomputedRawScore}`)
  console.log(`加成系数: ${studentSession.bonusMultiplier ?? 1}`)
  console.log(`最终分(库内): ${studentSession.finalScore ?? 0}`)
  console.log(`最终分(重算): ${recomputedFinalScore}`)
  console.log(`答题状态: ${studentSession.status}`)

  if ((studentSession.rawScore ?? 0) !== recomputedRawScore) {
    console.log('- 异常: 库内 rawScore 与逐题 awardedScore 汇总不一致')
  }

  if (roundToOneDecimal(studentSession.finalScore ?? 0) !== recomputedFinalScore) {
    console.log('- 异常: 库内 finalScore 与 rawScore * bonusMultiplier 不一致')
  }

  printSection('逐题明细')
  for (const [index, item] of orderedQuestions.entries()) {
    const submittedAnswer = item.response?.answer || ''
    const storedIsCorrect = item.response?.isCorrect ?? false
    const recomputedIsCorrect = evaluateQuestionAnswer(item.question, submittedAnswer)
    const awardedScore = item.response?.awardedScore || 0

    console.log(
      [
        `#${index + 1}`,
        `questionId=${item.question.id}`,
        `type=${item.question.type}`,
        `score=${item.question.score}`,
        `submitted=${submittedAnswer || '(空)'}`,
        `expected=${item.question.answer}`,
        `storedCorrect=${String(storedIsCorrect)}`,
        `recomputedCorrect=${String(recomputedIsCorrect)}`,
        `awarded=${awardedScore}`,
      ].join(' | ')
    )
    console.log(`题干: ${item.question.content}`)

    if (item.displayedOptions.length > 0) {
      console.log(
        `展示选项: ${item.displayedOptions.map((option) => `${option.key}.${option.value}`).join(' / ')}`
      )
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
