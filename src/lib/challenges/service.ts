import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAllChallengeChapters, getChallengeChapter, getChallengeLevel } from '@/lib/challenges/registry'
import { createStudentPointRecordWithTx } from '@/lib/student-points'
import { POINT_SOURCE } from '@/lib/constants'
import { ChallengeJudgeResult, ChallengeValue } from '@/lib/challenges/types'

const VARIABLE_START_MARKER = '__CODEX_CHALLENGE_VARIABLES_START__'
const VARIABLE_END_MARKER = '__CODEX_CHALLENGE_VARIABLES_END__'

export const CHALLENGE_ATTEMPT_STATUS = {
  ACTIVE: 'ACTIVE',
  INVALIDATED_BY_FOCUS_LOSS: 'INVALIDATED_BY_FOCUS_LOSS',
  SUBMITTED: 'SUBMITTED',
} as const

export const CHALLENGE_ATTEMPT_EVENT_TYPE = {
  FOCUS_LOST: 'focus_lost',
  FOCUS_RETURNED: 'focus_returned',
} as const

export class ChallengeAttemptError extends Error {
  statusCode: number
  attemptStatus?: string

  constructor(message: string, statusCode = 400, attemptStatus?: string) {
    super(message)
    this.name = 'ChallengeAttemptError'
    this.statusCode = statusCode
    this.attemptStatus = attemptStatus
  }
}

export interface SubmittedVariableResult {
  missing: boolean
  value?: ChallengeValue
  nonJson?: boolean
}

export interface GodotChallengeExecutionInput {
  stdout: string
  stderr: string
  exitCode?: number | null
  timedOut?: boolean
  variables?: Record<string, SubmittedVariableResult> | null
}

function normalizeClassName(value?: string | null) {
  return value?.trim() || ''
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

function buildGodotVariableProbeScript(variableNames: string[]) {
  const variableNamesJson = JSON.stringify(variableNames, null, 0)

  return `
import json

def __challenge_normalize(value):
    if isinstance(value, set):
        normalized_items = [__challenge_normalize(item) for item in value]
        return sorted(
            normalized_items,
            key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True)
        )
    if isinstance(value, tuple):
        return [__challenge_normalize(item) for item in value]
    if isinstance(value, list):
        return [__challenge_normalize(item) for item in value]
    if isinstance(value, dict):
        return {
            str(key): __challenge_normalize(item)
            for key, item in value.items()
        }
    return value

__challenge_result = {}
for __challenge_name in ${variableNamesJson}:
    if __challenge_name in globals():
        try:
            __challenge_value = __challenge_normalize(globals()[__challenge_name])
            json.dumps(__challenge_value, ensure_ascii=False)
            __challenge_result[__challenge_name] = {
                "missing": False,
                "value": __challenge_value,
            }
        except TypeError:
            __challenge_result[__challenge_name] = {
                "missing": False,
                "value": repr(globals()[__challenge_name]),
                "nonJson": True,
            }
    else:
        __challenge_result[__challenge_name] = {
            "missing": True,
        }

print("${VARIABLE_START_MARKER}")
print(json.dumps(__challenge_result, ensure_ascii=False))
print("${VARIABLE_END_MARKER}")
`
}

export function parseGodotVariableProbeOutput(stdout: string) {
  const startIndex = stdout.lastIndexOf(VARIABLE_START_MARKER)
  const endIndex = stdout.lastIndexOf(VARIABLE_END_MARKER)

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return {
      stdout,
      variables: null as Record<string, SubmittedVariableResult> | null,
    }
  }

  const rawPayload = stdout
    .slice(startIndex + VARIABLE_START_MARKER.length, endIndex)
    .trim()
  const visibleStdout = `${stdout.slice(0, startIndex)}${stdout.slice(
    endIndex + VARIABLE_END_MARKER.length
  )}`.trim()

  try {
    return {
      stdout: visibleStdout,
      variables: JSON.parse(rawPayload) as Record<string, SubmittedVariableResult>,
    }
  } catch {
    return {
      stdout: visibleStdout,
      variables: null,
    }
  }
}

