import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { POINT_SOURCE } from '@/lib/constants'
import { evaluateQuestionAnswer, getQuestionOptionEntries } from '@/lib/quiz'
import { createStudentPointRecordWithTx } from '@/lib/student-points'
import { calculatePetStats } from '@/lib/pets/service'
import { getPetSpecies } from '@/lib/pets/registry'
import {
  CLASS_DEFENSE_COMBAT_STATUS,
  CLASS_DEFENSE_EVENT_TYPE,
  CLASS_DEFENSE_MONSTER_STATUS,
  CLASS_DEFENSE_PARTICIPANT_STATUS,
  CLASS_DEFENSE_SESSION_STATUS,
} from '@/lib/class-defense/constants'
import {
  parseClassDefenseConfig,
  normalizeClassDefenseConfig,
  type ClassDefenseConfig,
} from '@/lib/class-defense/config'
import {
  DEFAULT_CLASS_DEFENSE_MONSTER_TYPES,
  calculateClassDefenseMonsterStats,
} from '@/lib/class-defense/monsters'

type Tx = Prisma.TransactionClient

interface ClassDefenseBattleStats {
  maxHp: number
  attack: number
  defense: number
  critRate: number
  dodgeRate: number
  source: 'PET'
  pet: {
    speciesKey: string
    name: string
    title: string
    imagePath: string
    level: number
  }
}

function normalizeClassName(value?: string | null) {
  return value?.trim() || ''
}

function getStudentClassQuery(className: string) {
  return className === '__UNASSIGNED__'
    ? {
        OR: [{ className: null }, { className: '' }],
      }
    : {
        className,
      }
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000)
}

function publicQuestion(question: {
  id: string
  content: string
  type: string
  score: number
  optionA: string | null
  optionB: string | null
  optionC: string | null
  optionD: string | null
}) {
  return {
    id: question.id,
    content: question.content,
    type: question.type,
    score: question.score,
    options: getQuestionOptionEntries(question),
  }
}

async function appendEvent(
  tx: Tx,
  input: {
    sessionId: string
    type: string
    payload?: unknown
  }
) {
  const session = await tx.classDefenseSession.update({
    where: { id: input.sessionId },
    data: {
      stateVersion: {
        increment: 1,
      },
    },
    select: {
      stateVersion: true,
    },
  })

  return tx.classDefenseEvent.create({
    data: {
      sessionId: input.sessionId,
      type: input.type,
      payload: JSON.stringify(input.payload ?? {}),
      stateVersion: session.stateVersion,
    },
  })
}

function pickQuestion<T>(questions: T[]) {
  if (questions.length === 0) {
    return null
  }

  return questions[Math.floor(Math.random() * questions.length)]
}

function rollPercent(rate: number) {
  return Math.random() * 100 < Math.max(0, Math.min(100, rate))
}

function calculateDamageAfterDefense(attack: number, defense: number) {
  return Math.max(1, Math.round(attack - defense * 0.5))
}

function getFleeSuccessRate() {
  const parsed = Number(process.env.CLASS_DEFENSE_FLEE_SUCCESS_RATE ?? '50')
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 50
}

function asPositiveInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function asPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function asNonNegativeInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function normalizeImagePath(value: unknown, fallback: string) {
  const path = String(value ?? '').trim()
  return path.startsWith('/') ? path : fallback
}

async function ensureDefaultClassDefenseMonsterTypes(teacherId: string) {
  const existingCount = await prisma.classDefenseMonsterType.count({
    where: { teacherId },
  })

  if (existingCount > 0) {
    await Promise.all(
      DEFAULT_CLASS_DEFENSE_MONSTER_TYPES.map((monster) =>
        prisma.classDefenseMonsterType.updateMany({
          where: {
            teacherId,
            name: monster.name,
            imagePath: {
              startsWith: '/pets/',
            },
          },
          data: {
            imagePath: monster.imagePath,
          },
        })
      )
    )
    return
  }

  await prisma.classDefenseMonsterType.createMany({
    data: DEFAULT_CLASS_DEFENSE_MONSTER_TYPES.map((monster) => ({
      teacherId,
      ...monster,
    })),
  })
}

