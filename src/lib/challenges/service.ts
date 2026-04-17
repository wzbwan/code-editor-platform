import { prisma } from '@/lib/prisma'
import { getAllChallengeChapters, getChallengeChapter, getChallengeLevel } from '@/lib/challenges/registry'
import { createStudentPointRecordWithTx } from '@/lib/student-points'
import { POINT_SOURCE } from '@/lib/constants'

function normalizeClassName(value?: string | null) {
  return value?.trim() || ''
}

function buildLevelAccessState(params: {
  chapterKey: string
  levels: ReturnType<typeof getAllChallengeChapters>[number]['levels']
  progressMap: Map<string, { status: string; awardedPoints: number; attemptCount: number; firstPassedAt: Date | null }>
  unlockedLevelSet: Set<string>
  chapterUnlocked: boolean
}) {
  let sequentialUnlocked = params.chapterUnlocked

  return params.levels.map((level) => {
    const levelKey = `${params.chapterKey}:${level.key}`
    const progress = params.progressMap.get(levelKey)
    const passed = progress?.status === 'PASSED'
    const isAccessible = params.chapterUnlocked && (params.unlockedLevelSet.has(levelKey) || sequentialUnlocked)

    if (!passed) {
      sequentialUnlocked = false
    }

    return {
      key: level.key,
      title: level.title,
      summary: level.summary,
      description: level.description,
      points: level.points,
      isAccessible,
      isPassed: passed,
      attemptCount: progress?.attemptCount || 0,
      awardedPoints: progress?.awardedPoints || 0,
      firstPassedAt: progress?.firstPassedAt || null,
      isManuallyUnlocked: params.unlockedLevelSet.has(levelKey),
    }
  })
}

export async function getStudentChallengeHome(studentId: string) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, className: true },
  })

  if (!student) {
    throw new Error('学生不存在')
  }

  const className = normalizeClassName(student.className)

  const [chapterUnlocks, levelUnlocks, progresses] = await Promise.all([
    prisma.challengeChapterUnlock.findMany({
      where: { className },
      select: { chapterKey: true },
    }),
    prisma.challengeLevelUnlock.findMany({
      where: { className },
      select: { chapterKey: true, levelKey: true },
    }),
    prisma.challengeProgress.findMany({
      where: { studentId },
      select: {
        chapterKey: true,
        levelKey: true,
        status: true,
        awardedPoints: true,
        attemptCount: true,
        firstPassedAt: true,
      },
    }),
  ])

  const chapterUnlockSet = new Set(chapterUnlocks.map((item) => item.chapterKey))
  const levelUnlockSet = new Set(levelUnlocks.map((item) => `${item.chapterKey}:${item.levelKey}`))
  const progressMap = new Map(
    progresses.map((item) => [
      `${item.chapterKey}:${item.levelKey}`,
      {
        status: item.status,
        awardedPoints: item.awardedPoints,
        attemptCount: item.attemptCount,
        firstPassedAt: item.firstPassedAt,
      },
    ])
  )

  const chapters = getAllChallengeChapters().map((chapter) => {
    const levels = buildLevelAccessState({
      chapterKey: chapter.key,
      levels: chapter.levels,
      progressMap,
      unlockedLevelSet: levelUnlockSet,
      chapterUnlocked: chapterUnlockSet.has(chapter.key),
    })

    return {
      key: chapter.key,
      title: chapter.title,
      theme: chapter.theme,
      description: chapter.description,
      isUnlocked: chapterUnlockSet.has(chapter.key),
      totalLevels: chapter.levels.length,
      passedLevels: levels.filter((level) => level.isPassed).length,
      accessibleLevels: levels.filter((level) => level.isAccessible).length,
    }
  })

  return {
    className,
    chapters,
  }
}

