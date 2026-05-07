import { WebSocket, WebSocketServer } from 'ws'
import { parseClassDefenseConfig } from '@/lib/class-defense/config'
import { verifyClassDefenseWsTicket } from '@/lib/class-defense/auth'
import {
  getClassDefenseDirectionDefenders,
  getClassDefenseDirectionSummary,
  getActiveClassDefenseSessionForStudent,
  getClassDefenseSnapshot,
  fleeClassDefenseCombat,
  joinClassDefenseSession,
  markClassDefenseHeartbeat,
  selectClassDefenseDirection,
  startClassDefenseCombat,
  startClassDefenseBossCombat,
  submitClassDefenseAnswer,
  tickClassDefenseSession,
} from '@/lib/class-defense/service'
import {
  CLASS_DEFENSE_DIRECTIONS,
  CLASS_DEFENSE_DIRECTION_IDS,
  CLASS_DEFENSE_MONSTER_STATUS,
  type ClassDefenseDirectionId,
} from '@/lib/class-defense/constants'
import { prisma } from '@/lib/prisma'

interface ClientState {
  id: string
  ws: WebSocket
  sessionId: string | null
  studentId: string | null
  username: string | null
  directionId: ClassDefenseDirectionId | null
}

interface ClientMessage {
  type?: string
  requestId?: string
  ticket?: string
  sessionId?: string
  bossId?: string
  monsterId?: string
  combatId?: string
  answer?: string
  directionId?: string | null
  timeout?: boolean
  reason?: string
}

const port = Number.parseInt(process.env.CLASS_DEFENSE_WS_PORT || '3001', 10)
const host = process.env.CLASS_DEFENSE_WS_HOST || '127.0.0.1'
const clients = new Map<WebSocket, ClientState>()
const roomClients = new Map<string, Set<WebSocket>>()
const roomTimers = new Map<string, NodeJS.Timeout>()
const roomBroadcastTimers = new Map<string, NodeJS.Timeout>()
const roomBroadcastRemovalReasons = new Map<string, Map<string, string>>()
const tickingRooms = new Set<string>()
const roomMonsterStates = new Map<string, Map<string, MonsterBroadcastView>>()
const ROOM_STATE_BROADCAST_DELAY_MS = Number.parseInt(
  process.env.CLASS_DEFENSE_ROOM_BROADCAST_DELAY_MS || '100',
  10
)

interface MonsterBroadcastView {
  id: string
  directionId: ClassDefenseDirectionId
  waveIndex: number
  laneIndex: number
  monsterKey: string
  monsterName: string | null
  imagePath: string | null
  status: string
  hp: number
  maxHp: number
  routeProgress: number
  lockedByStudentId: string | null
}

interface PublicMessagePayload {
  id: string
  kind: 'direction_under_attack' | 'student_down'
  sessionId: string
  directionId?: ClassDefenseDirectionId
  studentId?: string
  studentName?: string
  message: string
  createdAt: string
}

const directionLabelById = new Map(
  CLASS_DEFENSE_DIRECTIONS.map((direction) => [direction.id, direction.label])
)
let publicMessageSequence = 0

function clientId() {
  return Math.random().toString(36).slice(2)
}

function nextPublicMessageId(now: Date) {
  publicMessageSequence = (publicMessageSequence + 1) % 1000000
  const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 14)
  const sequence = String(publicMessageSequence).padStart(6, '0')
  return `pm-${timestamp}-${sequence}`
}

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

function sendError(ws: WebSocket, requestId: string | undefined, error: unknown) {
  send(ws, {
    type: 'error',
    requestId: requestId || null,
    error: error instanceof Error ? error.message : '请求失败',
  })
}

function broadcast(sessionId: string, payload: unknown) {
  const sockets = roomClients.get(sessionId)
  if (!sockets) {
    return
  }

  for (const ws of Array.from(sockets)) {
    send(ws, payload)
  }
}

function broadcastPublicMessage(sessionId: string, data: PublicMessagePayload) {
  broadcast(sessionId, {
    type: 'public_message',
    data,
  })
}