export async function listTeacherClassDefenseMonsterTypes(teacherId: string) {
  await ensureDefaultClassDefenseMonsterTypes(teacherId)

  return prisma.classDefenseMonsterType.findMany({
    where: { teacherId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function createTeacherClassDefenseMonsterType(
  teacherId: string,
  input: {
    name?: unknown
    baseHp?: unknown
    baseAttack?: unknown
    baseSpeed?: unknown
    imagePath?: unknown
  }
) {
  const name = String(input.name ?? '').trim()
  if (!name) {
    throw new Error('缺少怪物名称')
  }

  return prisma.classDefenseMonsterType.create({
    data: {
      teacherId,
      name,
      baseHp: asPositiveInt(input.baseHp, 30),
      baseAttack: asPositiveInt(input.baseAttack, 10),
      baseSpeed: asPositiveNumber(input.baseSpeed, 0.01),
      imagePath: normalizeImagePath(input.imagePath, '/monsters/slime.png'),
    },
  })
}

export async function updateTeacherClassDefenseMonsterType(
  teacherId: string,
  monsterTypeId: string,
  input: {
    name?: unknown
    baseHp?: unknown
    baseAttack?: unknown
    baseSpeed?: unknown
    imagePath?: unknown
  }
) {
  const existing = await prisma.classDefenseMonsterType.findFirst({
    where: {
      id: monsterTypeId,
      teacherId,
    },
  })

  if (!existing) {
    throw new Error('怪物不存在')
  }

  const name = String(input.name ?? '').trim()
  if (!name) {
    throw new Error('缺少怪物名称')
  }

  return prisma.classDefenseMonsterType.update({
    where: { id: existing.id },
    data: {
      name,
      baseHp: asPositiveInt(input.baseHp, existing.baseHp),
      baseAttack: asPositiveInt(input.baseAttack, existing.baseAttack),
      baseSpeed: asPositiveNumber(input.baseSpeed, existing.baseSpeed),
      imagePath: normalizeImagePath(input.imagePath, existing.imagePath),
    },
  })
}

export async function deleteTeacherClassDefenseMonsterType(
  teacherId: string,
  monsterTypeId: string
) {
  const monsterCount = await prisma.classDefenseMonsterType.count({
    where: { teacherId },
  })

  if (monsterCount <= 1) {
    throw new Error('至少需要保留一个怪物')
  }

  const deleted = await prisma.classDefenseMonsterType.deleteMany({
    where: {
      id: monsterTypeId,
      teacherId,
    },
  })

  if (deleted.count === 0) {
    throw new Error('怪物不存在')
  }

  return { ok: true }
}

async function resolveClassDefenseConfig(
  teacherId: string,
  input?: unknown
): Promise<ClassDefenseConfig> {
  const raw = input && typeof input === 'object'
    ? input as {
        waves?: Array<{
          waveIndex?: unknown
          startDelaySeconds?: unknown
          monsters?: Array<{
            monsterTypeId?: unknown
            level?: unknown
            quantity?: unknown
          }>
        }>
        spawnIntervalSeconds?: unknown
      }
    : {}

  const hasMonsterSelections = raw.waves?.some((wave) =>
    wave.monsters?.some((monster) => monster.monsterTypeId)
  )

  if (!hasMonsterSelections) {
    return normalizeClassDefenseConfig(input)
  }

  await ensureDefaultClassDefenseMonsterTypes(teacherId)
  const monsterTypeIds = Array.from(new Set(
    raw.waves?.flatMap((wave) =>
      wave.monsters?.map((monster) => String(monster.monsterTypeId ?? '').trim()).filter(Boolean) || []
    ) || []
  ))

  const monsterTypes = await prisma.classDefenseMonsterType.findMany({
    where: {
      teacherId,
      id: {
        in: monsterTypeIds,
      },
    },
  })
  const monsterTypeById = new Map(monsterTypes.map((monster) => [monster.id, monster] as const))
  const spawnIntervalSeconds = asNonNegativeInt(raw.spawnIntervalSeconds, 4)

  const waves = (raw.waves || [])
    .map((wave, waveIndex) => {
      let nextSpawnDelaySeconds = 0
      const monsters = (wave.monsters || []).flatMap((selection) => {
        const monsterTypeId = String(selection.monsterTypeId ?? '').trim()
        const monsterType = monsterTypeById.get(monsterTypeId)

        if (!monsterType) {
          throw new Error('选择的怪物不存在')
        }

        const level = asPositiveInt(selection.level, 1)
        const quantity = Math.min(99, asPositiveInt(selection.quantity, 1))
        const stats = calculateClassDefenseMonsterStats(monsterType, level)

        return Array.from({ length: quantity }, () => {
          const spawnDelaySeconds = nextSpawnDelaySeconds
          nextSpawnDelaySeconds += spawnIntervalSeconds

          return {
            monsterKey: monsterType.id,
            monsterName: monsterType.name,
            monsterLevel: level,
            imagePath: monsterType.imagePath,
            hp: stats.hp,
            attack: stats.attack,
            speed: stats.speed,
            spawnDelaySeconds,
          }
        })
      })

      return {
        waveIndex: asNonNegativeInt(wave.waveIndex, waveIndex),
        startDelaySeconds: asNonNegativeInt(wave.startDelaySeconds, waveIndex === 0 ? 1 : waveIndex * 30 + 1),
        monsters,
      }
    })
    .filter((wave) => wave.monsters.length > 0)

  if (waves.length === 0 || waves.every((wave) => wave.monsters.length === 0)) {
    throw new Error('请至少配置一波怪物')
  }

  return normalizeClassDefenseConfig({
    ...(input && typeof input === 'object' ? input as object : {}),
    waves,
  })
}

async function getStudentBattleStats(
  tx: Tx,
  studentId: string,
  config: ClassDefenseConfig
): Promise<ClassDefenseBattleStats> {
  const pet = await tx.studentPet.findUnique({
    where: { studentId },
    select: {
      speciesKey: true,
      level: true,
    },
  })

  if (!pet) {
    throw new Error('请先在个人中心选择宠物后再进入守护班级')
  }

  const stats = calculatePetStats(pet.speciesKey, pet.level)
  const species = getPetSpecies(pet.speciesKey)

  if (!species) {
    throw new Error('宠物类型不存在，无法进入守护班级')
  }

  return {
    ...stats,
    source: 'PET',
    pet: {
      speciesKey: pet.speciesKey,
      name: species.name,
      title: species.title,
      imagePath: species.imagePath,
      level: pet.level,
    },
  }
}

function buildPetView(pet: {
  speciesKey: string
  level: number
  nickname: string | null
} | null) {
  if (!pet) {
    return null
  }

  const species = getPetSpecies(pet.speciesKey)
  if (!species) {
    return null
  }

  return {
    speciesKey: pet.speciesKey,
    name: species.name,
    title: species.title,
    imagePath: species.imagePath,
    nickname: pet.nickname,
    level: pet.level,
    stats: calculatePetStats(pet.speciesKey, pet.level),
  }
}

async function createScheduledMonsters(
  tx: Tx,
  sessionId: string,
  config: ClassDefenseConfig,
  startedAt: Date
) {
  const monsters = config.waves.flatMap((wave) =>
    wave.monsters.map((monster) => ({
      sessionId,
      waveIndex: wave.waveIndex,
      monsterKey: monster.monsterKey,
      monsterName: monster.monsterName,
      monsterLevel: monster.monsterLevel,
      imagePath: monster.imagePath,
      status: CLASS_DEFENSE_MONSTER_STATUS.WAITING,
      hp: monster.hp,
      maxHp: monster.hp,
      attack: monster.attack,
      speed: monster.speed,
      routeProgress: 0,
      spawnedAt: addSeconds(startedAt, wave.startDelaySeconds + monster.spawnDelaySeconds),
    }))
  )

  if (monsters.length === 0) {
    return
  }

  await tx.classDefenseMonster.createMany({
    data: monsters,
  })
}

export async function createClassDefenseSession(
  teacherId: string,
  input: {
    className: string
    paperId?: string | null
    config?: unknown
  }
) {
  const className = normalizeClassName(input.className)
  if (!className) {
    throw new Error('缺少班级')
  }

  const config = await resolveClassDefenseConfig(teacherId, input.config)

  if (input.paperId) {
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
      throw new Error('试卷没有题目，无法用于守护班级')
    }
  }

  return prisma.classDefenseSession.create({
    data: {
      teacherId,
      className,
      paperId: input.paperId || null,
      classHp: config.maxClassHp,
      maxClassHp: config.maxClassHp,
      reviveSeconds: config.reviveSeconds,
      configJson: JSON.stringify(config),
    },
  })
}

export async function listTeacherClassDefenseSessions(teacherId: string) {
  return prisma.classDefenseSession.findMany({
    where: { teacherId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      _count: {
        select: {
          participants: true,
          monsters: true,
          answers: true,
        },
      },
    },
  })
}

export async function getTeacherClassDefenseSession(
  teacherId: string,
  sessionId: string
) {
  return prisma.classDefenseSession.findFirst({
    where: {
      id: sessionId,
      teacherId,
    },
    include: {
      participants: {
        orderBy: { joinedAt: 'asc' },
      },
      monsters: {
        orderBy: [{ waveIndex: 'asc' }, { spawnedAt: 'asc' }],
      },
      combats: {
        orderBy: { startedAt: 'desc' },
        take: 50,
      },
      answers: {
        orderBy: { submittedAt: 'desc' },
        take: 50,
      },
      events: {
        orderBy: { stateVersion: 'desc' },
        take: 50,
      },
    },
  })
}

export async function applyTeacherClassDefenseAction(
  teacherId: string,
  sessionId: string,
  action: string
) {
  const session = await prisma.classDefenseSession.findFirst({
    where: {
      id: sessionId,
      teacherId,
    },
  })

  if (!session) {
    throw new Error('守护班级会话不存在')
  }

  if (action === 'START') {
    if (session.status === CLASS_DEFENSE_SESSION_STATUS.ACTIVE) {
      return session
    }
    if (session.status === CLASS_DEFENSE_SESSION_STATUS.ENDED) {
      throw new Error('已结束的会话不能重新开始')
    }

    const startedAt = new Date()
    const config = parseClassDefenseConfig(session.configJson)

    return prisma.$transaction(async (tx) => {
      const updated = await tx.classDefenseSession.update({
        where: { id: session.id },
        data: {
          status: CLASS_DEFENSE_SESSION_STATUS.ACTIVE,
          startedAt,
        },
      })
      await createScheduledMonsters(tx, session.id, config, startedAt)
      await appendEvent(tx, {
        sessionId: session.id,
        type: CLASS_DEFENSE_EVENT_TYPE.SESSION_STARTED,
        payload: {
          startedAt: startedAt.toISOString(),
        },
      })
      return updated
    })
  }

  if (action === 'END') {
    return endClassDefenseSession(session.id, 'TEACHER_ENDED')
  }

  throw new Error('不支持的操作')
}

export async function endClassDefenseSession(sessionId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.classDefenseSession.update({
      where: { id: sessionId },
      data: {
        status: CLASS_DEFENSE_SESSION_STATUS.ENDED,
        endedAt: new Date(),
      },
    })
    await tx.classDefenseCombat.updateMany({
      where: {
        sessionId,
        status: CLASS_DEFENSE_COMBAT_STATUS.ACTIVE,
      },
      data: {
        status: CLASS_DEFENSE_COMBAT_STATUS.CANCELLED,
        endedAt: new Date(),
      },
    })
    await appendEvent(tx, {
      sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.SESSION_ENDED,
      payload: {
        reason,
      },
    })
    return updated
  })
}

export async function getActiveClassDefenseSessionForStudent(student: {
  id: string
  className?: string | null
}) {
  const className = normalizeClassName(student.className)
  if (!className) {
    return null
  }

  return prisma.classDefenseSession.findFirst({
    where: {
      status: CLASS_DEFENSE_SESSION_STATUS.ACTIVE,
      className,
    },
    orderBy: { startedAt: 'desc' },
  })
}

export async function joinClassDefenseSession(
  sessionId: string,
  studentId: string
) {
  const now = new Date()
  const session = await prisma.classDefenseSession.findFirst({
    where: {
      id: sessionId,
      status: CLASS_DEFENSE_SESSION_STATUS.ACTIVE,
    },
  })

  if (!session) {
    throw new Error('守护班级未开始或已结束')
  }

  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: 'STUDENT',
      ...getStudentClassQuery(session.className),
    },
    select: {
      id: true,
      username: true,
      name: true,
      className: true,
    },
  })

  if (!student) {
    throw new Error('你不在本次守护班级范围内')
  }

  const config = parseClassDefenseConfig(session.configJson)

  return prisma.$transaction(async (tx) => {
    const battleStats = await getStudentBattleStats(tx, studentId, config)
    const existing = await tx.classDefenseParticipant.findUnique({
      where: {
        sessionId_studentId: {
          sessionId,
          studentId,
        },
      },
    })
    const participant = existing
      ? await tx.classDefenseParticipant.update({
          where: { id: existing.id },
          data: {
            connectedAt: now,
            lastSeenAt: now,
            maxHp: battleStats.maxHp,
            hp: Math.min(existing.hp, battleStats.maxHp),
          },
        })
      : await tx.classDefenseParticipant.create({
          data: {
            sessionId,
            studentId,
            status: CLASS_DEFENSE_PARTICIPANT_STATUS.ALIVE,
            hp: battleStats.maxHp,
            maxHp: battleStats.maxHp,
            connectedAt: now,
            lastSeenAt: now,
          },
        })

    await appendEvent(tx, {
      sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.STUDENT_JOINED,
      payload: {
        studentId,
        name: student.name,
        battleStats,
      },
    })

    return {
      student,
      participant,
      battleStats,
    }
  })
}

