export interface ClassDefenseMonsterTypeSeed {
  name: string
  baseHp: number
  baseAttack: number
  baseSpeed: number
  imagePath: string
}

export interface ClassDefenseMonsterStats {
  hp: number
  attack: number
  speed: number
}

export const CLASS_DEFENSE_MONSTER_IMAGE_OPTIONS = [
  { label: '蝙蝠', path: '/monsters/bat.png' },
  { label: '火焰小魔', path: '/monsters/fire_imp.png' },
  { label: '哥布林', path: '/monsters/goblin.png' },
  { label: '冰灵', path: '/monsters/ice_wisp.png' },
  { label: '蘑菇怪', path: '/monsters/mushroom.png' },
  { label: '兽人', path: '/monsters/orc.png' },
  { label: '暗影怪', path: '/monsters/shadow.png' },
  { label: '史莱姆', path: '/monsters/slime.png' },
  { label: '石像魔', path: '/monsters/stone_golem.png' },
]

export const DEFAULT_CLASS_DEFENSE_MONSTER_TYPES: ClassDefenseMonsterTypeSeed[] = [
  {
    name: '史莱姆',
    baseHp: 30,
    baseAttack: 10,
    baseSpeed: 0.012,
    imagePath: '/monsters/slime.png',
  },
  {
    name: '哥布林',
    baseHp: 45,
    baseAttack: 12,
    baseSpeed: 0.01,
    imagePath: '/monsters/goblin.png',
  },
  {
    name: '兽人',
    baseHp: 80,
    baseAttack: 18,
    baseSpeed: 0.008,
    imagePath: '/monsters/orc.png',
  },
  {
    name: '蝙蝠',
    baseHp: 28,
    baseAttack: 9,
    baseSpeed: 0.016,
    imagePath: '/monsters/bat.png',
  },
  {
    name: '火焰小魔',
    baseHp: 55,
    baseAttack: 16,
    baseSpeed: 0.011,
    imagePath: '/monsters/fire_imp.png',
  },
  {
    name: '冰灵',
    baseHp: 42,
    baseAttack: 13,
    baseSpeed: 0.013,
    imagePath: '/monsters/ice_wisp.png',
  },
  {
    name: '蘑菇怪',
    baseHp: 60,
    baseAttack: 11,
    baseSpeed: 0.009,
    imagePath: '/monsters/mushroom.png',
  },
  {
    name: '暗影怪',
    baseHp: 50,
    baseAttack: 17,
    baseSpeed: 0.014,
    imagePath: '/monsters/shadow.png',
  },
  {
    name: '石像魔',
    baseHp: 110,
    baseAttack: 20,
    baseSpeed: 0.006,
    imagePath: '/monsters/stone_golem.png',
  },
]

export function calculateClassDefenseMonsterStats(
  monster: {
    baseHp: number
    baseAttack: number
    baseSpeed: number
  },
  level: number
): ClassDefenseMonsterStats {
  const safeLevel = Math.max(1, Math.floor(level))
  const multiplier = 1 + (safeLevel - 1) * 0.2

  return {
    hp: Math.max(1, Math.round(monster.baseHp * multiplier)),
    attack: Math.max(1, Math.round(monster.baseAttack * multiplier)),
    speed: Math.max(0.001, monster.baseSpeed),
  }
}