function broadcastDirectionUnderAttackMessage(
  sessionId: string,
  directionId: ClassDefenseDirectionId
) {
  const now = new Date()
  const directionLabel = directionLabelById.get(directionId) || directionId
  broadcastPublicMessage(sessionId, {
    id: nextPublicMessageId(now),
    kind: 'direction_under_attack',
    sessionId,
    directionId,
    message: `${directionLabel}防线正在遭受攻击，请求支援`,
    createdAt: now.toISOString(),
  })
}

async function broadcastStudentDownMessage(
  sessionId: string,
  studentId: string,
  directionId?: ClassDefenseDirectionId | null
) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      name: true,
      username: true,
    },
  })
  const studentName = student?.name || student?.username || '同学'
  const now = new Date()
  broadcastPublicMessage(sessionId, {
    id: nextPublicMessageId(now),
    kind: 'student_down',
    sessionId,
    ...(directionId ? { directionId } : {}),
    studentId,
    studentName,
    message: `${studentName}在战斗中壮烈牺牲`,
    createdAt: now.toISOString(),
  })
}

function isClassDefenseDirectionId(value: unknown): value is ClassDefenseDirectionId {
  return CLASS_DEFENSE_DIRECTION_IDS.includes(String(value ?? '') as ClassDefenseDirectionId)
}

function parseOptionalDirectionId(value: unknown) {
  if (value === null) {
    return null
  }

  const directionId = String(value ?? '').trim()
  if (!directionId) {
    return null
  }

  if (!isClassDefenseDirectionId(directionId)) {
    throw new Error('方向不存在')
  }

  return directionId
}

function broadcastDirection(sessionId: string, directionId: ClassDefenseDirectionId, payload: unknown) {
  const sockets = roomClients.get(sessionId)
  if (!sockets) {
    return
  }

  for (const ws of Array.from(sockets)) {
    const state = clients.get(ws)
    if (state?.directionId === directionId) {
      send(ws, payload)
    }
  }
}

function sendToStudent(sessionId: string, studentId: string, payload: unknown) {
  const sockets = roomClients.get(sessionId)
  if (!sockets) {
    return
  }

  for (const ws of Array.from(sockets)) {
    const state = clients.get(ws)
    if (state?.studentId === studentId) {
      send(ws, payload)
    }
  }
}

async function broadcastDirectionSummary(sessionId: string) {
  const summary = await getClassDefenseDirectionSummary(sessionId)
  broadcast(sessionId, {
    type: 'direction_summary',
    data: summary,
  })
}

async function broadcastDirectionSnapshot(sessionId: string, directionId: ClassDefenseDirectionId) {
  const snapshot = await getClassDefenseSnapshot(sessionId, null, directionId)
  broadcastDirection(sessionId, directionId, {
    type: 'direction_snapshot',
    requestId: null,
    data: snapshot,
  })
}

async function broadcastDirectionDefenders(sessionId: string, directionId: ClassDefenseDirectionId) {
  const defenders = await getClassDefenseDirectionDefenders(sessionId, directionId)
  broadcastDirection(sessionId, directionId, {
    type: 'direction_defenders',
    data: defenders,
  })
}

async function getActiveMonsterViews(sessionId: string) {
  const monsters = await prisma.classDefenseMonster.findMany({
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
      { laneIndex: 'asc' },
      { id: 'asc' },
    ],
    select: {
      id: true,
      directionId: true,
      waveIndex: true,
      laneIndex: true,
      monsterKey: true,
      monsterName: true,
      imagePath: true,
      status: true,
      hp: true,
      maxHp: true,
      routeProgress: true,
      lockedByStudentId: true,
    },
  })

  return monsters
    .filter((monster): monster is typeof monster & { directionId: ClassDefenseDirectionId } =>
      isClassDefenseDirectionId(monster.directionId)
    )
    .map((monster) => ({
      ...monster,
      lockedByStudentId: monster.lockedByStudentId || null,
    }))
}

async function refreshMonsterState(sessionId: string) {
  const monsters = await getActiveMonsterViews(sessionId)
  roomMonsterStates.set(
    sessionId,
    new Map(monsters.map((monster) => [monster.id, monster]))
  )
}