export async function getStudentChallengeChapterView(studentId: string, chapterKey: string) {
  const chapter = getChallengeChapter(chapterKey)
  if (!chapter) {
    return null
  }

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { className: true },
  })

  if (!student) {
    throw new Error('学生不存在')
  }

  const className = normalizeClassName(student.className)

  const [chapterUnlock, levelUnlocks, progresses] = await Promise.all([
    prisma.challengeChapterUnlock.findUnique({
      where: {
        className_chapterKey: {
          className,
          chapterKey,
        },
      },
      select: { id: true },
    }),
    prisma.challengeLevelUnlock.findMany({
      where: { className, chapterKey },
      select: { levelKey: true },
    }),
    prisma.challengeProgress.findMany({
      where: { studentId, chapterKey },
      select: {
        levelKey: true,
        status: true,
        awardedPoints: true,
        attemptCount: true,
        firstPassedAt: true,
      },
    }),
  ])

  const progressMap = new Map(
    progresses.map((item) => [
      `${chapterKey}:${item.levelKey}`,
      {
        status: item.status,
        awardedPoints: item.awardedPoints,
        attemptCount: item.attemptCount,
        firstPassedAt: item.firstPassedAt,
      },
    ])
  )
  const unlockedLevelSet = new Set(levelUnlocks.map((item) => `${chapterKey}:${item.levelKey}`))
  const levels = buildLevelAccessState({
    chapterKey,
    levels: chapter.levels,
    progressMap,
    unlockedLevelSet,
    chapterUnlocked: Boolean(chapterUnlock),
  })

  return {
    chapter: {
      key: chapter.key,
      title: chapter.title,
      theme: chapter.theme,
      description: chapter.description,
      isUnlocked: Boolean(chapterUnlock),
      levels,
    },
  }
}

export async function getStudentChallengeLevelView(
  studentId: string,
  chapterKey: string,
  levelKey: string
) {
  const chapterView = await getStudentChallengeChapterView(studentId, chapterKey)
  const level = getChallengeLevel(chapterKey, levelKey)
  if (!chapterView || !level) {
    return null
  }

  const currentLevel = chapterView.chapter.levels.find((item) => item.key === levelKey)
  if (!currentLevel) {
    return null
  }

  const progress = await prisma.challengeProgress.findUnique({
    where: {
      studentId_chapterKey_levelKey: {
        studentId,
        chapterKey,
        levelKey,
      },
    },
    select: {
      latestCode: true,
      latestJudgeMessage: true,
      latestStdout: true,
      latestStderr: true,
      latestSubmittedAt: true,
    },
  })

  const levelIndex = chapterView.chapter.levels.findIndex((item) => item.key === levelKey)
  const previousLevel = levelIndex > 0 ? chapterView.chapter.levels[levelIndex - 1] : null
  const nextLevel =
    levelIndex >= 0 && levelIndex < chapterView.chapter.levels.length - 1
      ? chapterView.chapter.levels[levelIndex + 1]
      : null

  return {
    chapter: chapterView.chapter,
    level: {
      ...currentLevel,
      initialCode: level.initialCode,
      judge: level.judge,
      latestCode: progress?.latestCode || null,
      latestJudgeMessage: progress?.latestJudgeMessage || null,
      latestStdout: progress?.latestStdout || null,
      latestStderr: progress?.latestStderr || null,
      latestSubmittedAt: progress?.latestSubmittedAt || null,
    },
    previousLevel,
    nextLevel,
  }
}

export async function submitStudentChallenge(
  studentId: string,
  input: {
    chapterKey: string
    levelKey: string
    code: string
    judgeResult: {
      passed: boolean
      message: string
      stdout: string
      stderr: string
    }
  }
) {
  const chapter = getChallengeChapter(input.chapterKey)
  const level = getChallengeLevel(input.chapterKey, input.levelKey)

  if (!chapter || !level) {
    throw new Error('章节或关卡不存在')
  }

  const view = await getStudentChallengeLevelView(studentId, input.chapterKey, input.levelKey)
  if (!view) {
    throw new Error('关卡不存在')
  }

  if (!view.level.isAccessible) {
    throw new Error('当前关卡尚未解锁')
  }

  const judgeResult = {
    passed: Boolean(input.judgeResult.passed),
    message: input.judgeResult.message.trim() || '已提交本地判题结果。',
    stdout: input.judgeResult.stdout,
    stderr: input.judgeResult.stderr,
  }
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const existingProgress = await tx.challengeProgress.findUnique({
      where: {
        studentId_chapterKey_levelKey: {
          studentId,
          chapterKey: input.chapterKey,
          levelKey: input.levelKey,
        },
      },
      select: {
        id: true,
        firstPassedAt: true,
        awardedPoints: true,
      },
    })

    const isFirstPass = judgeResult.passed && !existingProgress?.firstPassedAt
    const pointsAwarded = isFirstPass ? level.points : 0

    await tx.challengeSubmission.create({
      data: {
        studentId,
        chapterKey: input.chapterKey,
        levelKey: input.levelKey,
        code: input.code,
        isPassed: judgeResult.passed,
        judgeMessage: judgeResult.message,
        stdout: judgeResult.stdout || null,
        stderr: judgeResult.stderr || null,
        pointsAwarded,
        submittedAt: now,
      },
    })

    await tx.challengeProgress.upsert({
      where: {
        studentId_chapterKey_levelKey: {
          studentId,
          chapterKey: input.chapterKey,
          levelKey: input.levelKey,
        },
      },
      update: {
        status: judgeResult.passed ? 'PASSED' : 'IN_PROGRESS',
        attemptCount: {
          increment: 1,
        },
        latestCode: input.code,
        latestJudgeMessage: judgeResult.message,
        latestStdout: judgeResult.stdout || null,
        latestStderr: judgeResult.stderr || null,
        latestSubmittedAt: now,
        passedAt: judgeResult.passed ? now : undefined,
        firstPassedAt: isFirstPass ? now : existingProgress?.firstPassedAt || undefined,
        awardedPoints: (existingProgress?.awardedPoints || 0) + pointsAwarded,
      },
      create: {
        studentId,
        chapterKey: input.chapterKey,
        levelKey: input.levelKey,
        status: judgeResult.passed ? 'PASSED' : 'IN_PROGRESS',
        attemptCount: 1,
        latestCode: input.code,
        latestJudgeMessage: judgeResult.message,
        latestStdout: judgeResult.stdout || null,
        latestStderr: judgeResult.stderr || null,
        latestSubmittedAt: now,
        passedAt: judgeResult.passed ? now : null,
        firstPassedAt: judgeResult.passed ? now : null,
        awardedPoints: pointsAwarded,
      },
    })

    if (isFirstPass && pointsAwarded > 0) {
      await createStudentPointRecordWithTx(tx, {
        studentId,
        delta: pointsAwarded,
        reason: `代码闯关[${chapter.title} / ${level.title}] 首次通关`,
        occurredAt: now,
        source: POINT_SOURCE.CHALLENGE,
      })
    }

    return {
      ...judgeResult,
      isFirstPass,
      pointsAwarded,
    }
  })
}