export async function markClassDefenseHeartbeat(
  sessionId: string,
  studentId: string
) {
  await prisma.classDefenseParticipant.updateMany({
    where: {
      sessionId,
      studentId,
    },
    data: {
      lastSeenAt: new Date(),
    },
  })
}

export async function getClassDefenseSnapshot(
  sessionId: string,
  studentId?: string | null
) {
  const [session, participants, monsters, activeCombat] = await Promise.all([
    prisma.classDefenseSession.findUnique({
      where: { id: sessionId },
    }),
    prisma.classDefenseParticipant.findMany({
      where: { sessionId },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.classDefenseMonster.findMany({
      where: { sessionId },
      orderBy: [{ waveIndex: 'asc' }, { spawnedAt: 'asc' }],
    }),
    studentId
      ? prisma.classDefenseCombat.findFirst({
          where: {
            sessionId,
            studentId,
            status: CLASS_DEFENSE_COMBAT_STATUS.ACTIVE,
          },
          orderBy: { startedAt: 'desc' },
        })
      : null,
  ])

  if (!session) {
    throw new Error('守护班级会话不存在')
  }

  const students = await prisma.user.findMany({
    where: {
      id: {
        in: participants.map((participant) => participant.studentId),
      },
    },
    select: {
      id: true,
      username: true,
      name: true,
      className: true,
      pet: {
        select: {
          speciesKey: true,
          nickname: true,
          level: true,
        },
      },
    },
  })
  const studentMap = new Map(students.map((student) => [student.id, student] as const))
  const participantViews = participants.map((participant) => {
    const currentStudent = studentMap.get(participant.studentId)

    return {
      ...participant,
      student: currentStudent
        ? {
            id: currentStudent.id,
            username: currentStudent.username,
            name: currentStudent.name,
            className: currentStudent.className,
          }
        : null,
      pet: buildPetView(currentStudent?.pet || null),
    }
  })

  return {
    serverTime: new Date().toISOString(),
    session,
    participants: participantViews,
    monsters,
    activeCombat,
  }
}

export async function startClassDefenseCombat(input: {
  sessionId: string
  studentId: string
  monsterId: string
}) {
  const now = new Date()
  const session = await prisma.classDefenseSession.findFirst({
    where: {
      id: input.sessionId,
      status: CLASS_DEFENSE_SESSION_STATUS.ACTIVE,
    },
  })

  if (!session) {
    throw new Error('守护班级未开始或已结束')
  }

  if (!session.paperId) {
    throw new Error('本局游戏没有绑定题库试卷')
  }

  const config = parseClassDefenseConfig(session.configJson)
  const questions = await prisma.paperQuestion.findMany({
    where: {
      paperId: session.paperId,
    },
    orderBy: { orderIndex: 'asc' },
  })
  const question = pickQuestion(questions)

  if (!question) {
    throw new Error('题库为空，无法进入战斗')
  }

  const combat = await prisma.$transaction(async (tx) => {
    const participant = await tx.classDefenseParticipant.findUnique({
      where: {
        sessionId_studentId: {
          sessionId: input.sessionId,
          studentId: input.studentId,
        },
      },
    })

    if (!participant) {
      throw new Error('请先进入守护班级')
    }

    if (
      participant.status !== CLASS_DEFENSE_PARTICIPANT_STATUS.ALIVE ||
      (participant.reviveAt && participant.reviveAt > now)
    ) {
      throw new Error('你正在等待复活')
    }

    await getStudentBattleStats(tx, input.studentId, config)

    const activeCombatCount = await tx.classDefenseCombat.count({
      where: {
        sessionId: input.sessionId,
        studentId: input.studentId,
        status: CLASS_DEFENSE_COMBAT_STATUS.ACTIVE,
      },
    })

    if (activeCombatCount > 0) {
      throw new Error('你已经在战斗中')
    }

    const locked = await tx.classDefenseMonster.updateMany({
      where: {
        id: input.monsterId,
        sessionId: input.sessionId,
        status: CLASS_DEFENSE_MONSTER_STATUS.WALKING,
        lockedByStudentId: null,
      },
      data: {
        status: CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
        lockedByStudentId: input.studentId,
        lockExpiresAt: addSeconds(now, config.combatSeconds),
      },
    })

    if (locked.count !== 1) {
      throw new Error('怪物已被其他同学锁定或不可攻击')
    }

    const created = await tx.classDefenseCombat.create({
      data: {
        sessionId: input.sessionId,
        monsterId: input.monsterId,
        studentId: input.studentId,
        paperQuestionId: question.id,
        status: CLASS_DEFENSE_COMBAT_STATUS.ACTIVE,
        expiresAt: addSeconds(now, config.combatSeconds),
      },
    })

    await appendEvent(tx, {
      sessionId: input.sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_LOCKED,
      payload: {
        monsterId: input.monsterId,
        studentId: input.studentId,
        combatId: created.id,
        lockExpiresAt: addSeconds(now, config.combatSeconds).toISOString(),
      },
    })
    await appendEvent(tx, {
      sessionId: input.sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.COMBAT_STARTED,
      payload: {
        combatId: created.id,
        monsterId: input.monsterId,
        studentId: input.studentId,
        questionId: question.id,
      },
    })

    return created
  })

  return {
    combat,
    question: publicQuestion(question),
  }
}

export async function submitClassDefenseAnswer(input: {
  combatId: string
  studentId: string
  answer: string
}) {
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const combat = await tx.classDefenseCombat.findFirst({
      where: {
        id: input.combatId,
        studentId: input.studentId,
        status: CLASS_DEFENSE_COMBAT_STATUS.ACTIVE,
      },
      include: {
        session: true,
        monster: true,
      },
    })

    if (!combat) {
      throw new Error('战斗不存在或已结束')
    }

    if (combat.expiresAt && combat.expiresAt < now) {
      await tx.classDefenseCombat.update({
        where: { id: combat.id },
        data: {
          status: CLASS_DEFENSE_COMBAT_STATUS.EXPIRED,
          endedAt: now,
        },
      })
      await tx.classDefenseMonster.update({
        where: { id: combat.monsterId },
        data: {
          status: CLASS_DEFENSE_MONSTER_STATUS.WALKING,
          lockedByStudentId: null,
          lockExpiresAt: null,
        },
      })
      await appendEvent(tx, {
        sessionId: combat.sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_RELEASED,
        payload: {
          monsterId: combat.monsterId,
          reason: 'COMBAT_EXPIRED',
        },
      })
      throw new Error('答题超时')
    }

    const question = await tx.paperQuestion.findUnique({
      where: { id: combat.paperQuestionId },
    })

    if (!question) {
      throw new Error('题目不存在')
    }

    const config = parseClassDefenseConfig(combat.session.configJson)
    if (!combat.session.paperId) {
      throw new Error('本局游戏没有绑定题库试卷')
    }

    const questions = await tx.paperQuestion.findMany({
      where: {
        paperId: combat.session.paperId,
      },
      orderBy: { orderIndex: 'asc' },
    })
    if (questions.length === 0) {
      throw new Error('题库为空，无法继续战斗')
    }

    const isCorrect = evaluateQuestionAnswer(question, input.answer)

    const participant = await tx.classDefenseParticipant.findUnique({
      where: {
        sessionId_studentId: {
          sessionId: combat.sessionId,
          studentId: input.studentId,
        },
      },
    })

    if (!participant) {
      throw new Error('参战学生不存在')
    }

    const battleStats = await getStudentBattleStats(tx, input.studentId, config)
    const isCritical = isCorrect && rollPercent(battleStats.critRate)
    const isDodged = !isCorrect && rollPercent(battleStats.dodgeRate)
    const damageToMonster = isCorrect
      ? Math.max(1, Math.round(battleStats.attack * (isCritical ? 2 : 1)))
      : 0
    const damageToStudent = isCorrect || isDodged
      ? 0
      : calculateDamageAfterDefense(combat.monster.attack, battleStats.defense)
    const nextMonsterHp = Math.max(0, combat.monster.hp - damageToMonster)
    const monsterKilled = nextMonsterHp <= 0
    const nextStudentHp = Math.max(0, participant.hp - damageToStudent)
    const studentDown = nextStudentHp <= 0
    const reviveAt = studentDown ? addSeconds(now, config.reviveSeconds) : null
    const roundIndex = await tx.classDefenseAnswer.count({
      where: {
        combatId: combat.id,
      },
    }) + 1
    const battleEnded = monsterKilled || studentDown
    const nextQuestion = battleEnded ? null : pickQuestion(questions)

    if (!battleEnded && !nextQuestion) {
      throw new Error('题库为空，无法继续战斗')
    }

    await tx.classDefenseAnswer.create({
      data: {
        combatId: combat.id,
        sessionId: combat.sessionId,
        studentId: input.studentId,
        monsterId: combat.monsterId,
        roundIndex,
        paperQuestionId: combat.paperQuestionId,
        answer: input.answer,
        isCorrect,
        submittedAt: now,
      },
    })

    await tx.classDefenseCombat.update({
      where: { id: combat.id },
      data: {
        status: battleEnded
          ? CLASS_DEFENSE_COMBAT_STATUS.RESOLVED
          : CLASS_DEFENSE_COMBAT_STATUS.ACTIVE,
        paperQuestionId: nextQuestion?.id || combat.paperQuestionId,
        expiresAt: battleEnded ? combat.expiresAt : addSeconds(now, config.combatSeconds),
        endedAt: battleEnded ? now : null,
        isCorrect,
        damageToMonster,
        damageToStudent,
      },
    })

    await tx.classDefenseMonster.update({
      where: { id: combat.monsterId },
      data: {
        hp: nextMonsterHp,
        status: monsterKilled
          ? CLASS_DEFENSE_MONSTER_STATUS.KILLED
          : studentDown
            ? CLASS_DEFENSE_MONSTER_STATUS.WALKING
            : CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
        lockedByStudentId: battleEnded ? null : input.studentId,
        lockExpiresAt: battleEnded ? null : addSeconds(now, config.combatSeconds),
        killedAt: monsterKilled ? now : null,
      },
    })

    await tx.classDefenseParticipant.update({
      where: {
        sessionId_studentId: {
          sessionId: combat.sessionId,
          studentId: input.studentId,
        },
      },
      data: {
        hp: nextStudentHp,
        maxHp: battleStats.maxHp,
        status: studentDown
          ? CLASS_DEFENSE_PARTICIPANT_STATUS.DOWN
          : CLASS_DEFENSE_PARTICIPANT_STATUS.ALIVE,
        reviveAt,
      },
    })

    if (monsterKilled && config.killPointReward > 0) {
      await createStudentPointRecordWithTx(tx, {
        studentId: input.studentId,
        delta: config.killPointReward,
        reason: `守护班级击杀怪物奖励`,
        occurredAt: now,
        source: POINT_SOURCE.CLASS_DEFENSE,
      })
    }

    await appendEvent(tx, {
      sessionId: combat.sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.COMBAT_RESULT,
      payload: {
        combatId: combat.id,
        roundIndex,
        monsterId: combat.monsterId,
        studentId: input.studentId,
        isCorrect,
        damageToMonster,
        damageToStudent,
        isCritical,
        isDodged,
        battleStats,
        monsterHp: nextMonsterHp,
        studentHp: nextStudentHp,
        battleEnded,
        nextQuestion: nextQuestion ? publicQuestion(nextQuestion) : null,
        reviveAt: reviveAt?.toISOString() || null,
      },
    })

    if (monsterKilled) {
      await appendEvent(tx, {
        sessionId: combat.sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_KILLED,
        payload: {
          monsterId: combat.monsterId,
          studentId: input.studentId,
        },
      })
    } else if (studentDown) {
      await appendEvent(tx, {
        sessionId: combat.sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_RELEASED,
        payload: {
          monsterId: combat.monsterId,
          reason: 'STUDENT_DOWN',
        },
      })
    }

    if (studentDown) {
      await appendEvent(tx, {
        sessionId: combat.sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.STUDENT_DOWN,
        payload: {
          studentId: input.studentId,
          reviveAt: reviveAt?.toISOString() || null,
        },
      })
    }

    return {
      combatId: combat.id,
      sessionId: combat.sessionId,
      monsterId: combat.monsterId,
      roundIndex,
      isCorrect,
      damageToMonster,
      damageToStudent,
      isCritical,
      isDodged,
      battleStats,
      monsterHp: nextMonsterHp,
      monsterKilled,
      studentHp: nextStudentHp,
      studentDown,
      battleEnded,
      nextQuestion: nextQuestion ? publicQuestion(nextQuestion) : null,
      reviveAt,
    }
  })
}

