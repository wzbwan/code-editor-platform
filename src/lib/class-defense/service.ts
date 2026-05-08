import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { POINT_SOURCE } from '@/lib/constants'
import { evaluateQuestionAnswer, getQuestionOptionEntries } from '@/lib/quiz'
import { createStudentPointRecordWithTx } from '@/lib/student-points'
import { calculatePetStats, convertPointDeltaToPetExp } from '@/lib/pets/service'
import { getPetSpecies } from '@/lib/pets/registry'
import {
  CLASS_DEFENSE_COMBAT_STATUS,
  CLASS_DEFENSE_DIRECTIONS,
  CLASS_DEFENSE_DIRECTION_IDS,
  CLASS_DEFENSE_EVENT_TYPE,
  CLASS_DEFENSE_MONSTER_STATUS,
  CLASS_DEFENSE_PARTICIPANT_STATUS,
  CLASS_DEFENSE_SESSION_STATUS,
  type ClassDefenseDirectionId,
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

type ClassDefenseCombatWithSessionMonster = Prisma.ClassDefenseCombatGetPayload<{
  include: {
    session: true
    monster: true
  }
}>

interface ClassDefenseCombatResult {
  combatId: string
  sessionId: string
  monsterId: string
  bossId?: string
  directionId: ClassDefenseDirectionId | null
  studentId: string
  roundIndex: number
  isCorrect: boolean
  isBoss?: boolean
  damageToBoss?: number
  damageToMonster: number
  damageToStudent: number
  isCritical: boolean
  isDodged: boolean
  battleStats: ClassDefenseBattleStats
  bossHp?: number
  bossMaxHp?: number
  myDamage?: number
  totalDamage?: number
  bossDefeated?: boolean
  bossDefeatedNow?: boolean
  monsterHp: number
  monsterKilled: boolean
  studentHp: number
  studentDown: boolean
  battleEnded: boolean
  nextQuestion: ReturnType<typeof publicQuestion> | null
  reviveAt: Date | null
  rewards?: ClassDefenseBossReward[]
}

interface ClassDefenseCombatCancellation {
  combatId: string
  sessionId: string
  monsterId: string
  studentId: string
  reason: string
}

interface ClassDefenseReachedMonster {
  monsterId: string
  sessionId: string
  directionId: ClassDefenseDirectionId
  classHp: number
  classHpChanged: boolean
}

type ClassDefenseSessionEndResult = 'VICTORY' | 'FAILURE'

interface ClassDefenseSessionEndState {
  result: ClassDefenseSessionEndResult
  reason: string
}

interface ClassDefenseEventInput {
  sessionId: string
  type: string
  payload?: unknown
}

interface ClassDefenseBossReward {
  studentId: string
  damage: number
  expReward: number
  pointReward: number
}

interface ClassDefenseQuestionRecord {
  id: string
  content: string
  type: string
  score: number
  answer: string
  optionA: string | null
  optionB: string | null
  optionC: string | null
  optionD: string | null
}

const CLASS_DEFENSE_SESSION_END_REASONS = {
  ALL_MONSTERS_ENDED: 'ALL_MONSTERS_ENDED',
  CLASS_HP_ZERO: 'CLASS_HP_ZERO',
} as const

const CLASS_DEFENSE_SESSION_BLOCKING_MONSTER_STATUSES = [
  CLASS_DEFENSE_MONSTER_STATUS.WAITING,
  CLASS_DEFENSE_MONSTER_STATUS.WALKING,
  CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
] as const

interface ClassDefenseBossRuntimeState {
  id: string
  directionId: ClassDefenseDirectionId
  monsterKey: string
  monsterName: string | null
  monsterLevel: number
  imagePath: string | null
  waveIndex: number
  laneIndex: number
  phase: number
  hp: number
  maxHp: number
  attack: number
  status: 'WAITING' | 'ACTIVE' | 'DEFEATED' | 'ESCAPED'
  routeProgress: number
  spawnedAt: Date
  contributionByStudentId: Map<string, number>
  settlementStarted: boolean
}

interface ClassDefenseBossCombatRuntimeState {
  id: string
  sessionId: string
  bossId: string
  studentId: string
  directionId: ClassDefenseDirectionId
  question: ClassDefenseQuestionRecord
  waveIndex: number
  startedAt: Date
  expiresAt: Date
}

interface ClassDefenseRuntimeParticipantState {
  hp: number
  maxHp: number
  status: 'ALIVE' | 'DOWN'
  reviveAt: Date | null
}

interface ClassDefenseBossRoomRuntimeState {
  bosses: Map<string, ClassDefenseBossRuntimeState>
  activeCombats: Map<string, ClassDefenseBossCombatRuntimeState>
  participantByStudentId: Map<string, ClassDefenseRuntimeParticipantState>
  questionCacheByPaperId: Map<string, ClassDefenseQuestionRecord[]>
}

const bossRoomRuntimeBySessionId = new Map<string, ClassDefenseBossRoomRuntimeState>()

function normalizeClassName(value?: string | null) {
  return value?.trim() || ''
}

function isClassDefenseDirectionId(value: unknown): value is ClassDefenseDirectionId {
  return CLASS_DEFENSE_DIRECTION_IDS.includes(String(value ?? '') as ClassDefenseDirectionId)
}

function requireClassDefenseDirectionId(value: unknown) {
  const directionId = String(value ?? '').trim()
  if (!isClassDefenseDirectionId(directionId)) {
    throw new Error('方向不存在')
  }

  return directionId
}

function assertDirectionEnabled(
  directionId: ClassDefenseDirectionId,
  enabledDirections: ClassDefenseDirectionId[]
) {
  if (!enabledDirections.includes(directionId)) {
    throw new Error('该方向未开启')
  }
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

function normalizeSessionEndReason(reason: unknown) {
  const value = String(reason ?? '').trim()
  if (value === 'ALL_MONSTERS_CLEARED') {
    return CLASS_DEFENSE_SESSION_END_REASONS.ALL_MONSTERS_ENDED
  }
  return value || null
}

function getSessionEndResult(reason: string | null): ClassDefenseSessionEndResult | null {
  if (reason === CLASS_DEFENSE_SESSION_END_REASONS.CLASS_HP_ZERO) {
    return 'FAILURE'
  }
  if (reason === CLASS_DEFENSE_SESSION_END_REASONS.ALL_MONSTERS_ENDED) {
    return 'VICTORY'
  }
  return null
}

function getSessionEndStateFromReason(reason: unknown) {
  const normalizedReason = normalizeSessionEndReason(reason)
  const result = getSessionEndResult(normalizedReason)
  return result && normalizedReason
    ? { result, reason: normalizedReason }
    : { result: null, reason: normalizedReason }
}

function getSessionEndEventReason(payload: unknown) {
  const parsed = typeof payload === 'string'
    ? (() => {
        try {
          return JSON.parse(payload) as unknown
        } catch {
          return null
        }
      })()
    : payload

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }

  return (parsed as { reason?: unknown }).reason ?? null
}

async function getLatestClassDefenseSessionEndState(sessionId: string) {
  const event = await prisma.classDefenseEvent.findFirst({
    where: {
      sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.SESSION_ENDED,
    },
    orderBy: {
      stateVersion: 'desc',
    },
    select: {
      payload: true,
    },
  })

  return getSessionEndStateFromReason(
    event ? getSessionEndEventReason(event.payload) : null
  )
}

function buildClassDefenseSessionView<T extends {
  id: string
  status: string
  classHp: number
  maxClassHp: number
}>(
  session: T,
  endState: Awaited<ReturnType<typeof getLatestClassDefenseSessionEndState>>,
  enabledDirections: ClassDefenseDirectionId[]
) {
  return {
    ...session,
    result: session.status === CLASS_DEFENSE_SESSION_STATUS.ENDED ? endState.result : null,
    reason: session.status === CLASS_DEFENSE_SESSION_STATUS.ENDED ? endState.reason : null,
    enabledDirections,
  }
}

function getBossRoomRuntime(sessionId: string) {
  let room = bossRoomRuntimeBySessionId.get(sessionId)
  if (!room) {
    room = {
      bosses: new Map(),
      activeCombats: new Map(),
      participantByStudentId: new Map(),
      questionCacheByPaperId: new Map(),
    }
    bossRoomRuntimeBySessionId.set(sessionId, room)
  }

  return room
}

function getRuntimeBossStatus(dbStatus: string): ClassDefenseBossRuntimeState['status'] {
  if (dbStatus === CLASS_DEFENSE_MONSTER_STATUS.WAITING) {
    return 'WAITING'
  }
  if (dbStatus === CLASS_DEFENSE_MONSTER_STATUS.KILLED) {
    return 'DEFEATED'
  }
  if (dbStatus === CLASS_DEFENSE_MONSTER_STATUS.REACHED) {
    return 'ESCAPED'
  }
  return 'ACTIVE'
}

function getDbMonsterStatusForRuntimeBoss(status: ClassDefenseBossRuntimeState['status']) {
  if (status === 'WAITING') {
    return CLASS_DEFENSE_MONSTER_STATUS.WAITING
  }
  if (status === 'DEFEATED') {
    return CLASS_DEFENSE_MONSTER_STATUS.KILLED
  }
  if (status === 'ESCAPED') {
    return CLASS_DEFENSE_MONSTER_STATUS.REACHED
  }
  return CLASS_DEFENSE_MONSTER_STATUS.WALKING
}

function syncRuntimeBossFromDb(
  sessionId: string,
  monster: {
    id: string
    directionId: string
    monsterKey: string
    monsterName: string | null
    monsterLevel: number
    imagePath: string | null
    waveIndex: number
    laneIndex: number | null
    hp: number
    maxHp: number
    attack: number
    status: string
    routeProgress: number
    spawnedAt: Date
  }
) {
  if (!isClassDefenseDirectionId(monster.directionId)) {
    return null
  }

  const room = getBossRoomRuntime(sessionId)
  let boss = room.bosses.get(monster.id)
  if (!boss) {
    boss = {
      id: monster.id,
      directionId: monster.directionId,
      monsterKey: monster.monsterKey,
      monsterName: monster.monsterName,
      monsterLevel: monster.monsterLevel,
      imagePath: monster.imagePath,
      waveIndex: monster.waveIndex,
      laneIndex: monster.laneIndex ?? 0,
      phase: 1,
      hp: Math.max(0, monster.hp),
      maxHp: monster.maxHp,
      attack: monster.attack,
      status: getRuntimeBossStatus(monster.status),
      routeProgress: monster.routeProgress,
      spawnedAt: monster.spawnedAt,
      contributionByStudentId: new Map(),
      settlementStarted: monster.status === CLASS_DEFENSE_MONSTER_STATUS.KILLED,
    }
    room.bosses.set(monster.id, boss)
    return boss
  }

  boss.directionId = monster.directionId
  boss.monsterKey = monster.monsterKey
  boss.monsterName = monster.monsterName
  boss.monsterLevel = monster.monsterLevel
  boss.imagePath = monster.imagePath
  boss.waveIndex = monster.waveIndex
  boss.laneIndex = monster.laneIndex ?? boss.laneIndex
  boss.maxHp = monster.maxHp
  boss.attack = monster.attack
  boss.routeProgress = monster.routeProgress
  boss.spawnedAt = monster.spawnedAt

  const dbRuntimeStatus = getRuntimeBossStatus(monster.status)
  if (boss.status !== 'DEFEATED' && boss.status !== 'ESCAPED') {
    boss.status = dbRuntimeStatus
  }
  if (monster.status === CLASS_DEFENSE_MONSTER_STATUS.KILLED) {
    boss.status = 'DEFEATED'
    boss.hp = 0
    boss.settlementStarted = true
  } else if (monster.status === CLASS_DEFENSE_MONSTER_STATUS.REACHED) {
    boss.status = 'ESCAPED'
  }

  return boss
}

function getRuntimeParticipant(
  room: ClassDefenseBossRoomRuntimeState,
  studentId: string,
  fallback: {
    hp: number
    maxHp: number
    status: string
    reviveAt: Date | null
  },
  battleStats: ClassDefenseBattleStats,
  now: Date
) {
  let participant = room.participantByStudentId.get(studentId)
  if (!participant) {
    participant = {
      hp: Math.min(fallback.hp, battleStats.maxHp),
      maxHp: battleStats.maxHp,
      status: fallback.status === CLASS_DEFENSE_PARTICIPANT_STATUS.DOWN ? 'DOWN' : 'ALIVE',
      reviveAt: fallback.reviveAt,
    }
    room.participantByStudentId.set(studentId, participant)
  }

  participant.maxHp = battleStats.maxHp
  if (participant.status === 'DOWN' && participant.reviveAt && participant.reviveAt <= now) {
    participant.status = 'ALIVE'
    participant.hp = participant.maxHp
    participant.reviveAt = null
  }

  return participant
}

function getBossTotalDamage(boss: ClassDefenseBossRuntimeState) {
  return Array.from(boss.contributionByStudentId.values())
    .reduce((sum, damage) => sum + damage, 0)
}

async function appendEvent(
  tx: Tx,
  input: ClassDefenseEventInput
) {
  return appendEvents(tx, [input])
}

async function appendEvents(tx: Tx, inputs: ClassDefenseEventInput[]) {
  if (inputs.length === 0) {
    return { count: 0 }
  }

  const sessionId = inputs[0].sessionId
  if (inputs.some((input) => input.sessionId !== sessionId)) {
    throw new Error('事件批量写入必须属于同一守护班级会话')
  }

  const session = await tx.classDefenseSession.update({
    where: { id: sessionId },
    data: {
      stateVersion: {
        increment: inputs.length,
      },
    },
    select: {
      stateVersion: true,
    },
  })
  const firstStateVersion = session.stateVersion - inputs.length + 1

  return tx.classDefenseEvent.createMany({
    data: inputs.map((input, index) => ({
      sessionId,
      type: input.type,
      payload: JSON.stringify(input.payload ?? {}),
      stateVersion: firstStateVersion + index,
    })),
  })
}

async function finalizeClassDefenseSessionIfEndedWithTx(
  tx: Tx,
  sessionId: string,
  now: Date
): Promise<ClassDefenseSessionEndState | null> {
  const session = await tx.classDefenseSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      classHp: true,
    },
  })

  if (!session || session.status !== CLASS_DEFENSE_SESSION_STATUS.ACTIVE) {
    return null
  }

  let endState: ClassDefenseSessionEndState | null = null
  if (session.classHp <= 0) {
    endState = {
      result: 'FAILURE',
      reason: CLASS_DEFENSE_SESSION_END_REASONS.CLASS_HP_ZERO,
    }
  } else {
    const blockingMonsterCount = await tx.classDefenseMonster.count({
      where: {
        sessionId,
        status: {
          in: [...CLASS_DEFENSE_SESSION_BLOCKING_MONSTER_STATUSES],
        },
      },
    })

    if (blockingMonsterCount === 0) {
      endState = {
        result: 'VICTORY',
        reason: CLASS_DEFENSE_SESSION_END_REASONS.ALL_MONSTERS_ENDED,
      }
    }
  }

  if (!endState) {
    return null
  }

  await tx.classDefenseSession.update({
    where: { id: sessionId },
    data: {
      status: CLASS_DEFENSE_SESSION_STATUS.ENDED,
      endedAt: now,
    },
  })
  await tx.classDefenseCombat.updateMany({
    where: {
      sessionId,
      status: CLASS_DEFENSE_COMBAT_STATUS.ACTIVE,
    },
    data: {
      status: CLASS_DEFENSE_COMBAT_STATUS.CANCELLED,
      endedAt: now,
    },
  })
  await appendEvent(tx, {
    sessionId,
    type: CLASS_DEFENSE_EVENT_TYPE.SESSION_ENDED,
    payload: endState,
  })

  return endState
}