function buildMonsterPatch(previous: MonsterBroadcastView, next: MonsterBroadcastView) {
  const patch: Partial<Pick<
    MonsterBroadcastView,
    'hp' | 'maxHp' | 'status' | 'routeProgress' | 'lockedByStudentId'
  >> = {}

  if (previous.hp !== next.hp) patch.hp = next.hp
  if (previous.maxHp !== next.maxHp) patch.maxHp = next.maxHp
  if (previous.status !== next.status) patch.status = next.status
  if (previous.routeProgress !== next.routeProgress) patch.routeProgress = next.routeProgress
  if (previous.lockedByStudentId !== next.lockedByStudentId) {
    patch.lockedByStudentId = next.lockedByStudentId
  }

  return patch
}

function toBossBroadcastView(monster: MonsterBroadcastView) {
  return {
    id: monster.id,
    bossId: monster.id,
    monsterId: monster.id,
    directionId: monster.directionId,
    bossKey: monster.monsterKey,
    monsterKey: monster.monsterKey,
    bossName: monster.monsterName || 'Boss',
    monsterName: monster.monsterName || 'Boss',
    imagePath: monster.imagePath || undefined,
    phase: 1,
    status: monster.status === CLASS_DEFENSE_MONSTER_STATUS.KILLED ? 'DEFEATED' : 'ACTIVE',
    hp: monster.hp,
    maxHp: monster.maxHp,
    bossHp: monster.hp,
    bossMaxHp: monster.maxHp,
    waveIndex: monster.waveIndex,
    laneIndex: monster.laneIndex,
    routeProgress: monster.routeProgress,
  }
}

async function broadcastMonsterDiffs(
  sessionId: string,
  removalReasons = new Map<string, string>()
) {
  const previous = roomMonsterStates.get(sessionId) || new Map<string, MonsterBroadcastView>()
  const nextMonsters = await getActiveMonsterViews(sessionId)
  const next = new Map(nextMonsters.map((monster) => [monster.id, monster]))

  for (const monster of nextMonsters) {
    const existing = previous.get(monster.id)
    if (!existing) {
      broadcastDirection(sessionId, monster.directionId, {
        type: 'monster_spawned',
        data: {
          directionId: monster.directionId,
          monster,
        },
      })
      broadcast(sessionId, {
        type: 'boss_updated',
        data: {
          bossId: monster.id,
          directionId: monster.directionId,
          patch: toBossBroadcastView(monster),
        },
      })
      continue
    }

    const patch = buildMonsterPatch(existing, monster)
    if (Object.keys(patch).length > 0) {
      broadcastDirection(sessionId, monster.directionId, {
        type: 'monster_updated',
        data: {
          directionId: monster.directionId,
          monsterId: monster.id,
          patch,
        },
      })
      broadcast(sessionId, {
        type: 'boss_updated',
        data: {
          bossId: monster.id,
          directionId: monster.directionId,
          patch: {
            ...patch,
            bossHp: monster.hp,
            bossMaxHp: monster.maxHp,
          },
        },
      })
    }
  }

  for (const monster of Array.from(previous.values())) {
    if (next.has(monster.id)) {
      continue
    }

    broadcastDirection(sessionId, monster.directionId, {
      type: 'monster_removed',
      data: {
        directionId: monster.directionId,
        monsterId: monster.id,
        reason: removalReasons.get(monster.id) || 'REMOVED',
      },
    })
    broadcast(sessionId, {
      type: 'boss_removed',
      data: {
        directionId: monster.directionId,
        bossId: monster.id,
        monsterId: monster.id,
        reason: removalReasons.get(monster.id) || 'REMOVED',
      },
    })
  }

  roomMonsterStates.set(sessionId, next)
}

function activeDirectionsForRoom(sessionId: string) {
  return new Set(
    Array.from(clients.values())
      .filter((client) => client.sessionId === sessionId && client.directionId)
      .map((client) => client.directionId as ClassDefenseDirectionId)
  )
}