export async function fleeClassDefenseCombat(input: {
  combatId: string
  studentId: string
  monsterId: string
}) {
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const combat = await tx.classDefenseCombat.findFirst({
      where: {
        id: input.combatId,
        studentId: input.studentId,
        status: CLASS_DEFENSE_COMBAT_STATUS.ACTIVE,
      },
      include: {
        session: true,
        monster: true,
      },
    })

    if (!combat || combat.monsterId !== input.monsterId) {
      throw new Error('当前战斗不存在或不能逃跑')
    }

    if (combat.expiresAt && combat.expiresAt < now) {
      await tx.classDefenseCombat.update({
        where: { id: combat.id },
        data: {
          status: CLASS_DEFENSE_COMBAT_STATUS.EXPIRED,
          endedAt: now,
        },
      })
      await tx.classDefenseMonster.update({
        where: { id: combat.monsterId },
        data: {
          status: CLASS_DEFENSE_MONSTER_STATUS.WALKING,
          lockedByStudentId: null,
          lockExpiresAt: null,
        },
      })
      await appendEvent(tx, {
        sessionId: combat.sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_RELEASED,
        payload: {
          monsterId: combat.monsterId,
          reason: 'COMBAT_EXPIRED',
        },
      })
      throw new Error('当前战斗已超时')
    }

    if (
      combat.monster.status !== CLASS_DEFENSE_MONSTER_STATUS.COMBAT ||
      combat.monster.lockedByStudentId !== input.studentId
    ) {
      throw new Error('当前战斗不存在或不能逃跑')
    }

    const success = rollPercent(getFleeSuccessRate())

    if (success) {
      await tx.classDefenseCombat.update({
        where: { id: combat.id },
        data: {
          status: CLASS_DEFENSE_COMBAT_STATUS.CANCELLED,
          endedAt: now,
        },
      })
      await tx.classDefenseMonster.update({
        where: { id: combat.monsterId },
        data: {
          status: CLASS_DEFENSE_MONSTER_STATUS.WALKING,
          lockedByStudentId: null,
          lockExpiresAt: null,
        },
      })
      await appendEvent(tx, {
        sessionId: combat.sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_RELEASED,
        payload: {
          monsterId: combat.monsterId,
          studentId: input.studentId,
          combatId: combat.id,
          reason: 'FLEE_SUCCESS',
        },
      })
    }

    return {
      combatId: combat.id,
      sessionId: combat.sessionId,
      monsterId: combat.monsterId,
      studentId: input.studentId,
      success,
      escaped: success,
      isSuccess: success,
      fleeSucceeded: success,
      isEscaped: success,
      battleEnded: success,
      message: success
        ? '逃跑成功，已脱离战斗。'
        : '逃跑失败，需要先答一道题才能再次逃跑。',
    }
  })
}

