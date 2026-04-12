export const PET_EQUIPMENT_SLOT_COUNT = 4
export const PET_SKILL_SLOT_COUNT = 4
export const PET_INVENTORY_SLOT_COUNT = 16
export const PET_EXP_PER_POINT = 10
export const PET_MAX_LEVEL = 50

interface PetStatProfile {
  maxHp: number
  attack: number
  defense: number
  critRate: number
  dodgeRate: number
}

export interface PetSpeciesDefinition {
  key: string
  name: string
  title: string
  description: string
  imagePath: string
  baseStats: PetStatProfile
  growthStats: PetStatProfile
}

const petSpeciesList: PetSpeciesDefinition[] = [
  {
    key: 'alpaca',
    name: '羊驼',
    title: '沙丘旅伴',
    description: '血量均衡，成长稳定，适合作为第一只陪伴宠物。',
    imagePath: '/pets/alpaca.png',
    baseStats: { maxHp: 132, attack: 20, defense: 13, critRate: 5, dodgeRate: 5 },
    growthStats: { maxHp: 20, attack: 4, defense: 3, critRate: 0.4, dodgeRate: 0.4 },
  },
  {
    key: 'bear',
    name: '棕熊',
    title: '森林壁垒',
    description: '高血量高防御，升级后会越来越耐打。',
    imagePath: '/pets/bear.png',
    baseStats: { maxHp: 156, attack: 18, defense: 18, critRate: 3, dodgeRate: 2 },
    growthStats: { maxHp: 26, attack: 3, defense: 4, critRate: 0.2, dodgeRate: 0.2 },
  },
  {
    key: 'dog',
    name: '小狗',
    title: '课堂搭子',
    description: '属性全面，没有明显短板，适合稳步培养。',
    imagePath: '/pets/dog.png',
    baseStats: { maxHp: 138, attack: 22, defense: 14, critRate: 5, dodgeRate: 4 },
    growthStats: { maxHp: 21, attack: 4, defense: 3, critRate: 0.4, dodgeRate: 0.3 },
  },
  {
    key: 'fox',
    name: '狐狸',
    title: '机敏猎手',
    description: '暴击和闪避更高，适合追求爆发的路线。',
    imagePath: '/pets/fox.png',
    baseStats: { maxHp: 122, attack: 24, defense: 11, critRate: 8, dodgeRate: 8 },
    growthStats: { maxHp: 18, attack: 5, defense: 2, critRate: 0.7, dodgeRate: 0.6 },
  },
  {
    key: 'gorilla',
    name: '大猩猩',
    title: '重拳学霸',
    description: '攻击和血量都很突出，成长后压制力很强。',
    imagePath: '/pets/gorilla.png',
    baseStats: { maxHp: 148, attack: 25, defense: 15, critRate: 4, dodgeRate: 2 },
    growthStats: { maxHp: 24, attack: 5, defense: 3, critRate: 0.3, dodgeRate: 0.2 },
  },
  {
    key: 'horse',
    name: '骏马',
    title: '疾风信使',
    description: '速度感强，攻击稳定，闪避表现优秀。',
    imagePath: '/pets/horse.png',
    baseStats: { maxHp: 134, attack: 23, defense: 12, critRate: 5, dodgeRate: 7 },
    growthStats: { maxHp: 20, attack: 4, defense: 2, critRate: 0.4, dodgeRate: 0.5 },
  },
  {
    key: 'lion',
    name: '狮子',
    title: '荣耀队长',
    description: '输出能力最强之一，适合做前排主力宠物。',
    imagePath: '/pets/lion.png',
    baseStats: { maxHp: 142, attack: 26, defense: 13, critRate: 7, dodgeRate: 3 },
    growthStats: { maxHp: 22, attack: 5, defense: 2, critRate: 0.6, dodgeRate: 0.2 },
  },
  {
    key: 'panda',
    name: '熊猫',
    title: '治愈守卫',
    description: '防御和生命偏高，适合做耐久型培养。',
    imagePath: '/pets/panda.png',
    baseStats: { maxHp: 150, attack: 19, defense: 17, critRate: 4, dodgeRate: 3 },
    growthStats: { maxHp: 25, attack: 3, defense: 4, critRate: 0.3, dodgeRate: 0.3 },
  },
  {
    key: 'peacock',
    name: '孔雀',
    title: '华彩术师',
    description: '暴击成长出色，适合未来走技能爆发路线。',
    imagePath: '/pets/peacock.png',
    baseStats: { maxHp: 126, attack: 22, defense: 11, critRate: 9, dodgeRate: 6 },
    growthStats: { maxHp: 17, attack: 4, defense: 2, critRate: 0.8, dodgeRate: 0.4 },
  },
  {
    key: 'rabbit',
    name: '兔子',
    title: '轻跃刺客',
    description: '闪避率最高，适合走高机动路线。',
    imagePath: '/pets/rabbit.png',
    baseStats: { maxHp: 118, attack: 21, defense: 10, critRate: 6, dodgeRate: 10 },
    growthStats: { maxHp: 16, attack: 4, defense: 2, critRate: 0.5, dodgeRate: 0.8 },
  },
  {
    key: 'reindeer',
    name: '驯鹿',
    title: '星夜巡游者',
    description: '属性均衡偏耐久，后期成长很平滑。',
    imagePath: '/pets/reindeer.png',
    baseStats: { maxHp: 140, attack: 21, defense: 14, critRate: 5, dodgeRate: 5 },
    growthStats: { maxHp: 22, attack: 4, defense: 3, critRate: 0.4, dodgeRate: 0.4 },
  },
  {
    key: 'seagull',
    name: '海鸥',
    title: '云岸侦察兵',
    description: '灵活、轻盈，闪避成长高，未来适合打先手。',
    imagePath: '/pets/seagull.png',
    baseStats: { maxHp: 120, attack: 20, defense: 10, critRate: 6, dodgeRate: 9 },
    growthStats: { maxHp: 17, attack: 4, defense: 2, critRate: 0.5, dodgeRate: 0.7 },
  },
]

const petSpeciesMap = new Map(petSpeciesList.map((pet) => [pet.key, pet] as const))

export function listPetSpecies() {
  return petSpeciesList
}

export function getPetSpecies(speciesKey: string) {
  return petSpeciesMap.get(speciesKey) || null
}