async function broadcastRoomState(sessionId: string, removalReasons = new Map<string, string>()) {
  await broadcastDirectionSummary(sessionId)
  await broadcastMonsterDiffs(sessionId, removalReasons)

  for (const directionId of Array.from(activeDirectionsForRoom(sessionId))) {
    await broadcastDirectionSnapshot(sessionId, directionId)
  }
}

function scheduleRoomStateBroadcast(
  sessionId: string,
  removalReasons = new Map<string, string>()
) {
  const pendingReasons = roomBroadcastRemovalReasons.get(sessionId) || new Map<string, string>()
  for (const [monsterId, reason] of Array.from(removalReasons.entries())) {
    pendingReasons.set(monsterId, reason)
  }
  roomBroadcastRemovalReasons.set(sessionId, pendingReasons)

  if (roomBroadcastTimers.has(sessionId)) {
    return
  }

  const timer = setTimeout(() => {
    roomBroadcastTimers.delete(sessionId)
    const reasons = roomBroadcastRemovalReasons.get(sessionId) || new Map<string, string>()
    roomBroadcastRemovalReasons.delete(sessionId)
    void broadcastRoomState(sessionId, reasons).catch((error) => {
      console.error(`[class-defense-ws] room state broadcast failed for ${sessionId}`, error)
    })
  }, Math.max(0, ROOM_STATE_BROADCAST_DELAY_MS))
  roomBroadcastTimers.set(sessionId, timer)
}

function addToRoom(sessionId: string, ws: WebSocket) {
  const current = roomClients.get(sessionId) || new Set<WebSocket>()
  current.add(ws)
  roomClients.set(sessionId, current)
}

function removeFromRoom(sessionId: string, ws: WebSocket) {
  const current = roomClients.get(sessionId)
  if (!current) {
    return
  }

  current.delete(ws)
  if (current.size === 0) {
    roomClients.delete(sessionId)
    const timer = roomTimers.get(sessionId)
    if (timer) {
      clearInterval(timer)
      roomTimers.delete(sessionId)
    }
    const broadcastTimer = roomBroadcastTimers.get(sessionId)
    if (broadcastTimer) {
      clearTimeout(broadcastTimer)
      roomBroadcastTimers.delete(sessionId)
    }
    roomBroadcastRemovalReasons.delete(sessionId)
    roomMonsterStates.delete(sessionId)
  }
}

function hasOtherStudentSocket(sessionId: string, studentId: string, ws: WebSocket) {
  const sockets = roomClients.get(sessionId)
  if (!sockets) {
    return false
  }

  for (const socket of Array.from(sockets)) {
    if (socket === ws) {
      continue
    }
    const state = clients.get(socket)
    if (state?.studentId === studentId) {
      return true
    }
  }

  return false
}

async function getTickMs(sessionId: string) {
  const session = await prisma.classDefenseSession.findUnique({
    where: { id: sessionId },
    select: { configJson: true },
  })
  return parseClassDefenseConfig(session?.configJson).tickMs
}

