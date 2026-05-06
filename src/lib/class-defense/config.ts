import {
  CLASS_DEFENSE_DIRECTION_IDS,
  type ClassDefenseDirectionId,
} from '@/lib/class-defense/constants'

export interface ClassDefenseMonsterConfig {
  monsterKey: string
  monsterName?: string
  monsterLevel: number
  imagePath?: string
  hp: number
  attack: number
  speed: number
  spawnDelaySeconds: number
}

export interface ClassDefenseWaveConfig {
  waveIndex: number
  startDelaySeconds: number
  monsters: ClassDefenseMonsterConfig[]
}

export interface ClassDefenseConfig {
  maxClassHp: number
  reviveSeconds: number
  combatSeconds: number
  nextWaveDelaySeconds: number
  killPointReward: number
  tickMs: number
  enabledDirections: ClassDefenseDirectionId[]
  waves: ClassDefenseWaveConfig[]
}

const DEFAULT_WAVE_LANE_COUNT = 15

function repeatWaveMonster(
  monster: ClassDefenseMonsterConfig,
  count = DEFAULT_WAVE_LANE_COUNT
) {
  return Array.from({ length: count }, () => ({
    ...monster,
    spawnDelaySeconds: 0,
  }))
}

const DEFAULT_WAVES: ClassDefenseWaveConfig[] = [
  {
    waveIndex: 0,
    startDelaySeconds: 1,
    monsters: repeatWaveMonster({
      monsterKey: 'slime',
      monsterName: '史莱姆',
      monsterLevel: 1,
      imagePath: '/pets/rabbit.png',
      hp: 30,
      attack: 10,
      speed: 0.012,
      spawnDelaySeconds: 0,
    }),
  },
  {
    waveIndex: 1,
    startDelaySeconds: 1,
    monsters: repeatWaveMonster({
      monsterKey: 'goblin',
      monsterName: '哥布林',
      monsterLevel: 2,
      imagePath: '/pets/fox.png',
      hp: 54,
      attack: 14,
      speed: 0.01,
      spawnDelaySeconds: 0,
    }),
  },
]

export const DEFAULT_CLASS_DEFENSE_CONFIG: ClassDefenseConfig = {
  maxClassHp: 10,
  reviveSeconds: 30,
  combatSeconds: 30,
  nextWaveDelaySeconds: 4,
  killPointReward: 1,
  tickMs: 1000,
  enabledDirections: [...CLASS_DEFENSE_DIRECTION_IDS],
  waves: DEFAULT_WAVES,
}

function asPositiveInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function asNonNegativeInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function asPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeMonsterConfig(
  value: Partial<ClassDefenseMonsterConfig> | null | undefined,
  fallback: ClassDefenseMonsterConfig
): ClassDefenseMonsterConfig {
  return {
    monsterKey: String(value?.monsterKey || fallback.monsterKey).trim() || fallback.monsterKey,
    monsterName: String(value?.monsterName || fallback.monsterName || '').trim() || undefined,
    monsterLevel: asPositiveInt(value?.monsterLevel, fallback.monsterLevel || 1),
    imagePath: String(value?.imagePath || fallback.imagePath || '').trim() || undefined,
    hp: asPositiveInt(value?.hp, fallback.hp),
    attack: asPositiveInt(value?.attack, fallback.attack),
    speed: asPositiveNumber(value?.speed, fallback.speed),
    spawnDelaySeconds: asNonNegativeInt(value?.spawnDelaySeconds, fallback.spawnDelaySeconds),
  }
}

function normalizeEnabledDirections(value: unknown, fallback: ClassDefenseDirectionId[]) {
  const values = Array.isArray(value) ? value : fallback
  const enabled = values
    .map((item) => String(item ?? '').trim())
    .filter((item): item is ClassDefenseDirectionId =>
      CLASS_DEFENSE_DIRECTION_IDS.includes(item as ClassDefenseDirectionId)
    )

  return Array.from(new Set(enabled)).length > 0
    ? Array.from(new Set(enabled))
    : fallback
}

export function normalizeClassDefenseConfig(input?: unknown): ClassDefenseConfig {
  const raw = input && typeof input === 'object' ? input as Partial<ClassDefenseConfig> : {}
  const fallback = DEFAULT_CLASS_DEFENSE_CONFIG
  const rawWaves = Array.isArray(raw.waves) && raw.waves.length > 0 ? raw.waves : fallback.waves

  return {
    maxClassHp: asPositiveInt(raw.maxClassHp, fallback.maxClassHp),
    reviveSeconds: asPositiveInt(raw.reviveSeconds, fallback.reviveSeconds),
    combatSeconds: 30,
    nextWaveDelaySeconds: Math.min(
      5,
      Math.max(3, asPositiveInt(raw.nextWaveDelaySeconds, fallback.nextWaveDelaySeconds))
    ),
    killPointReward: asPositiveNumber(
      raw.killPointReward ?? (raw as { questionPointReward?: unknown }).questionPointReward,
      fallback.killPointReward
    ),
    tickMs: Math.max(250, asPositiveInt(raw.tickMs, fallback.tickMs)),
    enabledDirections: normalizeEnabledDirections(raw.enabledDirections, fallback.enabledDirections),
    waves: rawWaves.map((wave, index) => {
      const fallbackWave = fallback.waves[index] || fallback.waves[fallback.waves.length - 1]
      const monsters = Array.isArray(wave?.monsters) && wave.monsters.length > 0
        ? wave.monsters
        : fallbackWave.monsters

      return {
        waveIndex: asNonNegativeInt(wave?.waveIndex, index),
        startDelaySeconds: index === 0
          ? asNonNegativeInt(wave?.startDelaySeconds, fallbackWave.startDelaySeconds)
          : 1,
        monsters: monsters.map((monster, monsterIndex) =>
          normalizeMonsterConfig(monster, fallbackWave.monsters[monsterIndex] || fallbackWave.monsters[0])
        ),
      }
    }),
  }
}

export function parseClassDefenseConfig(configJson: string | null | undefined) {
  if (!configJson) {
    return DEFAULT_CLASS_DEFENSE_CONFIG
  }

  try {
    return normalizeClassDefenseConfig(JSON.parse(configJson))
  } catch {
    return DEFAULT_CLASS_DEFENSE_CONFIG
  }
}
