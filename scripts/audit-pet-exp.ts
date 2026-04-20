import { prisma } from '@/lib/prisma'

interface CliOptions {
  username: string
  days: number
  limit: number
}

function parseArgs(argv: string[]): CliOptions {
  let username = ''
  let days = 7
  let limit = 20

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = argv[index + 1]

    if ((current === '--username' || current === '-u') && next) {
      username = next.trim()
      index += 1
      continue
    }

    if (current === '--days' && next) {
      days = Number(next)
      index += 1
      continue
    }

    if (current === '--limit' && next) {
      limit = Number(next)
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

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('--limit 必须是正整数')
  }

  return { username, days, limit }
}

function formatDate(value?: Date | null) {
  return value ? value.toISOString() : '-'
}

function formatNumber(value?: number | null) {
  return typeof value === 'number' ? String(value) : '-'
}

function printSection(title: string) {
  console.log(`\n=== ${title} ===`)
}

function buildPointExpKey(input: {
  occurredAt: Date
  pointDelta: number
  reason: string
}) {
  return [
    input.occurredAt.toISOString(),
    input.pointDelta.toFixed(1),
    input.reason.trim(),
  ].join('|')
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
      pointBalance: true,
      pet: {
        select: {
          id: true,
          speciesKey: true,
          level: true,
          exp: true,
          currentHp: true,
        },
      },
    },
  })

  if (!student) {
    throw new Error(`未找到学生：${options.username}`)
  }

  const [pointRecords, petExpRecords, questionResponses, paperSessions, challengeSubmissions] =
    await Promise.all([
      prisma.studentPointRecord.findMany({
        where: {
          studentId: student.id,
          occurredAt: {
            gte: since,
          },
        },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take: options.limit,
        select: {
          id: true,
          delta: true,
          reason: true,
          source: true,
          occurredAt: true,
          createdAt: true,
        },
      }),
      student.pet
        ? prisma.studentPetExpRecord.findMany({
            where: {
              petId: student.pet.id,
              occurredAt: {
                gte: since,
              },
            },
            orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
            take: options.limit,
            select: {
              id: true,
              expDelta: true,
              pointDelta: true,
              reason: true,
              source: true,
              levelBefore: true,
              levelAfter: true,
              expBefore: true,
              expAfter: true,
              occurredAt: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      prisma.practiceResponse.findMany({
        where: {
          studentId: student.id,
          submittedAt: {
            gte: since,
          },
          session: {
            mode: 'QUESTION',
          },
        },
        orderBy: [{ submittedAt: 'desc' }],
        take: options.limit,
        select: {
          id: true,
          isCorrect: true,
          awardedPointDelta: true,
          settledAt: true,
          submittedAt: true,
          answer: true,
          session: {
            select: {
              id: true,
              status: true,
              currentQuestionIndex: true,
              paper: {
                select: {
                  title: true,
                },
              },
            },
          },
          paperQuestion: {
            select: {
              content: true,
              score: true,
            },
          },
        },
      }),
      prisma.practiceSessionStudent.findMany({
        where: {
          studentId: student.id,
          submittedAt: {
            gte: since,
          },
          session: {
            mode: 'PAPER',
          },
        },
        orderBy: [{ submittedAt: 'desc' }],
        take: options.limit,
        select: {
          id: true,
          status: true,
          rawScore: true,
          finalScore: true,
          bonusMultiplier: true,
          awardedPointDelta: true,
          submittedAt: true,
          session: {
            select: {
              id: true,
              status: true,
              startedAt: true,
              durationMinutes: true,
              paper: {
                select: {
                  title: true,
                },
              },
            },
          },
        },
      }),
      prisma.challengeSubmission.findMany({
        where: {
          studentId: student.id,
          submittedAt: {
            gte: since,
          },
        },
        orderBy: [{ submittedAt: 'desc' }],
        take: options.limit,
        select: {
          id: true,
          chapterKey: true,
          levelKey: true,
          isPassed: true,
          pointsAwarded: true,
          judgeMessage: true,
          submittedAt: true,
        },
      }),
    ])

  const petExpRecordMap = new Map(
    petExpRecords
      .filter((record) => typeof record.pointDelta === 'number' && record.pointDelta > 0)
      .map((record) => [
        buildPointExpKey({
          occurredAt: record.occurredAt,
          pointDelta: record.pointDelta || 0,
          reason: record.reason,
        }),
        record,
      ])
  )

  const unmatchedPositivePointRecords = pointRecords.filter((record) => {
    if (record.delta <= 0 || !student.pet) {
      return false
    }

    return !petExpRecordMap.has(
      buildPointExpKey({
        occurredAt: record.occurredAt,
        pointDelta: record.delta,
        reason: record.reason,
      })
    )
  })

  const unsettledQuestionResponses = questionResponses.filter((item) => !item.settledAt)
  const zeroAwardQuestionResponses = questionResponses.filter(
    (item) => item.settledAt && (!item.awardedPointDelta || item.awardedPointDelta <= 0)
  )
  const zeroAwardPaperSessions = paperSessions.filter(
    (item) => !item.awardedPointDelta || item.awardedPointDelta <= 0
  )

  printSection('学生概况')
  console.log(`姓名: ${student.name}`)
  console.log(`用户名: ${student.username}`)
  console.log(`班级: ${student.className || '-'}`)
  console.log(`当前积分: ${student.pointBalance}`)
  console.log(
    `当前宠物: ${
      student.pet
        ? `${student.pet.speciesKey} Lv.${student.pet.level} EXP ${student.pet.exp}`
        : '未选择宠物'
    }`
  )
  console.log(`审计时间范围: ${since.toISOString()} ~ ${new Date().toISOString()}`)

  printSection('快速判断')
  if (!student.pet) {
    console.log('- 该学生当前没有宠物。即使产生了正向积分，也不会写入宠物经验流水。')
  }
  if (unsettledQuestionResponses.length > 0) {
    console.log(`- 发现 ${unsettledQuestionResponses.length} 条逐题练习已提交但尚未结算。学生提交后不会立刻加经验，要等教师结束本题。`)
  }
  if (zeroAwardQuestionResponses.length > 0) {
    console.log(`- 发现 ${zeroAwardQuestionResponses.length} 条逐题练习已结算但积分为 0，通常表示答错或未进入奖励档。`)
  }
  if (zeroAwardPaperSessions.length > 0) {
    console.log(`- 发现 ${zeroAwardPaperSessions.length} 条整卷练习得分为 0，因此不会产生宠物经验。`)
  }
  if (unmatchedPositivePointRecords.length > 0) {
    console.log(`- 发现 ${unmatchedPositivePointRecords.length} 条正向积分流水没有匹配到宠物经验流水，这属于应重点排查的不一致。`)
  }
  if (
    student.pet &&
    unsettledQuestionResponses.length === 0 &&
    zeroAwardQuestionResponses.length === 0 &&
    zeroAwardPaperSessions.length === 0 &&
    unmatchedPositivePointRecords.length === 0
  ) {
    console.log('- 最近记录未发现明显异常。')
  }

  printSection('最近积分流水')
  if (pointRecords.length === 0) {
    console.log('- 无')
  } else {
    for (const record of pointRecords) {
      console.log(
        [
          record.occurredAt.toISOString(),
          `delta=${record.delta}`,
          `source=${record.source}`,
          `reason=${record.reason}`,
          `createdAt=${record.createdAt.toISOString()}`,
        ].join(' | ')
      )
    }
  }

  printSection('最近宠物经验流水')
  if (petExpRecords.length === 0) {
    console.log(student.pet ? '- 无' : '- 该学生没有宠物，无法存在经验流水')
  } else {
    for (const record of petExpRecords) {
      console.log(
        [
          record.occurredAt.toISOString(),
          `expDelta=${record.expDelta}`,
          `pointDelta=${formatNumber(record.pointDelta)}`,
          `level=${record.levelBefore}->${record.levelAfter}`,
          `exp=${record.expBefore}->${record.expAfter}`,
          `source=${record.source}`,
          `reason=${record.reason}`,
        ].join(' | ')
      )
    }
  }

  printSection('最近逐题练习提交')
  if (questionResponses.length === 0) {
    console.log('- 无')
  } else {
    for (const item of questionResponses) {
      console.log(
        [
          item.submittedAt.toISOString(),
          `paper=${item.session.paper.title}`,
          `score=${item.paperQuestion.score}`,
          `correct=${String(item.isCorrect)}`,
          `awarded=${formatNumber(item.awardedPointDelta)}`,
          `settledAt=${formatDate(item.settledAt)}`,
          `sessionStatus=${item.session.status}`,
        ].join(' | ')
      )
    }
  }

  printSection('最近整卷练习提交')
  if (paperSessions.length === 0) {
    console.log('- 无')
  } else {
    for (const item of paperSessions) {
      console.log(
        [
          item.submittedAt?.toISOString() || '-',
          `paper=${item.session.paper.title}`,
          `raw=${formatNumber(item.rawScore)}`,
          `final=${formatNumber(item.finalScore)}`,
          `bonus=${formatNumber(item.bonusMultiplier)}`,
          `awarded=${formatNumber(item.awardedPointDelta)}`,
          `sessionStatus=${item.session.status}`,
        ].join(' | ')
      )
    }
  }

  printSection('最近代码闯关提交')
  if (challengeSubmissions.length === 0) {
    console.log('- 无')
  } else {
    for (const item of challengeSubmissions) {
      console.log(
        [
          item.submittedAt.toISOString(),
          `chapter=${item.chapterKey}`,
          `level=${item.levelKey}`,
          `passed=${String(item.isPassed)}`,
          `points=${item.pointsAwarded}`,
          `message=${item.judgeMessage}`,
        ].join(' | ')
      )
    }
  }

  if (unmatchedPositivePointRecords.length > 0) {
    printSection('异常积分流水')
    for (const record of unmatchedPositivePointRecords) {
      console.log(
        [
          record.occurredAt.toISOString(),
          `delta=${record.delta}`,
          `source=${record.source}`,
          `reason=${record.reason}`,
        ].join(' | ')
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