async function tickRoom(sessionId: string) {
  if (tickingRooms.has(sessionId)) {
    return
  }

  tickingRooms.add(sessionId)
  try {
    const tickResult = await tickClassDefenseSession(sessionId)
    if (tickResult) {
      for (const result of tickResult.combatResults) {
        sendToStudent(sessionId, result.studentId, {
          type: result.isBoss ? 'boss_combat_result' : 'combat_result',
          requestId: null,
          data: result,
        })
        if (result.isBoss) {
          broadcast(sessionId, {
            type: 'boss_updated',
            data: {
              bossId: result.bossId || result.monsterId,
              directionId: result.directionId,
              patch: {
                hp: result.bossHp ?? result.monsterHp,
                maxHp: result.bossMaxHp,
                phase: 1,
                totalDamage: result.totalDamage,
              },
            },
          })
          if (result.bossDefeatedNow) {
            broadcast(sessionId, {
              type: 'boss_defeated',
              data: {
                bossId: result.bossId || result.monsterId,
                monsterId: result.monsterId,
                directionId: result.directionId,
                status: 'DEFEATED',
                rewards: result.rewards || [],
              },
            })
          }
        }
        if (result.studentDown) {
          await broadcastStudentDownMessage(sessionId, result.studentId, result.directionId)
        }
      }
      for (const cancellation of tickResult.combatCancellations) {
        sendToStudent(sessionId, cancellation.studentId, {
          type: 'combat_cancelled',
          requestId: null,
          data: cancellation,
        })
      }
      broadcast(sessionId, {
        type: 'direction_summary',
        data: tickResult.summary,
      })
      const damageReachedMonsters = tickResult.reachedMonsters.filter(
        (monster) => monster.classHpChanged
      )
      for (const reachedMonster of damageReachedMonsters) {
        broadcastDirectionUnderAttackMessage(sessionId, reachedMonster.directionId)
      }
      await broadcastMonsterDiffs(
        sessionId,
        new Map(tickResult.reachedMonsters.map((monster) => [monster.monsterId, 'REACHED']))
      )
      for (const directionId of Array.from(activeDirectionsForRoom(sessionId))) {
        await broadcastDirectionSnapshot(sessionId, directionId)
      }
    }
  } catch (error) {
    console.error(`[class-defense-ws] tick failed for ${sessionId}`, error)
  } finally {
    tickingRooms.delete(sessionId)
  }
}

async function ensureRoomTicker(sessionId: string) {
  if (roomTimers.has(sessionId)) {
    return
  }

  const tickMs = await getTickMs(sessionId)
  const timer = setInterval(() => {
    void tickRoom(sessionId)
  }, tickMs)
  roomTimers.set(sessionId, timer)
  await refreshMonsterState(sessionId)
}

async function handleJoin(ws: WebSocket, state: ClientState, message: ClientMessage) {
  const ticket = message.ticket || ''
  const verified = await verifyClassDefenseWsTicket(ticket)
  if (!verified) {
    throw new Error('WebSocket 凭证无效或已过期')
  }

  let sessionId = message.sessionId || verified.sessionId || null
  if (!sessionId) {
    const activeSession = await getActiveClassDefenseSessionForStudent(verified)
    sessionId = activeSession?.id || null
  }

  if (!sessionId) {
    throw new Error('当前班级没有进行中的守护班级')
  }

  const joined = await joinClassDefenseSession(sessionId, verified.id)
  const directionId = parseOptionalDirectionId(message.directionId ?? null)

  if (state.sessionId) {
    removeFromRoom(state.sessionId, ws)
  }
  const snapshot = await selectClassDefenseDirection({
    sessionId,
    studentId: verified.id,
    directionId,
  })

  state.sessionId = sessionId
  state.studentId = verified.id
  state.username = verified.username
  state.directionId = directionId
  addToRoom(sessionId, ws)
  await ensureRoomTicker(sessionId)

  send(ws, {
    type: 'joined',
    requestId: message.requestId || null,
    data: {
      student: joined.student,
      participant: joined.participant,
      snapshot,
    },
  })
  broadcast(sessionId, {
    type: 'participant_joined',
    data: {
      student: joined.student,
      participant: joined.participant,
      pet: joined.battleStats.pet,
      battleStats: joined.battleStats,
    },
  })
  await broadcastDirectionSummary(sessionId)
  if (directionId) {
    await broadcastDirectionDefenders(sessionId, directionId)
  }
}

async function handleAttack(ws: WebSocket, state: ClientState, message: ClientMessage) {
  if (!state.sessionId || !state.studentId) {
    throw new Error('请先进入守护班级')
  }

  const monsterId = String(message.monsterId || '').trim()
  if (!monsterId) {
    throw new Error('缺少怪物 ID')
  }

  const combat = await startClassDefenseCombat({
    sessionId: state.sessionId,
    studentId: state.studentId,
    monsterId,
  })

  send(ws, {
    type: 'combat_started',
    requestId: message.requestId || null,
    data: combat,
  })
  scheduleRoomStateBroadcast(state.sessionId)
}

