export const CLASS_DEFENSE_SESSION_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
} as const

export const CLASS_DEFENSE_PARTICIPANT_STATUS = {
  ALIVE: 'ALIVE',
  DOWN: 'DOWN',
} as const

export const CLASS_DEFENSE_MONSTER_STATUS = {
  WAITING: 'WAITING',
  WALKING: 'WALKING',
  COMBAT: 'COMBAT',
  KILLED: 'KILLED',
  REACHED: 'REACHED',
} as const

export const CLASS_DEFENSE_COMBAT_STATUS = {
  ACTIVE: 'ACTIVE',
  RESOLVED: 'RESOLVED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const

export const CLASS_DEFENSE_EVENT_TYPE = {
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_ENDED: 'SESSION_ENDED',
  STUDENT_JOINED: 'STUDENT_JOINED',
  STUDENT_DOWN: 'STUDENT_DOWN',
  STUDENT_REVIVED: 'STUDENT_REVIVED',
  MONSTER_SPAWNED: 'MONSTER_SPAWNED',
  MONSTER_UPDATED: 'MONSTER_UPDATED',
  MONSTER_LOCKED: 'MONSTER_LOCKED',
  MONSTER_RELEASED: 'MONSTER_RELEASED',
  MONSTER_KILLED: 'MONSTER_KILLED',
  MONSTER_REACHED: 'MONSTER_REACHED',
  CLASS_HP_CHANGED: 'CLASS_HP_CHANGED',
  COMBAT_STARTED: 'COMBAT_STARTED',
  COMBAT_RESULT: 'COMBAT_RESULT',
} as const

export const CLASS_DEFENSE_TOKEN_USE = {
  ACCESS: 'CLASS_DEFENSE_ACCESS',
  WS_TICKET: 'CLASS_DEFENSE_WS_TICKET',
} as const

export const CLASS_DEFENSE_DIRECTIONS = [
  { id: 'northwest', label: '西北' },
  { id: 'north', label: '北' },
  { id: 'northeast', label: '东北' },
  { id: 'west', label: '西' },
  { id: 'east', label: '东' },
  { id: 'southwest', label: '西南' },
  { id: 'south', label: '南' },
  { id: 'southeast', label: '东南' },
] as const

export type ClassDefenseDirectionId = typeof CLASS_DEFENSE_DIRECTIONS[number]['id']

export const CLASS_DEFENSE_DIRECTION_IDS = CLASS_DEFENSE_DIRECTIONS.map((direction) => direction.id)