export async function listChallengeClassOptions() {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { className: true },
    orderBy: { className: 'asc' },
  })

  return Array.from(new Set(students.map((item) => normalizeClassName(item.className)).filter(Boolean)))
}

export async function getTeacherChallengeTaskListData(className: string) {
  const normalizedClassName = normalizeClassName(className)
  const [students, chapterUnlocks, passedProgresses] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: 'STUDENT',
        className: normalizedClassName,
      },
      select: {
        id: true,
        name: true,
        username: true,
      },
      orderBy: [{ name: 'asc' }, { username: 'asc' }],
    }),
    prisma.challengeChapterUnlock.findMany({
      where: { className: normalizedClassName },
      select: { chapterKey: true },
    }),
    prisma.challengeProgress.findMany({
      where: {
        status: 'PASSED',
        student: {
          role: 'STUDENT',
          className: normalizedClassName,
        },
      },
      select: {
        studentId: true,
        chapterKey: true,
        levelKey: true,
      },
    }),
  ])

  const unlockedChapters = new Set(chapterUnlocks.map((item) => item.chapterKey))
  const chapterPassedStudentSetMap = new Map<string, Set<string>>()

  for (const progress of passedProgresses) {
    const studentIds = chapterPassedStudentSetMap.get(progress.chapterKey) || new Set<string>()
    studentIds.add(progress.studentId)
    chapterPassedStudentSetMap.set(progress.chapterKey, studentIds)
  }

  return {
    className: normalizedClassName,
    totalStudents: students.length,
    chapters: getAllChallengeChapters().map((chapter) => ({
      key: chapter.key,
      title: chapter.title,
      description: chapter.description,
      theme: chapter.theme,
      isUnlocked: unlockedChapters.has(chapter.key),
      levelCount: chapter.levels.length,
      passedStudentCount: chapterPassedStudentSetMap.get(chapter.key)?.size || 0,
    })),
  }
}