async function pickQuestionForWaveFromDb(
  tx: Tx,
  paperId: string,
  config: ClassDefenseConfig,
  waveIndex: number
) {
  const questionCount = await tx.paperQuestion.count({
    where: { paperId },
  })
  if (questionCount === 0) {
    return null
  }

  const waveIndexes = Array.from(new Set(config.waves.map((wave) => wave.waveIndex)))
    .sort((a, b) => a - b)
  const waveCount = Math.max(1, waveIndexes.length)
  const matchedPosition = waveIndexes.indexOf(waveIndex)
  const wavePosition = matchedPosition >= 0 ? matchedPosition : 0
  const start = Math.floor((questionCount * wavePosition) / waveCount)
  const end = Math.ceil((questionCount * (wavePosition + 1)) / waveCount)
  const poolSize = Math.max(1, Math.max(start + 1, end) - start)
  const offset = start + Math.floor(Math.random() * poolSize)

  return tx.paperQuestion.findFirst({
    where: { paperId },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
    skip: Math.min(offset, questionCount - 1),
  })
}

async function pickBossQuestionForWave(
  sessionId: string,
  paperId: string,
  config: ClassDefenseConfig,
  waveIndex: number
) {
  const room = getBossRoomRuntime(sessionId)
  let questions = room.questionCacheByPaperId.get(paperId)
  if (!questions) {
    questions = await prisma.paperQuestion.findMany({
      where: { paperId },
      orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        content: true,
        type: true,
        score: true,
        answer: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
      },
    })
    room.questionCacheByPaperId.set(paperId, questions)
  }

  if (questions.length === 0) {
    return null
  }

  const waveIndexes = Array.from(new Set(config.waves.map((wave) => wave.waveIndex)))
    .sort((a, b) => a - b)
  const waveCount = Math.max(1, waveIndexes.length)
  const matchedPosition = waveIndexes.indexOf(waveIndex)
  const wavePosition = matchedPosition >= 0 ? matchedPosition : 0
  const start = Math.floor((questions.length * wavePosition) / waveCount)
  const end = Math.ceil((questions.length * (wavePosition + 1)) / waveCount)
  const poolSize = Math.max(1, Math.max(start + 1, end) - start)
  const offset = start + Math.floor(Math.random() * poolSize)

  return questions[Math.min(offset, questions.length - 1)]
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

  const waves = (raw.waves || [])
    .map((wave, waveIndex) => {
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
          return {
            monsterKey: monsterType.id,
            monsterName: monsterType.name,
            monsterLevel: level,
            imagePath: monsterType.imagePath,
            hp: stats.hp,
            attack: stats.attack,
            speed: stats.speed,
            spawnDelaySeconds: 0,
          }
        })
      })

      return {
        waveIndex: asNonNegativeInt(wave.waveIndex, waveIndex),
        startDelaySeconds: waveIndex === 0 ? asNonNegativeInt(wave.startDelaySeconds, 1) : 1,
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

function withLaneIndexes<T extends { waveIndex: number; directionId?: string | null; laneIndex?: number | null }>(
  monsters: T[]
) {
  const nextLaneByWave = new Map<string, number>()

  return monsters.map((monster) => {
    const laneKey = `${monster.directionId || ''}:${monster.waveIndex}`
    const laneIndex = monster.laneIndex ?? nextLaneByWave.get(laneKey) ?? 0
    nextLaneByWave.set(laneKey, laneIndex + 1)

    return {
      ...monster,
      laneIndex,
    }
  })
}

function isActiveClassDefenseBossStatus(status: string) {
  return status === CLASS_DEFENSE_MONSTER_STATUS.WALKING ||
    status === CLASS_DEFENSE_MONSTER_STATUS.COMBAT
}

function getBossStatus(status: string) {
  if (status === CLASS_DEFENSE_MONSTER_STATUS.KILLED) {
    return 'DEFEATED'
  }
  if (status === CLASS_DEFENSE_MONSTER_STATUS.REACHED) {
    return 'ESCAPED'
  }
  return 'ACTIVE'
}

function isBossCombatRecord(combat: ClassDefenseCombatWithSessionMonster) {
  return combat.damageToMonster === 0 &&
    combat.damageToStudent === 0 &&
    combat.monster.lockedByStudentId !== combat.studentId
}

async function getBossDamageTotalsWithTx(tx: Tx, sessionId: string, monsterId: string) {
  const [total, mine] = await Promise.all([
    tx.classDefenseCombat.groupBy({
      by: ['monsterId'],
      where: {
        sessionId,
        monsterId,
        status: CLASS_DEFENSE_COMBAT_STATUS.RESOLVED,
        damageToMonster: {
          gt: 0,
        },
      },
      _sum: {
        damageToMonster: true,
      },
    }),
    tx.classDefenseCombat.groupBy({
      by: ['monsterId', 'studentId'],
      where: {
        sessionId,
        monsterId,
        status: CLASS_DEFENSE_COMBAT_STATUS.RESOLVED,
        damageToMonster: {
          gt: 0,
        },
      },
      _sum: {
        damageToMonster: true,
      },
    }),
  ])

  return {
    totalDamage: total[0]?._sum.damageToMonster || 0,
    byStudentId: new Map(mine.map((item) => [
      item.studentId,
      item._sum.damageToMonster || 0,
    ] as const)),
  }
}

async function settleBossRewardsWithTx(
  tx: Tx,
  input: {
    sessionId: string
    monsterId: string
    bossName?: string | null
    basePointReward: number
    occurredAt: Date
    contributionByStudentId: Map<string, number>
  }
): Promise<ClassDefenseBossReward[]> {
  const totalDamage = Math.max(
    1,
    Array.from(input.contributionByStudentId.values()).reduce((sum, damage) => sum + damage, 0)
  )
  const rewards: ClassDefenseBossReward[] = []
  const rewardReason = input.bossName
    ? `守护班级击败 Boss：${input.bossName}`
    : '守护班级击败 Boss 奖励'

  for (const [studentId, damage] of Array.from(input.contributionByStudentId.entries())) {
    if (damage <= 0) {
      continue
    }

    const share = damage / totalDamage
    const pointReward = input.basePointReward > 0
      ? Math.max(1, Math.round(input.basePointReward * share))
      : 0
    const expReward = pointReward > 0 ? convertPointDeltaToPetExp(pointReward) : 0

    if (pointReward > 0) {
      await createStudentPointRecordWithTx(tx, {
        studentId,
        delta: pointReward,
        reason: rewardReason,
        occurredAt: input.occurredAt,
        source: POINT_SOURCE.CLASS_DEFENSE,
      })
    }

    rewards.push({
      studentId,
      damage,
      expReward,
      pointReward,
    })
  }

  return rewards
}

async function getBossContributionViews(
  sessionId: string,
  monsterIds: string[],
  studentId?: string | null
) {
  if (monsterIds.length === 0) {
    return {
      totalByMonsterId: new Map<string, number>(),
      myByMonsterId: new Map<string, number>(),
    }
  }

  const [totals, mine] = await Promise.all([
    prisma.classDefenseCombat.groupBy({
      by: ['monsterId'],
      where: {
        sessionId,
        monsterId: {
          in: monsterIds,
        },
        status: CLASS_DEFENSE_COMBAT_STATUS.RESOLVED,
        damageToMonster: {
          gt: 0,
        },
      },
      _sum: {
        damageToMonster: true,
      },
    }),
    studentId
      ? prisma.classDefenseCombat.groupBy({
          by: ['monsterId'],
          where: {
            sessionId,
            studentId,
            monsterId: {
              in: monsterIds,
            },
            status: CLASS_DEFENSE_COMBAT_STATUS.RESOLVED,
            damageToMonster: {
              gt: 0,
            },
          },
          _sum: {
            damageToMonster: true,
          },
        })
      : Promise.resolve([]),
  ])

  return {
    totalByMonsterId: new Map(totals.map((item) => [
      item.monsterId,
      item._sum.damageToMonster || 0,
    ] as const)),
    myByMonsterId: new Map(mine.map((item) => [
      item.monsterId,
      item._sum.damageToMonster || 0,
    ] as const)),
  }
}

async function buildBossViews<T extends {
  id: string
  directionId: string
  waveIndex: number
  laneIndex?: number | null
  monsterKey: string
  monsterName?: string | null
  monsterLevel: number
  imagePath?: string | null
  status: string
  hp: number
  maxHp: number
  attack: number
  routeProgress?: number | null
  spawnedAt: Date
}>(
  sessionId: string,
  monsters: T[],
  studentId?: string | null
) {
  const activeBosses = monsters.filter((monster) =>
    isClassDefenseDirectionId(monster.directionId) &&
    isActiveClassDefenseBossStatus(monster.status)
  )

  return activeBosses.map((monster) => {
    const boss = syncRuntimeBossFromDb(sessionId, {
      id: monster.id,
      directionId: monster.directionId,
      monsterKey: monster.monsterKey,
      monsterName: monster.monsterName || null,
      monsterLevel: monster.monsterLevel,
      imagePath: monster.imagePath || null,
      waveIndex: monster.waveIndex,
      laneIndex: monster.laneIndex ?? 0,
      hp: monster.hp,
      maxHp: monster.maxHp,
      attack: monster.attack,
      status: monster.status,
      routeProgress: monster.routeProgress ?? 0,
      spawnedAt: monster.spawnedAt,
    })
    const totalDamage = boss ? getBossTotalDamage(boss) : 0
    const myDamage = studentId && boss
      ? boss.contributionByStudentId.get(studentId) || 0
      : 0

    return {
      id: monster.id,
      bossId: monster.id,
      monsterId: monster.id,
      directionId: monster.directionId,
      bossKey: boss?.monsterKey || monster.monsterKey,
      monsterKey: boss?.monsterKey || monster.monsterKey,
      bossName: boss?.monsterName || monster.monsterName || 'Boss',
      monsterName: boss?.monsterName || monster.monsterName || 'Boss',
      imagePath: boss?.imagePath || monster.imagePath || undefined,
      phase: 1,
      status: boss?.status === 'DEFEATED'
        ? 'DEFEATED'
        : boss?.status === 'ESCAPED'
          ? 'ESCAPED'
          : getBossStatus(monster.status),
      hp: boss?.hp ?? monster.hp,
      maxHp: boss?.maxHp ?? monster.maxHp,
      bossHp: boss?.hp ?? monster.hp,
      bossMaxHp: boss?.maxHp ?? monster.maxHp,
      myDamage,
      totalDamage,
      waveIndex: monster.waveIndex,
      laneIndex: boss?.laneIndex ?? monster.laneIndex ?? 0,
      routeProgress: boss?.routeProgress ?? monster.routeProgress ?? 0,
    }
  })
}

function applyBossRuntimeToMonsterViews<T extends {
  id: string
  directionId?: string | null
  monsterKey: string
  monsterName?: string | null
  monsterLevel: number
  imagePath?: string | null
  waveIndex: number
  laneIndex?: number | null
  hp: number
  maxHp: number
  attack: number
  status: string
  routeProgress: number
  spawnedAt: Date
}>(sessionId: string, monsters: T[]) {
  return monsters.map((monster) => {
    const boss = syncRuntimeBossFromDb(sessionId, {
      id: monster.id,
      directionId: monster.directionId || '',
      monsterKey: monster.monsterKey,
      monsterName: monster.monsterName || null,
      monsterLevel: monster.monsterLevel,
      imagePath: monster.imagePath || null,
      waveIndex: monster.waveIndex,
      laneIndex: monster.laneIndex ?? 0,
      hp: monster.hp,
      maxHp: monster.maxHp,
      attack: monster.attack,
      status: monster.status,
      routeProgress: monster.routeProgress,
      spawnedAt: monster.spawnedAt,
    })
    if (!boss) {
      return monster
    }

    return {
      ...monster,
      hp: boss.hp,
      maxHp: boss.maxHp,
      status: getDbMonsterStatusForRuntimeBoss(boss.status),
      routeProgress: boss.routeProgress,
      lockedByStudentId: null,
      lockExpiresAt: null,
    }
  })
}

function buildWaveBossMonster(wave: ClassDefenseConfig['waves'][number]) {
  const [firstMonster] = wave.monsters
  if (!firstMonster) {
    return null
  }

  return {
    ...firstMonster,
    hp: wave.monsters.reduce((sum, monster) => sum + monster.hp, 0),
    attack: Math.max(...wave.monsters.map((monster) => monster.attack)),
    speed: Math.min(...wave.monsters.map((monster) => monster.speed)),
    spawnDelaySeconds: Math.min(...wave.monsters.map((monster) => monster.spawnDelaySeconds)),
  }
}

async function createScheduledMonsters(
  tx: Tx,
  sessionId: string,
  config: ClassDefenseConfig,
  startedAt: Date
) {
  const monsters = config.enabledDirections.flatMap((directionId) =>
    config.waves.flatMap((wave) =>
      [buildWaveBossMonster(wave)].flatMap((monster) => monster ? [{
        sessionId,
        directionId,
        waveIndex: wave.waveIndex,
        laneIndex: 0,
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
      }] : [])
    )
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
        orderBy: [{ waveIndex: 'asc' }, { spawnedAt: 'asc' }, { id: 'asc' }],
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
  const updated = await prisma.$transaction(async (tx) => {
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
  bossRoomRuntimeBySessionId.delete(sessionId)
  return updated
}

export async function settleClassDefenseSessionEnd(sessionId: string) {
  const now = new Date()
  const sessionEnd = await prisma.$transaction((tx) =>
    finalizeClassDefenseSessionIfEndedWithTx(tx, sessionId, now)
  )

  if (!sessionEnd) {
    return null
  }

  const summary = await getClassDefenseDirectionSummary(sessionId)
  if (summary.session.status !== CLASS_DEFENSE_SESSION_STATUS.ACTIVE) {
    bossRoomRuntimeBySessionId.delete(sessionId)
  }

  return {
    summary,
    sessionEnd,
  }
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
  studentId?: string | null,
  directionId?: ClassDefenseDirectionId | null
) {
  const session = await prisma.classDefenseSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    throw new Error('守护班级会话不存在')
  }

  const config = parseClassDefenseConfig(session.configJson)
  if (directionId !== undefined && directionId !== null) {
    assertDirectionEnabled(directionId, config.enabledDirections)
  }

  const participantWhere = directionId === undefined
    ? { sessionId }
    : directionId
      ? { sessionId, directionId }
      : null
  const monsterWhere = directionId === undefined
    ? { sessionId }
    : directionId
      ? {
          sessionId,
          directionId,
          status: {
            in: [
              CLASS_DEFENSE_MONSTER_STATUS.WALKING,
              CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
            ],
          },
        }
      : null

  const [participants, monsters, activeCombat, directions, endState] = await Promise.all([
    participantWhere
      ? prisma.classDefenseParticipant.findMany({
          where: participantWhere,
          orderBy: { joinedAt: 'asc' },
        })
      : [],
    monsterWhere
      ? prisma.classDefenseMonster.findMany({
          where: monsterWhere,
          orderBy: [
            { directionId: 'asc' },
            { waveIndex: 'asc' },
            { laneIndex: 'asc' },
            { spawnedAt: 'asc' },
            { id: 'asc' },
          ],
        })
      : [],
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
    getClassDefenseDirectionSummaries(sessionId, config.enabledDirections),
    getLatestClassDefenseSessionEndState(sessionId),
  ])

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
  const runtimeRoom = bossRoomRuntimeBySessionId.get(sessionId)
  const participantViews = participants.map((participant) => {
    const currentStudent = studentMap.get(participant.studentId)
    const runtimeParticipant = runtimeRoom?.participantByStudentId.get(participant.studentId) || null

    return {
      ...participant,
      hp: runtimeParticipant?.hp ?? participant.hp,
      maxHp: runtimeParticipant?.maxHp ?? participant.maxHp,
      status: runtimeParticipant?.status ?? participant.status,
      reviveAt: runtimeParticipant?.reviveAt ?? participant.reviveAt,
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
  const monsterViews = applyBossRuntimeToMonsterViews(sessionId, withLaneIndexes(monsters))
  const bosses = await buildBossViews(sessionId, monsterViews, studentId)
  const directionBosses = Object.fromEntries(
    bosses.map((boss) => [boss.directionId, boss])
  )
  const primaryBoss = directionId
    ? bosses.find((boss) => boss.directionId === directionId) || null
    : bosses[0] || null

  return {
    serverTime: new Date().toISOString(),
    session: buildClassDefenseSessionView(session, endState, config.enabledDirections),
    directions,
    participants: participantViews,
    monsters: monsterViews,
    bosses,
    boss: primaryBoss,
    directionBosses,
    activeCombat,
  }
}

async function getClassDefenseDirectionSummaries(
  sessionId: string,
  enabledDirections: ClassDefenseDirectionId[]
) {
  const [monsters, participants, activeBosses] = await Promise.all([
    prisma.classDefenseMonster.groupBy({
      by: ['directionId'],
      where: {
        sessionId,
        status: {
          in: [
            CLASS_DEFENSE_MONSTER_STATUS.WALKING,
            CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
          ],
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.classDefenseParticipant.groupBy({
      by: ['directionId'],
      where: {
        sessionId,
        directionId: {
          not: null,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.classDefenseMonster.findMany({
      where: {
        sessionId,
        status: {
          in: [
            CLASS_DEFENSE_MONSTER_STATUS.WALKING,
            CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
          ],
        },
      },
      orderBy: [
        { directionId: 'asc' },
        { waveIndex: 'asc' },
        { spawnedAt: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        directionId: true,
        waveIndex: true,
        laneIndex: true,
        monsterKey: true,
        monsterName: true,
        monsterLevel: true,
        imagePath: true,
        status: true,
        hp: true,
        maxHp: true,
        attack: true,
        routeProgress: true,
        spawnedAt: true,
      },
    }),
  ])

  const monsterCountByDirection = new Map(monsters.map((item) => [item.directionId, item._count._all]))
  const defenderCountByDirection = new Map(
    participants.map((item) => [item.directionId || '', item._count._all])
  )
  const bossByDirection = new Map<ClassDefenseDirectionId, typeof activeBosses[number]>()
  for (const boss of activeBosses) {
    if (isClassDefenseDirectionId(boss.directionId) && !bossByDirection.has(boss.directionId)) {
      syncRuntimeBossFromDb(sessionId, boss)
      bossByDirection.set(boss.directionId, boss)
    }
  }

  return CLASS_DEFENSE_DIRECTIONS.map((direction) => {
    const enabled = enabledDirections.includes(direction.id)
    const boss = enabled ? bossByDirection.get(direction.id) || null : null
    const runtimeBoss = boss ? getBossRoomRuntime(sessionId).bosses.get(boss.id) || null : null

    return {
      directionId: direction.id,
      label: direction.label,
      enabled,
      monsterCount: enabled ? monsterCountByDirection.get(direction.id) || 0 : 0,
      bossCount: boss ? 1 : 0,
      bossHp: runtimeBoss?.hp ?? boss?.hp ?? 0,
      bossMaxHp: runtimeBoss?.maxHp ?? boss?.maxHp ?? 0,
      boss: boss
        ? {
            id: boss.id,
            bossId: boss.id,
            directionId: boss.directionId,
            bossKey: runtimeBoss?.monsterKey || boss.monsterKey,
            bossName: runtimeBoss?.monsterName || boss.monsterName || 'Boss',
            imagePath: runtimeBoss?.imagePath || boss.imagePath || undefined,
            phase: 1,
            status: runtimeBoss?.status === 'DEFEATED'
              ? 'DEFEATED'
              : runtimeBoss?.status === 'ESCAPED'
                ? 'ESCAPED'
                : getBossStatus(boss.status),
            hp: runtimeBoss?.hp ?? boss.hp,
            maxHp: runtimeBoss?.maxHp ?? boss.maxHp,
          }
        : null,
      defenderCount: enabled ? defenderCountByDirection.get(direction.id) || 0 : 0,
    }
  })
}

export async function getClassDefenseDirectionSummary(sessionId: string) {
  const [session, endState] = await Promise.all([
    prisma.classDefenseSession.findUnique({
      where: { id: sessionId },
    }),
    getLatestClassDefenseSessionEndState(sessionId),
  ])

  if (!session) {
    throw new Error('守护班级会话不存在')
  }

  const config = parseClassDefenseConfig(session.configJson)

  return {
    session: buildClassDefenseSessionView({
      id: session.id,
      status: session.status,
      classHp: session.classHp,
      maxClassHp: session.maxClassHp,
      stateVersion: session.stateVersion,
    }, endState, config.enabledDirections),
    directions: await getClassDefenseDirectionSummaries(sessionId, config.enabledDirections),
  }
}

export async function getClassDefenseDirectionDefenders(
  sessionId: string,
  directionId: ClassDefenseDirectionId
) {
  const snapshot = await getClassDefenseSnapshot(sessionId, null, directionId)

  return {
    directionId,
    defenderCount: snapshot.directions.find((direction) => direction.directionId === directionId)?.defenderCount || 0,
    defenders: snapshot.participants.slice(0, 10).map((participant) => ({
      studentId: participant.studentId,
      directionId,
      student: participant.student ? { name: participant.student.name } : null,
      pet: participant.pet
        ? {
            speciesKey: participant.pet.speciesKey,
            nickname: participant.pet.nickname,
          }
        : null,
    })),
  }
}

export async function selectClassDefenseDirection(input: {
  sessionId: string
  studentId: string
  directionId: string | null
}) {
  const session = await prisma.classDefenseSession.findFirst({
    where: {
      id: input.sessionId,
      status: CLASS_DEFENSE_SESSION_STATUS.ACTIVE,
    },
  })

  if (!session) {
    throw new Error('守护班级未开始或已结束')
  }

  const config = parseClassDefenseConfig(session.configJson)
  const directionId = input.directionId === null
    ? null
    : requireClassDefenseDirectionId(input.directionId)

  if (directionId) {
    assertDirectionEnabled(directionId, config.enabledDirections)
  }

  const updated = await prisma.classDefenseParticipant.updateMany({
    where: {
      sessionId: input.sessionId,
      studentId: input.studentId,
    },
    data: {
      directionId,
      lastSeenAt: new Date(),
    },
  })

  if (updated.count !== 1) {
    throw new Error('请先进入守护班级')
  }

  return getClassDefenseSnapshot(input.sessionId, input.studentId, directionId)
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
  const paperId = session.paperId

  const combatStarted = await prisma.$transaction(async (tx) => {
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

    if (!participant.directionId) {
      throw new Error('请先选择防守方向')
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

    const targetMonster = await tx.classDefenseMonster.findFirst({
      where: {
        id: input.monsterId,
        sessionId: input.sessionId,
        directionId: participant.directionId,
        status: CLASS_DEFENSE_MONSTER_STATUS.WALKING,
        lockedByStudentId: null,
      },
      select: {
        waveIndex: true,
      },
    })

    if (!targetMonster) {
      throw new Error('怪物已被其他同学锁定或不可攻击')
    }

    const question = await pickQuestionForWaveFromDb(tx, paperId, config, targetMonster.waveIndex)
    if (!question) {
      throw new Error('题库为空，无法进入战斗')
    }

    const locked = await tx.classDefenseMonster.updateMany({
      where: {
        id: input.monsterId,
        sessionId: input.sessionId,
        directionId: participant.directionId,
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

    await appendEvents(tx, [
      {
        sessionId: input.sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_LOCKED,
        payload: {
          monsterId: input.monsterId,
          studentId: input.studentId,
          combatId: created.id,
          lockExpiresAt: addSeconds(now, config.combatSeconds).toISOString(),
        },
      },
      {
        sessionId: input.sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.COMBAT_STARTED,
        payload: {
          combatId: created.id,
          monsterId: input.monsterId,
          studentId: input.studentId,
          questionId: question.id,
        },
      },
    ])

    return {
      combat: created,
      question,
    }
  })

  return {
    combat: combatStarted.combat,
    question: publicQuestion(combatStarted.question),
  }
}

export async function startClassDefenseBossCombat(input: {
  sessionId: string
  studentId: string
  bossId: string
  directionId?: string | null
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
  const paperId = session.paperId
  const [participant, targetBoss, activeDbCombatCount] = await Promise.all([
    prisma.classDefenseParticipant.findUnique({
      where: {
        sessionId_studentId: {
          sessionId: input.sessionId,
          studentId: input.studentId,
        },
      },
    }),
    prisma.classDefenseMonster.findFirst({
      where: {
        id: input.bossId,
        sessionId: input.sessionId,
        status: {
          in: [
            CLASS_DEFENSE_MONSTER_STATUS.WALKING,
            CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
          ],
        },
      },
    }),
    prisma.classDefenseCombat.count({
      where: {
        sessionId: input.sessionId,
        studentId: input.studentId,
        status: CLASS_DEFENSE_COMBAT_STATUS.ACTIVE,
      },
    }),
  ])

  if (!participant) {
    throw new Error('请先进入守护班级')
  }

  if (!participant.directionId) {
    throw new Error('请先选择防守方向')
  }

  const requestedDirectionId = input.directionId
    ? requireClassDefenseDirectionId(input.directionId)
    : participant.directionId
  if (requestedDirectionId !== participant.directionId) {
    throw new Error('只能攻击当前防守方向的 Boss')
  }

  if (!targetBoss || targetBoss.directionId !== participant.directionId) {
    throw new Error('Boss 不存在或不可攻击')
  }

  const room = getBossRoomRuntime(input.sessionId)
  const battleStats = await prisma.$transaction((tx) => getStudentBattleStats(tx, input.studentId, config))
  const runtimeParticipant = getRuntimeParticipant(room, input.studentId, participant, battleStats, now)
  if (
    runtimeParticipant.status !== 'ALIVE' ||
    (runtimeParticipant.reviveAt && runtimeParticipant.reviveAt > now)
  ) {
    throw new Error('你正在等待复活')
  }

  const activeRuntimeCombatCount = Array.from(room.activeCombats.values())
    .filter((combat) =>
      combat.studentId === input.studentId &&
      combat.expiresAt > now
    ).length
  if (activeDbCombatCount > 0 || activeRuntimeCombatCount > 0) {
    throw new Error('你已经在战斗中')
  }

  const boss = syncRuntimeBossFromDb(input.sessionId, targetBoss)
  if (!boss || boss.status !== 'ACTIVE' || boss.hp <= 0 || boss.settlementStarted) {
    throw new Error('Boss 不存在或不可攻击')
  }

  const question = await pickBossQuestionForWave(input.sessionId, paperId, config, targetBoss.waveIndex)
  if (!question) {
    throw new Error('题库为空，无法进入战斗')
  }

  const combat: ClassDefenseBossCombatRuntimeState = {
    id: `boss-combat-${randomUUID()}`,
    sessionId: input.sessionId,
    bossId: boss.id,
    studentId: input.studentId,
    directionId: boss.directionId,
    question,
    waveIndex: boss.waveIndex,
    startedAt: now,
    expiresAt: addSeconds(now, config.combatSeconds),
  }
  room.activeCombats.set(combat.id, combat)

  return {
    combat: {
      id: combat.id,
      sessionId: combat.sessionId,
      bossId: combat.bossId,
      monsterId: combat.bossId,
      studentId: combat.studentId,
      isBoss: true,
      expiresAt: combat.expiresAt,
    },
    question: publicQuestion(question),
  }
}

async function resolveClassDefenseBossRuntimeAnswer(input: {
  combatId: string
  studentId: string
  answer: string
  now: Date
  forceIncorrect?: boolean
}): Promise<ClassDefenseCombatResult | null> {
  let matchedRoom: ClassDefenseBossRoomRuntimeState | null = null
  let combat: ClassDefenseBossCombatRuntimeState | null = null

  for (const room of Array.from(bossRoomRuntimeBySessionId.values())) {
    const current = room.activeCombats.get(input.combatId)
    if (current) {
      matchedRoom = room
      combat = current
      break
    }
  }

  if (!matchedRoom || !combat) {
    return null
  }

  if (combat.studentId !== input.studentId) {
    throw new Error('战斗不存在或已结束')
  }

  matchedRoom.activeCombats.delete(combat.id)
  const now = input.now
  const [session, participant] = await Promise.all([
    prisma.classDefenseSession.findFirst({
      where: {
        id: combat.sessionId,
        status: CLASS_DEFENSE_SESSION_STATUS.ACTIVE,
      },
    }),
    prisma.classDefenseParticipant.findUnique({
      where: {
        sessionId_studentId: {
          sessionId: combat.sessionId,
          studentId: combat.studentId,
        },
      },
    }),
  ])

  if (!session) {
    throw new Error('守护班级未开始或已结束')
  }
  if (!participant) {
    throw new Error('参战学生不存在')
  }

  const config = parseClassDefenseConfig(session.configJson)
  const boss = matchedRoom.bosses.get(combat.bossId)
  if (!boss) {
    throw new Error('Boss 不存在或不可攻击')
  }

  const battleStats = await prisma.$transaction((tx) => getStudentBattleStats(tx, combat.studentId, config))
  const runtimeParticipant = getRuntimeParticipant(
    matchedRoom,
    combat.studentId,
    participant,
    battleStats,
    now
  )
  const isCorrect = input.forceIncorrect || combat.expiresAt <= now
    ? false
    : evaluateQuestionAnswer(combat.question, input.answer)
  const isCritical = isCorrect && rollPercent(battleStats.critRate)
  const isDodged = !isCorrect && rollPercent(battleStats.dodgeRate)
  const attemptedDamageToBoss = isCorrect && boss.status === 'ACTIVE' && boss.hp > 0
    ? Math.max(1, Math.round(battleStats.attack * (isCritical ? 2 : 1)))
    : 0
  const damageToBoss = Math.min(boss.hp, attemptedDamageToBoss)

  if (damageToBoss > 0) {
    boss.hp = Math.max(0, boss.hp - damageToBoss)
    boss.contributionByStudentId.set(
      combat.studentId,
      (boss.contributionByStudentId.get(combat.studentId) || 0) + damageToBoss
    )
  }

  const damageToStudent = isCorrect || isDodged
    ? 0
    : calculateDamageAfterDefense(boss.attack, battleStats.defense)
  if (damageToStudent > 0 && runtimeParticipant.status === 'ALIVE') {
    runtimeParticipant.hp = Math.max(0, runtimeParticipant.hp - damageToStudent)
    if (runtimeParticipant.hp <= 0) {
      runtimeParticipant.status = 'DOWN'
      runtimeParticipant.reviveAt = addSeconds(now, config.reviveSeconds)
    }
  }

  let bossDefeatedNow = false
  let rewards: ClassDefenseBossReward[] = []
  if (boss.hp <= 0 && boss.status !== 'DEFEATED') {
    boss.hp = 0
    boss.status = 'DEFEATED'
  }
  if (boss.status === 'DEFEATED' && !boss.settlementStarted) {
    boss.settlementStarted = true
    const contributionSnapshot = new Map(boss.contributionByStudentId)
    rewards = await prisma.$transaction(async (tx) => {
      const killed = await tx.classDefenseMonster.updateMany({
        where: {
          id: boss.id,
          sessionId: combat.sessionId,
          status: {
            in: [
              CLASS_DEFENSE_MONSTER_STATUS.WALKING,
              CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
            ],
          },
        },
        data: {
          hp: 0,
          status: CLASS_DEFENSE_MONSTER_STATUS.KILLED,
          lockedByStudentId: null,
          lockExpiresAt: null,
          killedAt: now,
        },
      })

      if (killed.count !== 1) {
        return []
      }

      bossDefeatedNow = true
      const settledRewards = await settleBossRewardsWithTx(tx, {
        sessionId: combat.sessionId,
        monsterId: boss.id,
        bossName: boss.monsterName,
        basePointReward: config.killPointReward,
        occurredAt: now,
        contributionByStudentId: contributionSnapshot,
      })
      await appendEvent(tx, {
        sessionId: combat.sessionId,
        type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_KILLED,
        payload: {
          bossId: boss.id,
          monsterId: boss.id,
          isBoss: true,
          rewards: settledRewards,
          contributions: Array.from(contributionSnapshot.entries()).map(([studentId, damage]) => ({
            studentId,
            damage,
          })),
        },
      })

      return settledRewards
    })
  }

  const totalDamage = getBossTotalDamage(boss)
  const myDamage = boss.contributionByStudentId.get(combat.studentId) || 0
  const reviveAt = runtimeParticipant.reviveAt

  return {
    combatId: combat.id,
    sessionId: combat.sessionId,
    bossId: boss.id,
    monsterId: boss.id,
    directionId: boss.directionId,
    studentId: combat.studentId,
    roundIndex: 1,
    isBoss: true,
    isCorrect,
    damageToBoss,
    damageToMonster: damageToBoss,
    damageToStudent,
    isCritical,
    isDodged,
    battleStats,
    bossHp: boss.hp,
    bossMaxHp: boss.maxHp,
    myDamage,
    totalDamage,
    bossDefeated: boss.status === 'DEFEATED',
    bossDefeatedNow,
    monsterHp: boss.hp,
    monsterKilled: boss.status === 'DEFEATED',
    studentHp: runtimeParticipant.hp,
    studentDown: runtimeParticipant.status === 'DOWN',
    battleEnded: true,
    nextQuestion: null,
    reviveAt,
    rewards,
  }
}

async function resolveExpiredClassDefenseBossCombats(sessionId: string, now: Date) {
  const room = bossRoomRuntimeBySessionId.get(sessionId)
  if (!room) {
    return []
  }

  const expiredCombats = Array.from(room.activeCombats.values())
    .filter((combat) => combat.sessionId === sessionId && combat.expiresAt <= now)
  const results: ClassDefenseCombatResult[] = []

  for (const combat of expiredCombats) {
    const result = await resolveClassDefenseBossRuntimeAnswer({
      combatId: combat.id,
      studentId: combat.studentId,
      answer: '__TIMEOUT__',
      now,
      forceIncorrect: true,
    })
    if (result) {
      results.push(result)
    }
  }

  return results
}

async function resolveClassDefenseBossCombatAnswer(
  tx: Tx,
  input: {
    combat: ClassDefenseCombatWithSessionMonster
    answer: string
    now: Date
    forceIncorrect?: boolean
  }
): Promise<ClassDefenseCombatResult> {
  const combat = input.combat
  const now = input.now
  const question = await tx.paperQuestion.findUnique({
    where: { id: combat.paperQuestionId },
  })

  if (!question) {
    throw new Error('题目不存在')
  }

  const config = parseClassDefenseConfig(combat.session.configJson)
  const isCorrect = input.forceIncorrect
    ? false
    : evaluateQuestionAnswer(question, input.answer)

  const participant = await tx.classDefenseParticipant.findUnique({
    where: {
      sessionId_studentId: {
        sessionId: combat.sessionId,
        studentId: combat.studentId,
      },
    },
  })

  if (!participant) {
    throw new Error('参战学生不存在')
  }

  const battleStats = await getStudentBattleStats(tx, combat.studentId, config)
  const isCritical = isCorrect && rollPercent(battleStats.critRate)
  const isDodged = !isCorrect && rollPercent(battleStats.dodgeRate)
  const attemptedDamageToBoss = isCorrect
    ? Math.max(1, Math.round(battleStats.attack * (isCritical ? 2 : 1)))
    : 0
  const damageToStudent = isCorrect || isDodged
    ? 0
    : calculateDamageAfterDefense(combat.monster.attack, battleStats.defense)
  const nextStudentHp = Math.max(0, participant.hp - damageToStudent)
  const studentDown = nextStudentHp <= 0
  const reviveAt = studentDown ? addSeconds(now, config.reviveSeconds) : null
  const roundIndex = await tx.classDefenseAnswer.count({
    where: {
      combatId: combat.id,
    },
  }) + 1

  await tx.classDefenseAnswer.create({
    data: {
      combatId: combat.id,
      sessionId: combat.sessionId,
      studentId: combat.studentId,
      monsterId: combat.monsterId,
      roundIndex,
      paperQuestionId: combat.paperQuestionId,
      answer: input.answer,
      isCorrect,
      submittedAt: now,
    },
  })

  let damageToBoss = 0
  let bossHp = Math.max(0, combat.monster.hp)
  let bossDefeated = combat.monster.status === CLASS_DEFENSE_MONSTER_STATUS.KILLED || bossHp <= 0
  let bossDefeatedNow = false
  let rewards: ClassDefenseBossReward[] = []

  if (attemptedDamageToBoss > 0 && !bossDefeated) {
    const damaged = await tx.classDefenseMonster.updateMany({
      where: {
        id: combat.monsterId,
        sessionId: combat.sessionId,
        status: {
          in: [
            CLASS_DEFENSE_MONSTER_STATUS.WALKING,
            CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
          ],
        },
        hp: {
          gt: 0,
        },
      },
      data: {
        hp: {
          decrement: attemptedDamageToBoss,
        },
        lockedByStudentId: null,
        lockExpiresAt: null,
      },
    })
    damageToBoss = damaged.count > 0 ? attemptedDamageToBoss : 0
  }

  const currentBoss = await tx.classDefenseMonster.findUnique({
    where: { id: combat.monsterId },
    select: {
      hp: true,
      maxHp: true,
      status: true,
      monsterName: true,
    },
  })

  bossHp = Math.max(0, currentBoss?.hp ?? bossHp)
  bossDefeated = bossDefeated ||
    currentBoss?.status === CLASS_DEFENSE_MONSTER_STATUS.KILLED ||
    bossHp <= 0

  await tx.classDefenseCombat.update({
    where: { id: combat.id },
    data: {
      status: CLASS_DEFENSE_COMBAT_STATUS.RESOLVED,
      endedAt: now,
      isCorrect,
      damageToMonster: damageToBoss,
      damageToStudent,
    },
  })

  if (bossHp <= 0 && currentBoss?.status !== CLASS_DEFENSE_MONSTER_STATUS.KILLED) {
    const killed = await tx.classDefenseMonster.updateMany({
      where: {
        id: combat.monsterId,
        sessionId: combat.sessionId,
        status: {
          in: [
            CLASS_DEFENSE_MONSTER_STATUS.WALKING,
            CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
          ],
        },
      },
      data: {
        hp: 0,
        status: CLASS_DEFENSE_MONSTER_STATUS.KILLED,
        lockedByStudentId: null,
        lockExpiresAt: null,
        killedAt: now,
      },
    })
    bossHp = 0
    bossDefeated = true

    if (killed.count === 1) {
      bossDefeatedNow = true
      const dbContributions = await getBossDamageTotalsWithTx(tx, combat.sessionId, combat.monsterId)
      rewards = await settleBossRewardsWithTx(tx, {
        sessionId: combat.sessionId,
        monsterId: combat.monsterId,
        bossName: currentBoss?.monsterName,
        basePointReward: config.killPointReward,
        occurredAt: now,
        contributionByStudentId: dbContributions.byStudentId,
      })
    }
  }

  await tx.classDefenseParticipant.update({
    where: {
      sessionId_studentId: {
        sessionId: combat.sessionId,
        studentId: combat.studentId,
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

  const contributionViews = await getBossDamageTotalsWithTx(tx, combat.sessionId, combat.monsterId)
  const myDamage = contributionViews.byStudentId.get(combat.studentId) || 0
  const totalDamage = contributionViews.totalDamage
  const directionId = isClassDefenseDirectionId(combat.monster.directionId)
    ? combat.monster.directionId
    : null
  const resultPayload = {
    combatId: combat.id,
    roundIndex,
    bossId: combat.monsterId,
    monsterId: combat.monsterId,
    directionId,
    studentId: combat.studentId,
    isBoss: true,
    isCorrect,
    damageToBoss,
    damageToMonster: damageToBoss,
    damageToStudent,
    isCritical,
    isDodged,
    battleStats,
    bossHp,
    bossMaxHp: currentBoss?.maxHp ?? combat.monster.maxHp,
    monsterHp: bossHp,
    myDamage,
    totalDamage,
    bossDefeated,
    bossDefeatedNow,
    monsterKilled: bossDefeated,
    studentHp: nextStudentHp,
    studentDown,
    battleEnded: true,
    nextQuestion: null,
    reviveAt: reviveAt?.toISOString() || null,
    rewards,
  }
  const events: ClassDefenseEventInput[] = [
    {
      sessionId: combat.sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.COMBAT_RESULT,
      payload: resultPayload,
    },
  ]

  if (bossDefeatedNow) {
    events.push({
      sessionId: combat.sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_KILLED,
      payload: {
        bossId: combat.monsterId,
        monsterId: combat.monsterId,
        studentId: combat.studentId,
        isBoss: true,
        rewards,
      },
    })
  }

  if (studentDown) {
    events.push({
      sessionId: combat.sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.STUDENT_DOWN,
      payload: {
        studentId: combat.studentId,
        reviveAt: reviveAt?.toISOString() || null,
      },
    })
  }

  await appendEvents(tx, events)

  return {
    combatId: combat.id,
    sessionId: combat.sessionId,
    bossId: combat.monsterId,
    monsterId: combat.monsterId,
    directionId,
    studentId: combat.studentId,
    roundIndex,
    isBoss: true,
    isCorrect,
    damageToBoss,
    damageToMonster: damageToBoss,
    damageToStudent,
    isCritical,
    isDodged,
    battleStats,
    bossHp,
    bossMaxHp: currentBoss?.maxHp ?? combat.monster.maxHp,
    myDamage,
    totalDamage,
    bossDefeated,
    bossDefeatedNow,
    monsterHp: bossHp,
    monsterKilled: bossDefeated,
    studentHp: nextStudentHp,
    studentDown,
    battleEnded: true,
    nextQuestion: null,
    reviveAt,
    rewards,
  }
}

async function resolveClassDefenseCombatAnswer(
  tx: Tx,
  input: {
    combat: ClassDefenseCombatWithSessionMonster
    answer: string
    now: Date
    forceIncorrect?: boolean
  }
): Promise<ClassDefenseCombatResult> {
  const combat = input.combat
  if (isBossCombatRecord(combat)) {
    return resolveClassDefenseBossCombatAnswer(tx, input)
  }

  const now = input.now
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
  const paperId = combat.session.paperId

  const isCorrect = input.forceIncorrect
    ? false
    : evaluateQuestionAnswer(question, input.answer)

  const participant = await tx.classDefenseParticipant.findUnique({
    where: {
      sessionId_studentId: {
        sessionId: combat.sessionId,
        studentId: combat.studentId,
      },
    },
  })

  if (!participant) {
    throw new Error('参战学生不存在')
  }

  const battleStats = await getStudentBattleStats(tx, combat.studentId, config)
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
  const nextQuestion = battleEnded
    ? null
    : await pickQuestionForWaveFromDb(tx, paperId, config, combat.monster.waveIndex)

  if (!battleEnded && !nextQuestion) {
    throw new Error('题库为空，无法继续战斗')
  }

  await tx.classDefenseAnswer.create({
    data: {
      combatId: combat.id,
      sessionId: combat.sessionId,
      studentId: combat.studentId,
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
      lockedByStudentId: battleEnded ? null : combat.studentId,
      lockExpiresAt: battleEnded ? null : addSeconds(now, config.combatSeconds),
      killedAt: monsterKilled ? now : null,
    },
  })

  await tx.classDefenseParticipant.update({
    where: {
      sessionId_studentId: {
        sessionId: combat.sessionId,
        studentId: combat.studentId,
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
      studentId: combat.studentId,
      delta: config.killPointReward,
      reason: `守护班级击杀怪物奖励`,
      occurredAt: now,
      source: POINT_SOURCE.CLASS_DEFENSE,
    })
  }

  const events: ClassDefenseEventInput[] = [
    {
      sessionId: combat.sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.COMBAT_RESULT,
      payload: {
        combatId: combat.id,
        roundIndex,
        monsterId: combat.monsterId,
        studentId: combat.studentId,
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
    },
  ]

  if (monsterKilled) {
    events.push({
      sessionId: combat.sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_KILLED,
      payload: {
        monsterId: combat.monsterId,
        studentId: combat.studentId,
      },
    })
  } else if (studentDown) {
    events.push({
      sessionId: combat.sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_RELEASED,
      payload: {
        monsterId: combat.monsterId,
        reason: 'STUDENT_DOWN',
      },
    })
  }

  if (studentDown) {
    events.push({
      sessionId: combat.sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.STUDENT_DOWN,
      payload: {
        studentId: combat.studentId,
        reviveAt: reviveAt?.toISOString() || null,
      },
    })
  }

  await appendEvents(tx, events)

  return {
    combatId: combat.id,
    sessionId: combat.sessionId,
    monsterId: combat.monsterId,
    directionId: isClassDefenseDirectionId(combat.monster.directionId)
      ? combat.monster.directionId
      : null,
    studentId: combat.studentId,
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
}

export async function submitClassDefenseAnswer(input: {
  combatId: string
  studentId: string
  answer: string
}) {
  const now = new Date()
  const bossResult = await resolveClassDefenseBossRuntimeAnswer({
    combatId: input.combatId,
    studentId: input.studentId,
    answer: input.answer,
    now,
    forceIncorrect: input.answer === '__TIMEOUT__',
  })
  if (bossResult) {
    return bossResult
  }

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

    return resolveClassDefenseCombatAnswer(tx, {
      combat,
      answer: input.answer,
      now,
      forceIncorrect: input.answer === '__TIMEOUT__' || Boolean(combat.expiresAt && combat.expiresAt <= now),
    })
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

async function activateNextClassDefenseWaveIfReady(
  tx: Tx,
  sessionId: string,
  now: Date,
  config: ClassDefenseConfig
) {
  const activeMonsterCount = await tx.classDefenseMonster.count({
    where: {
      sessionId,
      status: {
        in: [
          CLASS_DEFENSE_MONSTER_STATUS.WALKING,
          CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
        ],
      },
    },
  })

  if (activeMonsterCount > 0) {
    return false
  }

  const nextWaitingMonster = await tx.classDefenseMonster.findFirst({
    where: {
      sessionId,
      status: CLASS_DEFENSE_MONSTER_STATUS.WAITING,
    },
    orderBy: [{ waveIndex: 'asc' }, { spawnedAt: 'asc' }],
  })

  if (!nextWaitingMonster) {
    return false
  }

  const nextWaveMonsters = await tx.classDefenseMonster.findMany({
    where: {
      sessionId,
      waveIndex: nextWaitingMonster.waveIndex,
      status: CLASS_DEFENSE_MONSTER_STATUS.WAITING,
    },
    orderBy: [{ spawnedAt: 'asc' }, { id: 'asc' }],
  })
  const firstSpawnAt = nextWaveMonsters[0]?.spawnedAt || nextWaitingMonster.spawnedAt
  let readyAt = firstSpawnAt

  const previousWave = await tx.classDefenseMonster.findFirst({
    where: {
      sessionId,
      waveIndex: {
        lt: nextWaitingMonster.waveIndex,
      },
    },
    orderBy: { waveIndex: 'desc' },
    select: {
      waveIndex: true,
    },
  })

  if (previousWave) {
    const previousWaveMonsters = await tx.classDefenseMonster.findMany({
      where: {
        sessionId,
        waveIndex: previousWave.waveIndex,
      },
      select: {
        status: true,
        killedAt: true,
        reachedAt: true,
        updatedAt: true,
      },
    })
    const previousWaveResolved = previousWaveMonsters.length > 0 && previousWaveMonsters.every((monster) =>
      monster.status === CLASS_DEFENSE_MONSTER_STATUS.KILLED ||
      monster.status === CLASS_DEFENSE_MONSTER_STATUS.REACHED
    )

    if (!previousWaveResolved) {
      return false
    }

    const previousWaveFinishedAt = new Date(Math.max(
      ...previousWaveMonsters.map((monster) =>
        (monster.killedAt || monster.reachedAt || monster.updatedAt).getTime()
      )
    ))
    readyAt = new Date(Math.max(
      readyAt.getTime(),
      addSeconds(previousWaveFinishedAt, config.nextWaveDelaySeconds).getTime()
    ))
  }

  if (readyAt > now) {
    return false
  }

  await tx.classDefenseMonster.updateMany({
    where: {
      sessionId,
      waveIndex: nextWaitingMonster.waveIndex,
      status: CLASS_DEFENSE_MONSTER_STATUS.WAITING,
    },
    data: {
      status: CLASS_DEFENSE_MONSTER_STATUS.WALKING,
      updatedAt: now,
    },
  })

  for (const monster of nextWaveMonsters) {
    await appendEvent(tx, {
      sessionId,
      type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_SPAWNED,
      payload: {
        monsterId: monster.id,
        directionId: monster.directionId,
        monsterKey: monster.monsterKey,
        monsterName: monster.monsterName,
        monsterLevel: monster.monsterLevel,
        imagePath: monster.imagePath,
        waveIndex: monster.waveIndex,
        laneIndex: monster.laneIndex,
      },
    })
  }

  return true
}

export async function tickClassDefenseSession(sessionId: string) {
  const now = new Date()
  const expiredBossCombatResults = await resolveExpiredClassDefenseBossCombats(sessionId, now)

  const tickResult = await prisma.$transaction(async (tx) => {
    const session = await tx.classDefenseSession.findUnique({
      where: { id: sessionId },
    })

    if (!session || session.status !== CLASS_DEFENSE_SESSION_STATUS.ACTIVE) {
      return null
    }

    const config = parseClassDefenseConfig(session.configJson)
    const combatResults: ClassDefenseCombatResult[] = []
    const combatCancellations: ClassDefenseCombatCancellation[] = []
    const reachedMonsters: ClassDefenseReachedMonster[] = []

    const expiredCombats = await tx.classDefenseCombat.findMany({
      where: {
        sessionId,
        status: CLASS_DEFENSE_COMBAT_STATUS.ACTIVE,
        expiresAt: {
          lte: now,
        },
      },
      include: {
        session: true,
        monster: true,
      },
    })

    for (const combat of expiredCombats) {
      combatResults.push(await resolveClassDefenseCombatAnswer(tx, {
        combat,
        answer: '__TIMEOUT__',
        now,
        forceIncorrect: true,
      }))
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

    await activateNextClassDefenseWaveIfReady(tx, sessionId, now, config)

    const activeMonsters = await tx.classDefenseMonster.findMany({
      where: {
        sessionId,
        status: {
          in: [
            CLASS_DEFENSE_MONSTER_STATUS.WALKING,
            CLASS_DEFENSE_MONSTER_STATUS.COMBAT,
          ],
        },
      },
    })

    let nextClassHp = session.classHp
    for (const monster of activeMonsters) {
      const elapsedSeconds = Math.max(
        0,
        (now.getTime() - monster.updatedAt.getTime()) / 1000
      )
      const nextProgress = Math.min(1, monster.routeProgress + monster.speed * elapsedSeconds)

      if (nextProgress >= 1) {
        const classHpBeforeHit = nextClassHp
        nextClassHp = Math.max(0, nextClassHp - 1)
        const classHpChanged = nextClassHp < classHpBeforeHit
        const directionId = isClassDefenseDirectionId(monster.directionId)
          ? monster.directionId
          : null
        const activeCombatsForMonster = await tx.classDefenseCombat.findMany({
          where: {
            sessionId,
            monsterId: monster.id,
            status: CLASS_DEFENSE_COMBAT_STATUS.ACTIVE,
          },
          select: {
            id: true,
            sessionId: true,
            monsterId: true,
            studentId: true,
          },
        })

        await tx.classDefenseMonster.update({
          where: { id: monster.id },
          data: {
            status: CLASS_DEFENSE_MONSTER_STATUS.REACHED,
            routeProgress: 1,
            lockedByStudentId: null,
            lockExpiresAt: null,
            reachedAt: now,
          },
        })
        const runtimeRoom = bossRoomRuntimeBySessionId.get(sessionId)
        const runtimeBoss = runtimeRoom?.bosses.get(monster.id)
        if (runtimeBoss) {
          runtimeBoss.status = 'ESCAPED'
          runtimeBoss.routeProgress = 1
          runtimeBoss.settlementStarted = true
        }
        const activeRuntimeCombatsForBoss = runtimeRoom
          ? Array.from(runtimeRoom.activeCombats.values()).filter((combat) => combat.bossId === monster.id)
          : []
        for (const combat of activeRuntimeCombatsForBoss) {
          runtimeRoom?.activeCombats.delete(combat.id)
          combatCancellations.push({
            combatId: combat.id,
            sessionId: combat.sessionId,
            monsterId: combat.bossId,
            studentId: combat.studentId,
            reason: 'BOSS_REACHED',
          })
        }
        if (activeCombatsForMonster.length > 0) {
          await tx.classDefenseCombat.updateMany({
            where: {
              id: {
                in: activeCombatsForMonster.map((combat) => combat.id),
              },
            },
            data: {
              status: CLASS_DEFENSE_COMBAT_STATUS.CANCELLED,
              endedAt: now,
            },
          })
          combatCancellations.push(
            ...activeCombatsForMonster.map((combat) => ({
              combatId: combat.id,
              sessionId: combat.sessionId,
              monsterId: combat.monsterId,
              studentId: combat.studentId,
              reason: 'MONSTER_REACHED',
            }))
          )
        }
        await appendEvent(tx, {
          sessionId,
          type: CLASS_DEFENSE_EVENT_TYPE.MONSTER_REACHED,
          payload: {
            monsterId: monster.id,
            directionId: monster.directionId,
            classHp: nextClassHp,
          },
        })
        if (directionId) {
          reachedMonsters.push({
            monsterId: monster.id,
            sessionId,
            directionId,
            classHp: nextClassHp,
            classHpChanged,
          })
        }
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

    const sessionEnd = await finalizeClassDefenseSessionIfEndedWithTx(tx, sessionId, now)

    return {
      combatResults,
      combatCancellations,
      reachedMonsters,
      sessionEnd,
    }
  })

  if (!tickResult) {
    return null
  }

  const summary = await getClassDefenseDirectionSummary(sessionId)
  if (summary.session.status !== CLASS_DEFENSE_SESSION_STATUS.ACTIVE) {
    bossRoomRuntimeBySessionId.delete(sessionId)
  }

  return {
    summary,
    sessionEnd: tickResult.sessionEnd,
    combatResults: [...expiredBossCombatResults, ...tickResult.combatResults],
    combatCancellations: tickResult.combatCancellations,
    reachedMonsters: tickResult.reachedMonsters,
  }
}