function buildGodotPublicJudge(level: NonNullable<ReturnType<typeof getChallengeLevel>>) {
  if (level.judge.mode === 'VARIABLES') {
    const variableNames = Object.keys(level.judge.expectedVariables)

    return {
      mode: 'VARIABLES' as const,
      variableNames,
      variableStartMarker: VARIABLE_START_MARKER,
      variableEndMarker: VARIABLE_END_MARKER,
      variableProbeScript: buildGodotVariableProbeScript(variableNames),
    }
  }

  return {
    mode: 'OUTPUT' as const,
  }
}

export async function createStudentChallengeAttempt(input: {
  studentId: string
  chapterKey: string
  levelKey: string
}) {
  const now = new Date()
  const attempt = await prisma.challengeAttempt.create({
    data: {
      studentId: input.studentId,
      chapterKey: input.chapterKey,
      levelKey: input.levelKey,
      status: CHALLENGE_ATTEMPT_STATUS.ACTIVE,
      openedAt: now,
    },
    select: {
      id: true,
      status: true,
      openedAt: true,
    },
  })

  return attempt
}

export async function recordStudentChallengeAttemptEvent(
  studentId: string,
  input: {
    attemptId: string
    chapterKey: string
    levelKey: string
    type: string
  }
) {
  const attemptId = input.attemptId.trim()
  const chapterKey = input.chapterKey.trim()
  const levelKey = input.levelKey.trim()
  const type = input.type.trim()

  if (!attemptId || !chapterKey || !levelKey || !type) {
    throw new ChallengeAttemptError('缺少必填字段', 400)
  }

  if (
    type !== CHALLENGE_ATTEMPT_EVENT_TYPE.FOCUS_LOST &&
    type !== CHALLENGE_ATTEMPT_EVENT_TYPE.FOCUS_RETURNED
  ) {
    throw new ChallengeAttemptError('type 非法', 400)
  }

  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.challengeAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        studentId: true,
        chapterKey: true,
        levelKey: true,
        status: true,
        firstFocusLostAt: true,
      },
    })

    if (!attempt) {
      throw new ChallengeAttemptError('attempt 不存在', 404)
    }

    if (
      attempt.studentId !== studentId ||
      attempt.chapterKey !== chapterKey ||
      attempt.levelKey !== levelKey
    ) {
      throw new ChallengeAttemptError('attempt 不属于当前学生，或章节/关卡不匹配', 403)
    }

    await tx.challengeAttemptEvent.create({
      data: {
        attemptId,
        studentId,
        chapterKey,
        levelKey,
        type,
        occurredAt: now,
      },
    })

    if (type === CHALLENGE_ATTEMPT_EVENT_TYPE.FOCUS_LOST) {
      await tx.challengeAttempt.updateMany({
        where: {
          id: attemptId,
          status: {
            not: CHALLENGE_ATTEMPT_STATUS.SUBMITTED,
          },
        },
        data: {
          status: CHALLENGE_ATTEMPT_STATUS.INVALIDATED_BY_FOCUS_LOSS,
          focusLostCount: {
            increment: 1,
          },
          firstFocusLostAt: attempt.firstFocusLostAt || now,
        },
      })
    } else {
      await tx.challengeAttempt.update({
        where: { id: attemptId },
        data: {
          lastFocusReturnedAt: now,
        },
      })
    }

    const updatedAttempt = await tx.challengeAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: {
        status: true,
      },
    })

    return {
      success: true,
      attemptStatus: updatedAttempt.status,
    }
  })
}

