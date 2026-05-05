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
  killPointReward: number
  tickMs: number
  waves: ClassDefenseWaveConfig[]
}

const DEFAULT_WAVES: ClassDefenseWaveConfig[] = [
  {
    waveIndex: 0,
    startDelaySeconds: 1,
    monsters: [
      {
        monsterKey: 'slime',
        monsterName: '史莱姆',
        monsterLevel: 1,
        imagePath: '/pets/rabbit.png',
        hp: 30,
        attack: 10,
        speed: 0.012,
        spawnDelaySeconds: 0,
      },
      {
        monsterKey: 'slime',
        monsterName: '史莱姆',
        monsterLevel: 1,
        imagePath: '/pets/rabbit.png',
        hp: 30,
        attack: 10,
        speed: 0.012,
        spawnDelaySeconds: 4,
      },
      {
        monsterKey: 'goblin',
        monsterName: '哥布林',
        monsterLevel: 1,
        imagePath: '/pets/fox.png',
        hp: 45,
        attack: 12,
        speed: 0.01,
        spawnDelaySeconds: 8,
      },
    ],
  },
  {
    waveIndex: 1,
    startDelaySeconds: 25,
    monsters: [
      {
        monsterKey: 'goblin',
        monsterName: '哥布林',
        monsterLevel: 2,
        imagePath: '/pets/fox.png',
        hp: 54,
        attack: 14,
        speed: 0.01,
        spawnDelaySeconds: 0,
      },
      {
        monsterKey: 'goblin',
        monsterName: '哥布林',
        monsterLevel: 2,
        imagePath: '/pets/fox.png',
        hp: 54,
        attack: 14,
        speed: 0.01,
        spawnDelaySeconds: 5,
      },
      {
        monsterKey: 'orc',
        monsterName: '兽人',
        monsterLevel: 1,
        imagePath: '/pets/gorilla.png',
        hp: 80,
        attack: 18,
        speed: 0.008,
        spawnDelaySeconds: 10,
      },
    ],
  },
]

export const DEFAULT_CLASS_DEFENSE_CONFIG: ClassDefenseConfig = {
  maxClassHp: 10,
  reviveSeconds: 30,
  combatSeconds: 45,
  killPointReward: 1,
  tickMs: 1000,
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

export function normalizeClassDefenseConfig(input?: unknown): ClassDefenseConfig {
  const raw = input && typeof input === 'object' ? input as Partial<ClassDefenseConfig> : {}
  const fallback = DEFAULT_CLASS_DEFENSE_CONFIG
  const rawWaves = Array.isArray(raw.waves) && raw.waves.length > 0 ? raw.waves : fallback.waves

  return {
    maxClassHp: asPositiveInt(raw.maxClassHp, fallback.maxClassHp),
    reviveSeconds: asPositiveInt(raw.reviveSeconds, fallback.reviveSeconds),
    combatSeconds: asPositiveInt(raw.combatSeconds, fallback.combatSeconds),
    killPointReward: asPositiveNumber(
      raw.killPointReward ?? (raw as { questionPointReward?: unknown }).questionPointReward,
      fallback.killPointReward
    ),
    tickMs: Math.max(250, asPositiveInt(raw.tickMs, fallback.tickMs)),
    waves: rawWaves.map((wave, index) => {
      const fallbackWave = fallback.waves[index] || fallback.waves[fallback.waves.length - 1]
      const monsters = Array.isArray(wave?.monsters) && wave.monsters.length > 0
        ? wave.monsters
        : fallbackWave.monsters

      return {
        waveIndex: asNonNegativeInt(wave?.waveIndex, index),
        startDelaySeconds: asNonNegativeInt(wave?.startDelaySeconds, fallbackWave.startDelaySeconds),
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
