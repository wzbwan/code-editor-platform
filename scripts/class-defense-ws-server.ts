import { WebSocket, WebSocketServer } from 'ws'
import { parseClassDefenseConfig } from '@/lib/class-defense/config'
import { verifyClassDefenseWsTicket } from '@/lib/class-defense/auth'
import {
  getActiveClassDefenseSessionForStudent,
  getClassDefenseSnapshot,
  fleeClassDefenseCombat,
  joinClassDefenseSession,
  markClassDefenseHeartbeat,
  startClassDefenseCombat,
  submitClassDefenseAnswer,
  tickClassDefenseSession,
} from '@/lib/class-defense/service'
import { prisma } from '@/lib/prisma'

interface ClientState {
  id: string
  ws: WebSocket
  sessionId: string | null
  studentId: string | null
  username: string | null
}

interface ClientMessage {
  type?: string
  requestId?: string
  ticket?: string
  sessionId?: string
  monsterId?: string
  combatId?: string
  answer?: string
}

const port = Number.parseInt(process.env.CLASS_DEFENSE_WS_PORT || '3001', 10)
const clients = new Map<WebSocket, ClientState>()
const roomClients = new Map<string, Set<WebSocket>>()
const roomTimers = new Map<string, NodeJS.Timeout>()
const tickingRooms = new Set<string>()

function clientId() {
  return Math.random().toString(36).slice(2)
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
  }
}

async function getTickMs(sessionId: string) {
  const session = await prisma.classDefenseSession.findUnique({
    where: { id: sessionId },
    select: { configJson: true },
  })
  return parseClassDefenseConfig(session?.configJson).tickMs
}

async function broadcastSnapshot(sessionId: string) {
  const snapshot = await getClassDefenseSnapshot(sessionId)
  broadcast(sessionId, {
    type: 'session_snapshot',
    data: snapshot,
  })
}

async function tickRoom(sessionId: string) {
  if (tickingRooms.has(sessionId)) {
    return
  }

  tickingRooms.add(sessionId)
  try {
    const snapshot = await tickClassDefenseSession(sessionId)
    if (snapshot) {
      broadcast(sessionId, {
        type: 'session_snapshot',
        data: snapshot,
      })
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

  if (state.sessionId) {
    removeFromRoom(state.sessionId, ws)
  }
  state.sessionId = sessionId
  state.studentId = verified.id
  state.username = verified.username
  addToRoom(sessionId, ws)
  await ensureRoomTicker(sessionId)

  const snapshot = await getClassDefenseSnapshot(sessionId, verified.id)
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
  await broadcastSnapshot(state.sessionId)
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
    answer: String(message.answer ?? ''),
  })

  send(ws, {
    type: 'combat_result',
    requestId: message.requestId || null,
    data: result,
  })
  await broadcastSnapshot(state.sessionId)
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
    await broadcastSnapshot(state.sessionId)
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

const wss = new WebSocketServer({ port })

wss.on('connection', (ws) => {
  const state: ClientState = {
    id: clientId(),
    ws,
    sessionId: null,
    studentId: null,
    username: null,
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
    clients.delete(ws)
    if (state.sessionId) {
      removeFromRoom(state.sessionId, ws)
    }
  })
})

process.on('SIGINT', async () => {
  for (const timer of Array.from(roomTimers.values())) {
    clearInterval(timer)
  }
  wss.close()
  await prisma.$disconnect()
  process.exit(0)
})

console.log(`[class-defense-ws] listening on ws://localhost:${port}`)