async function handleAttackBoss(ws: WebSocket, state: ClientState, message: ClientMessage) {
  if (!state.sessionId || !state.studentId) {
    throw new Error('请先进入守护班级')
  }

  const bossId = String(message.bossId || message.monsterId || '').trim()
  if (!bossId) {
    throw new Error('缺少 Boss ID')
  }

  const combat = await startClassDefenseBossCombat({
    sessionId: state.sessionId,
    studentId: state.studentId,
    bossId,
    directionId: message.directionId ?? state.directionId,
  })

  send(ws, {
    type: 'boss_combat_started',
    requestId: message.requestId || null,
    data: combat,
  })
}

async function handleSelectDirection(ws: WebSocket, state: ClientState, message: ClientMessage) {
  if (!state.sessionId || !state.studentId) {
    throw new Error('请先进入守护班级')
  }

  const previousDirectionId = state.directionId
  const directionId = parseOptionalDirectionId(message.directionId ?? null)
  const snapshot = await selectClassDefenseDirection({
    sessionId: state.sessionId,
    studentId: state.studentId,
    directionId,
  })

  state.directionId = directionId
  send(ws, {
    type: 'direction_snapshot',
    requestId: message.requestId || null,
    data: snapshot,
  })
  await broadcastDirectionSummary(state.sessionId)

  if (previousDirectionId && previousDirectionId !== directionId) {
    await broadcastDirectionDefenders(state.sessionId, previousDirectionId)
  }
  if (directionId) {
    await broadcastDirectionDefenders(state.sessionId, directionId)
  }
}

async function handleSubmitAnswer(ws: WebSocket, state: ClientState, message: ClientMessage) {
  if (!state.sessionId || !state.studentId) {
    throw new Error('请先进入守护班级')
  }

  const combatId = String(message.combatId || '').trim()
  if (!combatId) {
    throw new Error('缺少战斗 ID')
  }

  const result = await submitClassDefenseAnswer({
    combatId,
    studentId: state.studentId,
    answer: message.timeout ? '__TIMEOUT__' : String(message.answer ?? ''),
  })

  send(ws, {
    type: result.isBoss ? 'boss_combat_result' : 'combat_result',
    requestId: message.requestId || null,
    data: result,
  })
  if (result.isBoss) {
    broadcast(state.sessionId, {
      type: 'boss_updated',
      data: {
        bossId: result.bossId || result.monsterId,
        directionId: result.directionId,
        patch: {
          hp: result.bossHp ?? result.monsterHp,
          maxHp: result.bossMaxHp,
          phase: 1,
          totalDamage: result.totalDamage,
        },
      },
    })
    broadcast(state.sessionId, {
      type: 'boss_damaged',
      data: {
        bossId: result.bossId || result.monsterId,
        monsterId: result.monsterId,
        directionId: result.directionId,
        studentId: result.studentId,
        damageToBoss: result.damageToBoss || 0,
        damageToMonster: result.damageToMonster,
        bossHp: result.bossHp ?? result.monsterHp,
        bossMaxHp: result.bossMaxHp,
        myDamage: result.myDamage,
        totalDamage: result.totalDamage,
        bossDefeated: result.bossDefeated || false,
      },
    })
    if (result.bossDefeatedNow) {
      broadcast(state.sessionId, {
        type: 'boss_defeated',
        data: {
          bossId: result.bossId || result.monsterId,
          monsterId: result.monsterId,
          directionId: result.directionId,
          status: 'DEFEATED',
          rewards: result.rewards || [],
        },
      })
    }
  }
  scheduleRoomStateBroadcast(
    state.sessionId,
    result.monsterKilled ? new Map([[result.monsterId, 'KILLED']]) : undefined
  )
  if (result.studentDown) {
    void broadcastStudentDownMessage(state.sessionId, result.studentId, result.directionId)
      .catch((error) => {
        console.error('[class-defense-ws] student down public message failed', error)
      })
  }
}