async function markChallengeAttemptSubmittedWithTx(
  tx: Prisma.TransactionClient,
  studentId: string,
  input: {
    attemptId?: string
    chapterKey: string
    levelKey: string
    submittedAt: Date
  }
) {
  const attemptId = input.attemptId?.trim() || ''

  if (!attemptId) {
    throw new ChallengeAttemptError('缺少 attemptId', 400)
  }

  const attempt = await tx.challengeAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      studentId: true,
      chapterKey: true,
      levelKey: true,
      status: true,
    },
  })

  if (!attempt) {
    throw new ChallengeAttemptError('attempt 不存在', 404)
  }

  if (
    attempt.studentId !== studentId ||
    attempt.chapterKey !== input.chapterKey ||
    attempt.levelKey !== input.levelKey
  ) {
    throw new ChallengeAttemptError('attempt 不属于当前学生，或章节/关卡不匹配', 403)
  }

  if (attempt.status !== CHALLENGE_ATTEMPT_STATUS.ACTIVE) {
    const message =
      attempt.status === CHALLENGE_ATTEMPT_STATUS.INVALIDATED_BY_FOCUS_LOSS
        ? '本次尝试已失效，请重新进入关卡后再提交。'
        : '本次尝试已提交，请重新进入关卡后再提交。'
    throw new ChallengeAttemptError(message, 403, attempt.status)
  }

  const submitted = await tx.challengeAttempt.updateMany({
    where: {
      id: attemptId,
      status: CHALLENGE_ATTEMPT_STATUS.ACTIVE,
    },
    data: {
      status: CHALLENGE_ATTEMPT_STATUS.SUBMITTED,
      submittedAt: input.submittedAt,
    },
  })

  if (submitted.count !== 1) {
    const latestAttempt = await tx.challengeAttempt.findUnique({
      where: { id: attemptId },
      select: { status: true },
    })
    const attemptStatus = latestAttempt?.status || attempt.status
    const message =
      attemptStatus === CHALLENGE_ATTEMPT_STATUS.INVALIDATED_BY_FOCUS_LOSS
        ? '本次尝试已失效，请重新进入关卡后再提交。'
        : '本次尝试已提交，请重新进入关卡后再提交。'
    throw new ChallengeAttemptError(message, 403, attemptStatus)
  }

  return attempt
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
    select: { id: true, className: true, pyPointBalance: true },
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
    pyPointBalance: student.pyPointBalance,
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
      helpDoc: chapter.helpDoc,
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

export async function getStudentChallengeLevelViewForGodot(
  studentId: string,
  chapterKey: string,
  levelKey: string
) {
  const view = await getStudentChallengeLevelView(studentId, chapterKey, levelKey)
  const levelDefinition = getChallengeLevel(chapterKey, levelKey)
  if (!view || !levelDefinition) {
    return null
  }

  const { judge: _judge, ...level } = view.level

  return {
    ...view,
    level: {
      ...level,
      publicJudge: buildGodotPublicJudge(levelDefinition),
    },
  }
}

export function judgeChallengeExecutionResult(input: {
  chapterKey: string
  levelKey: string
  code: string
  execution: GodotChallengeExecutionInput
}): ChallengeJudgeResult {
  const level = getChallengeLevel(input.chapterKey, input.levelKey)
  if (!level) {
    throw new Error('关卡不存在')
  }

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

  if (level.judge.mode === 'VARIABLES') {
    if (!input.execution.variables) {
      return {
        passed: false,
        message: '缺少变量判题结果，请先用本地运行器执行带探针的代码。',
        stdout: input.execution.stdout,
        stderr: input.execution.stderr,
      }
    }

    for (const [variableName, expectedValue] of Object.entries(level.judge.expectedVariables)) {
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
      message: '恭喜通关，结果正确。',
      stdout: input.execution.stdout,
      stderr: input.execution.stderr,
    }
  }

  if (normalizeOutput(input.execution.stdout) !== normalizeOutput(level.judge.expectedOutput)) {
    return {
      passed: false,
      message: '输出结果不正确，请对照题目要求检查输出顺序和格式。',
      stdout: input.execution.stdout,
      stderr: input.execution.stderr,
    }
  }

  return {
    passed: true,
    message: '恭喜通关，输出结果正确。',
    stdout: input.execution.stdout,
    stderr: input.execution.stderr,
  }
}

export async function submitStudentChallengeExecution(
  studentId: string,
  input: {
    chapterKey: string
    levelKey: string
    attemptId: string
    code: string
    execution: GodotChallengeExecutionInput
  }
) {
  const judgeResult = judgeChallengeExecutionResult(input)

  return submitStudentChallenge(studentId, {
    chapterKey: input.chapterKey,
    levelKey: input.levelKey,
    attemptId: input.attemptId,
    code: input.code,
    judgeResult,
  })
}

export async function submitStudentChallenge(
  studentId: string,
  input: {
    chapterKey: string
    levelKey: string
    attemptId?: string
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
    const attempt = await markChallengeAttemptSubmittedWithTx(tx, studentId, {
      attemptId: input.attemptId,
      chapterKey: input.chapterKey,
      levelKey: input.levelKey,
      submittedAt: now,
    })

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
        attemptId: attempt.id,
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
      attemptStatus: CHALLENGE_ATTEMPT_STATUS.SUBMITTED,
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