export async function tickClassDefenseSession(sessionId: string) {
  const now = new Date()

  const changed = await prisma.$transaction(async (tx) => {
    const session = await tx.classDefenseSession.findUnique({
      where: { id: sessionId },
    })

    if (!session || session.status !== CLASS_DEFENSE_SESSION_STATUS.ACTIVE) {
      return false
    }

    const config = parseClassDefenseConfig(session.configJson)

    const expiredCombats = await tx.classDefenseCombat.findMany({
      where: {
        sessionId,
        status: CLASS_DEFENSE_COMBAT_STATUS.ACTIVE,
        expiresAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        monsterId: true,
      },
    })

    if (expiredCombats.length > 0) {
      await tx.classDefenseCombat.updateMany({
        where: {
          id: {
            in: expiredCombats.map((combat) => combat.id),
          },
        },
        data: {
          status: CLASS_DEFENSE_COMBAT_STATUS.EXPIRED,
          endedAt: now,
        },
      })
      await tx.classDefenseMonster.updateMany({
        where: {
          id: {
            in: expiredCombats.map((combat) => combat.monsterId),
          },
          status: CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
        },
        data: {
          status: CLASS_DEFENSE_MONSTER_STATUS.WALKING,
          lockedByStudentId: null,
          lockExpiresAt: null,
        },
      })
      for (const combat of expiredCombats) {
        await appendEvent(tx, {
          sessionId,
          type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_RELEASED,
          payload: {
            monsterId: combat.monsterId,
            reason: 'COMBAT_EXPIRED',
          },
        })
      }
    }

    const revivableParticipants = await tx.classDefenseParticipant.findMany({
      where: {
        sessionId,
        status: CLASS_DEFENSE_PARTICIPANT_STATUS.DOWN,
        reviveAt: {
          lte: now,
        },
      },
    })

    for (const participant of revivableParticipants) {
      await tx.classDefenseParticipant.update({
        where: { id: participant.id },
        data: {
          status: CLASS_DEFENSE_PARTICIPANT_STATUS.ALIVE,
          hp: participant.maxHp,
          reviveAt: null,
        },
      })
      await appendEvent(tx, {
        sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.STUDENT_REVIVED,
        payload: {
          studentId: participant.studentId,
          hp: participant.maxHp,
        },
      })
    }

    const waitingMonsters = await tx.classDefenseMonster.findMany({
      where: {
        sessionId,
        status: CLASS_DEFENSE_MONSTER_STATUS.WAITING,
        spawnedAt: {
          lte: now,
        },
      },
    })

    for (const monster of waitingMonsters) {
      await tx.classDefenseMonster.update({
        where: { id: monster.id },
        data: {
          status: CLASS_DEFENSE_MONSTER_STATUS.WALKING,
          updatedAt: now,
        },
      })
      await appendEvent(tx, {
        sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_SPAWNED,
        payload: {
          monsterId: monster.id,
          monsterKey: monster.monsterKey,
          monsterName: monster.monsterName,
          monsterLevel: monster.monsterLevel,
          imagePath: monster.imagePath,
          waveIndex: monster.waveIndex,
        },
      })
    }

    const walkingMonsters = await tx.classDefenseMonster.findMany({
      where: {
        sessionId,
        status: CLASS_DEFENSE_MONSTER_STATUS.WALKING,
      },
    })

    let nextClassHp = session.classHp
    for (const monster of walkingMonsters) {
      const elapsedSeconds = Math.max(
        0,
        (now.getTime() - monster.updatedAt.getTime()) / 1000
      )
      const nextProgress = Math.min(1, monster.routeProgress + monster.speed * elapsedSeconds)

      if (nextProgress >= 1) {
        nextClassHp = Math.max(0, nextClassHp - 1)
        await tx.classDefenseMonster.update({
          where: { id: monster.id },
          data: {
            status: CLASS_DEFENSE_MONSTER_STATUS.REACHED,
            routeProgress: 1,
            reachedAt: now,
          },
        })
        await appendEvent(tx, {
          sessionId,
          type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_REACHED,
          payload: {
            monsterId: monster.id,
            classHp: nextClassHp,
          },
        })
      } else if (nextProgress !== monster.routeProgress) {
        await tx.classDefenseMonster.update({
          where: { id: monster.id },
          data: {
            routeProgress: nextProgress,
          },
        })
      }
    }

    if (nextClassHp !== session.classHp) {
      await tx.classDefenseSession.update({
        where: { id: sessionId },
        data: {
          classHp: nextClassHp,
        },
      })
      await appendEvent(tx, {
        sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.CLASS_HP_CHANGED,
        payload: {
          classHp: nextClassHp,
          maxClassHp: session.maxClassHp,
        },
      })
    }

    const remainingMonsters = await tx.classDefenseMonster.count({
      where: {
        sessionId,
        status: {
          in: [
            CLASS_DEFENSE_MONSTER_STATUS.WAITING,
            CLASS_DEFENSE_MONSTER_STATUS.WALKING,
            CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
          ],
        },
      },
    })

    if (nextClassHp <= 0) {
      await tx.classDefenseSession.update({
        where: { id: sessionId },
        data: {
          status: CLASS_DEFENSE_SESSION_STATUS.ENDED,
          endedAt: now,
        },
      })
      await appendEvent(tx, {
        sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.SESSION_ENDED,
        payload: {
          reason: 'CLASS_HP_ZERO',
        },
      })
    } else if (remainingMonsters === 0) {
      await tx.classDefenseSession.update({
        where: { id: sessionId },
        data: {
          status: CLASS_DEFENSE_SESSION_STATUS.ENDED,
          endedAt: now,
        },
      })
      await appendEvent(tx, {
        sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.SESSION_ENDED,
        payload: {
          reason: 'ALL_MONSTERS_CLEARED',
        },
      })
    }

    return true
  })

  if (!changed) {
    return null
  }

  return getClassDefenseSnapshot(sessionId)
}