async function handleFleeCombat(ws: WebSocket, state: ClientState, message: ClientMessage) {
  if (!state.sessionId || !state.studentId) {
    throw new Error('请先进入守护班级')
  }

  const combatId = String(message.combatId || '').trim()
  if (!combatId) {
    throw new Error('缺少战斗 ID')
  }

  const monsterId = String(message.monsterId || '').trim()
  if (!monsterId) {
    throw new Error('缺少怪物 ID')
  }

  const result = await fleeClassDefenseCombat({
    combatId,
    studentId: state.studentId,
    monsterId,
  })

  send(ws, {
    type: 'flee_result',
    requestId: message.requestId || null,
    data: result,
  })

  if (result.success) {
    scheduleRoomStateBroadcast(state.sessionId)
  }
}

async function handleHeartbeat(ws: WebSocket, state: ClientState, message: ClientMessage) {
  if (state.sessionId && state.studentId) {
    await markClassDefenseHeartbeat(state.sessionId, state.studentId)
  }

  send(ws, {
    type: 'heartbeat_ack',
    requestId: message.requestId || null,
    serverTime: new Date().toISOString(),
  })
}

async function handleMessage(ws: WebSocket, state: ClientState, raw: WebSocket.RawData) {
  let message: ClientMessage
  try {
    message = JSON.parse(raw.toString())
  } catch {
    throw new Error('消息不是合法 JSON')
  }

  if (message.type === 'join_session') {
    await handleJoin(ws, state, message)
    return
  }

  if (message.type === 'attack_monster') {
    await handleAttack(ws, state, message)
    return
  }

  if (message.type === 'attack_boss') {
    await handleAttackBoss(ws, state, message)
    return
  }

  if (message.type === 'select_direction') {
    await handleSelectDirection(ws, state, message)
    return
  }

  if (message.type === 'submit_answer') {
    await handleSubmitAnswer(ws, state, message)
    return
  }

  if (message.type === 'flee_combat') {
    await handleFleeCombat(ws, state, message)
    return
  }

  if (message.type === 'heartbeat') {
    await handleHeartbeat(ws, state, message)
    return
  }

  throw new Error('不支持的消息类型')
}

const wss = new WebSocketServer({ host, port })

wss.on('connection', (ws) => {
  const state: ClientState = {
    id: clientId(),
    ws,
    sessionId: null,
    studentId: null,
    username: null,
    directionId: null,
  }
  clients.set(ws, state)

  send(ws, {
    type: 'connected',
    data: {
      clientId: state.id,
      serverTime: new Date().toISOString(),
    },
  })

  ws.on('message', (raw) => {
    void handleMessage(ws, state, raw).catch((error) => {
      let requestId: string | undefined
      try {
        requestId = JSON.parse(raw.toString()).requestId
      } catch {
        requestId = undefined
      }
      sendError(ws, requestId, error)
    })
  })

  ws.on('close', () => {
    const sessionId = state.sessionId
    const studentId = state.studentId
    const directionId = state.directionId
    const shouldClearDirection = Boolean(
      sessionId &&
        studentId &&
        directionId &&
        !hasOtherStudentSocket(sessionId, studentId, ws)
    )

    clients.delete(ws)
    if (sessionId) {
      removeFromRoom(sessionId, ws)
    }

    if (shouldClearDirection && sessionId && studentId && directionId) {
      void selectClassDefenseDirection({ sessionId, studentId, directionId: null })
        .then(async () => {
          await broadcastDirectionSummary(sessionId)
          await broadcastDirectionDefenders(sessionId, directionId)
        })
        .catch((error) => {
          console.error('[class-defense-ws] clear direction failed', error)
        })
    }
  })
})

async function shutdown() {
  for (const timer of Array.from(roomTimers.values())) {
    clearInterval(timer)
  }
  for (const timer of Array.from(roomBroadcastTimers.values())) {
    clearTimeout(timer)
  }
  wss.close()
  await prisma.$disconnect()
}

wss.on('listening', () => {
  console.log(`[class-defense-ws] listening on ws://${host}:${port}`)
})

wss.on('error', async (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[class-defense-ws] ${host}:${port} 已被占用，请停止旧进程或设置 CLASS_DEFENSE_WS_PORT`)
  } else {
    console.error('[class-defense-ws] server failed', error)
  }
  await shutdown()
  process.exit(1)
})

process.on('SIGINT', async () => {
  await shutdown()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await shutdown()
  process.exit(0)
})