export async function getChallengeUnlockManagerData(className: string, chapterKey: string) {
  const normalizedClassName = normalizeClassName(className)
  const chapter = getChallengeChapter(chapterKey)
  if (!chapter) {
    return null
  }

  const [students, chapterUnlock, levelUnlocks, passedProgresses] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: 'STUDENT',
        className: normalizedClassName,
      },
      select: {
        id: true,
        name: true,
        username: true,
      },
      orderBy: [{ name: 'asc' }, { username: 'asc' }],
    }),
    prisma.challengeChapterUnlock.findUnique({
      where: {
        className_chapterKey: {
          className: normalizedClassName,
          chapterKey,
        },
      },
      select: {
        id: true,
      },
    }),
    prisma.challengeLevelUnlock.findMany({
      where: { className: normalizedClassName, chapterKey },
      select: { levelKey: true },
    }),
    prisma.challengeProgress.findMany({
      where: {
        chapterKey,
        status: 'PASSED',
        student: {
          role: 'STUDENT',
          className: normalizedClassName,
        },
      },
      select: {
        studentId: true,
        levelKey: true,
      },
    }),
  ])

  const unlockedLevels = new Set(levelUnlocks.map((item) => item.levelKey))
  const passedLevelStudentSetMap = new Map<string, Set<string>>()
  const studentPassedLevelSetMap = new Map<string, Set<string>>()

  for (const progress of passedProgresses) {
    const levelStudents = passedLevelStudentSetMap.get(progress.levelKey) || new Set<string>()
    levelStudents.add(progress.studentId)
    passedLevelStudentSetMap.set(progress.levelKey, levelStudents)

    const studentLevels = studentPassedLevelSetMap.get(progress.studentId) || new Set<string>()
    studentLevels.add(progress.levelKey)
    studentPassedLevelSetMap.set(progress.studentId, studentLevels)
  }

  const totalLevels = chapter.levels.length
  const studentRankings = students
    .map((student) => {
      const passedLevels = studentPassedLevelSetMap.get(student.id) || new Set<string>()
      return {
        id: student.id,
        name: student.name,
        username: student.username,
        passedCount: passedLevels.size,
        notPassedCount: Math.max(totalLevels - passedLevels.size, 0),
        levelStatuses: chapter.levels.map((level) => ({
          key: level.key,
          title: level.title,
          isPassed: passedLevels.has(level.key),
        })),
      }
    })
    .sort((left, right) => {
      if (right.passedCount !== left.passedCount) {
        return right.passedCount - left.passedCount
      }
      return left.username.localeCompare(right.username)
    })

  return {
    className: normalizedClassName,
    totalStudents: students.length,
    chapter: {
      key: chapter.key,
      title: chapter.title,
      description: chapter.description,
      theme: chapter.theme,
      isUnlocked: Boolean(chapterUnlock),
      levels: chapter.levels.map((level) => ({
        key: level.key,
        title: level.title,
        summary: level.summary,
        isUnlocked: unlockedLevels.has(level.key),
        passedCount: passedLevelStudentSetMap.get(level.key)?.size || 0,
        totalStudents: students.length,
      })),
    },
    studentRankings,
  }
}

export async function saveChallengeUnlocks(input: {
  className: string
  chapterKeys: string[]
  levelKeys: Array<{ chapterKey: string; levelKey: string }>
  scopeChapterKey?: string
}) {
  const className = normalizeClassName(input.className)
  if (!className) {
    throw new Error('请选择班级')
  }

  const validChapterKeys = new Set(getAllChallengeChapters().map((chapter) => chapter.key))
  const normalizedChapterKeys = Array.from(new Set(input.chapterKeys)).filter((item) =>
    validChapterKeys.has(item)
  )
  const scopeChapterKey = input.scopeChapterKey?.trim()
  if (scopeChapterKey && !validChapterKeys.has(scopeChapterKey)) {
    throw new Error('闯关任务不存在')
  }

  const normalizedLevelKeys = Array.from(
    new Map(
      input.levelKeys
        .filter(({ chapterKey, levelKey }) => Boolean(getChallengeLevel(chapterKey, levelKey)))
        .map((item) => [`${item.chapterKey}:${item.levelKey}`, item])
    ).values()
  ).filter((item) => normalizedChapterKeys.includes(item.chapterKey))

  await prisma.$transaction(async (tx) => {
    if (scopeChapterKey) {
      await tx.challengeChapterUnlock.deleteMany({
        where: { className, chapterKey: scopeChapterKey },
      })
      await tx.challengeLevelUnlock.deleteMany({
        where: { className, chapterKey: scopeChapterKey },
      })
    } else {
      await tx.challengeChapterUnlock.deleteMany({
        where: { className },
      })
      await tx.challengeLevelUnlock.deleteMany({
        where: { className },
      })
    }

    if (normalizedChapterKeys.length > 0) {
      await tx.challengeChapterUnlock.createMany({
        data: normalizedChapterKeys.map((chapterKey) => ({
          className,
          chapterKey,
        })),
      })
    }

    if (normalizedLevelKeys.length > 0) {
      await tx.challengeLevelUnlock.createMany({
        data: normalizedLevelKeys.map((item) => ({
          className,
          chapterKey: item.chapterKey,
          levelKey: item.levelKey,
        })),
      })
    }
  })

  if (scopeChapterKey) {
    return getChallengeUnlockManagerData(className, scopeChapterKey)
  }

  return getTeacherChallengeTaskListData(className)
}
