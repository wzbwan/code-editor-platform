import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { roundToOneDecimal } from '@/lib/point-format'
import {
  getPetSpecies,
  listPetSpecies,
  PET_EQUIPMENT_SLOT_COUNT,
  PET_EXP_PER_POINT,
  PET_INVENTORY_SLOT_COUNT,
  PET_MAX_LEVEL,
  PET_SKILL_SLOT_COUNT,
} from '@/lib/pets/registry'

const PET_EXP_SOURCE = {
  POINT: 'POINT',
  BOOTSTRAP: 'POINT_BOOTSTRAP',
} as const

function normalizeClassName(value?: string | null) {
  return value?.trim() || ''
}

function clampRate(value: number) {
  return Math.min(60, Math.max(0, roundToOneDecimal(value)))
}

export function getPetNextLevelExp(level: number) {
  const normalizedLevel = Math.max(1, Math.floor(level))
  return 100 + (normalizedLevel - 1) * 30 + (normalizedLevel - 1) * (normalizedLevel - 1) * 5
}

export function convertPointDeltaToPetExp(pointDelta: number) {
  const normalized = roundToOneDecimal(pointDelta)
  if (normalized <= 0) {
    return 0
  }

  return Math.max(1, Math.round(normalized * PET_EXP_PER_POINT))
}

export function calculatePetStats(speciesKey: string, level: number) {
  const species = getPetSpecies(speciesKey)
  if (!species) {
    throw new Error('宠物类型不存在')
  }

  const normalizedLevel = Math.max(1, Math.floor(level))
  const levelOffset = normalizedLevel - 1

  return {
    maxHp: Math.round(species.baseStats.maxHp + species.growthStats.maxHp * levelOffset),
    attack: Math.round(species.baseStats.attack + species.growthStats.attack * levelOffset),
    defense: Math.round(species.baseStats.defense + species.growthStats.defense * levelOffset),
    critRate: clampRate(species.baseStats.critRate + species.growthStats.critRate * levelOffset),
    dodgeRate: clampRate(species.baseStats.dodgeRate + species.growthStats.dodgeRate * levelOffset),
  }
}

export function calculatePetBattlePower(input: {
  maxHp: number
  attack: number
  defense: number
  critRate: number
  dodgeRate: number
}) {
  return Math.round(
    input.maxHp * 0.12 +
      input.attack * 2.2 +
      input.defense * 1.8 +
      input.critRate * 3 +
      input.dodgeRate * 3
  )
}

function normalizeIndexedSlots<T extends { slotIndex: number }>(
  count: number,
  slots: T[],
  fallback: (slotIndex: number) => Omit<T, 'slotIndex'> & Record<string, unknown>
) {
  return Array.from({ length: count }, (_, slotIndex) => {
    const current = slots.find((slot) => slot.slotIndex === slotIndex)
    if (current) {
      return current
    }

    return {
      slotIndex,
      ...fallback(slotIndex),
    } as T
  })
}

function applyExpProgress(input: {
  speciesKey: string
  level: number
  exp: number
  currentHp: number
  expDelta: number
}) {
  let nextLevel = input.level
  let nextExp = input.exp
  let remainingExp = input.expDelta
  let leveledUp = false

  while (remainingExp > 0 && nextLevel < PET_MAX_LEVEL) {
    const need = getPetNextLevelExp(nextLevel) - nextExp
    if (remainingExp >= need) {
      remainingExp -= need
      nextLevel += 1
      nextExp = 0
      leveledUp = true
      continue
    }

    nextExp += remainingExp
    remainingExp = 0
  }

  if (nextLevel >= PET_MAX_LEVEL) {
    nextLevel = PET_MAX_LEVEL
    nextExp = 0
  }

  const nextStats = calculatePetStats(input.speciesKey, nextLevel)

  return {
    level: nextLevel,
    exp: nextExp,
    currentHp: leveledUp ? nextStats.maxHp : Math.min(input.currentHp, nextStats.maxHp),
    leveledUp,
    nextStats,
  }
}

function buildPetView(
  pet: {
    id: string
    speciesKey: string
    nickname: string | null
    level: number
    exp: number
    currentHp: number
    equipmentSlots: Array<{
      slotIndex: number
      equipmentKey: string | null
      equipmentName: string | null
    }>
    skillSlots: Array<{
      slotIndex: number
      skillKey: string | null
      skillName: string | null
    }>
    inventorySlots: Array<{
      slotIndex: number
      itemKey: string | null
      itemName: string | null
      quantity: number
    }>
    expRecords: Array<{
      id: string
      expDelta: number
      pointDelta: number | null
      reason: string
      source: string
      levelBefore: number
      levelAfter: number
      occurredAt: Date
    }>
  }
) {
  const species = getPetSpecies(pet.speciesKey)
  if (!species) {
    throw new Error('宠物类型不存在')
  }

  const stats = calculatePetStats(pet.speciesKey, pet.level)
  const nextLevelExp = pet.level >= PET_MAX_LEVEL ? 0 : getPetNextLevelExp(pet.level)

  return {
    id: pet.id,
    speciesKey: pet.speciesKey,
    name: species.name,
    title: species.title,
    description: species.description,
    imagePath: species.imagePath,
    nickname: pet.nickname,
    level: pet.level,
    exp: pet.exp,
    nextLevelExp,
    currentHp: Math.min(pet.currentHp, stats.maxHp),
    stats,
    equipmentSlots: normalizeIndexedSlots(PET_EQUIPMENT_SLOT_COUNT, pet.equipmentSlots, () => ({
      equipmentKey: null,
      equipmentName: null,
    })),
    skillSlots: normalizeIndexedSlots(PET_SKILL_SLOT_COUNT, pet.skillSlots, () => ({
      skillKey: null,
      skillName: null,
    })),
    inventorySlots: normalizeIndexedSlots(PET_INVENTORY_SLOT_COUNT, pet.inventorySlots, () => ({
      itemKey: null,
      itemName: null,
      quantity: 0,
    })),
    expRecords: pet.expRecords.map((record) => ({
      ...record,
      occurredAt: record.occurredAt.toISOString(),
    })),
  }
}

export async function getStudentPetProfile(studentId: string) {
  const pet = await prisma.studentPet.findUnique({
    where: { studentId },
    select: {
      id: true,
      speciesKey: true,
      nickname: true,
      level: true,
      exp: true,
      currentHp: true,
      equipmentSlots: {
        select: {
          slotIndex: true,
          equipmentKey: true,
          equipmentName: true,
        },
        orderBy: { slotIndex: 'asc' },
      },
      skillSlots: {
        select: {
          slotIndex: true,
          skillKey: true,
          skillName: true,
        },
        orderBy: { slotIndex: 'asc' },
      },
      inventorySlots: {
        select: {
          slotIndex: true,
          itemKey: true,
          itemName: true,
          quantity: true,
        },
        orderBy: { slotIndex: 'asc' },
      },
      expRecords: {
        select: {
          id: true,
          expDelta: true,
          pointDelta: true,
          reason: true,
          source: true,
          levelBefore: true,
          levelAfter: true,
          occurredAt: true,
        },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      },
    },
  })

  return {
    pet: pet ? buildPetView(pet) : null,
    availablePets: listPetSpecies(),
  }
}

export async function getClassPetBoard(studentId: string) {
  const currentStudent = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      className: true,
    },
  })

  if (!currentStudent) {
    throw new Error('学生不存在')
  }

  const className = normalizeClassName(currentStudent.className)
  return getClassPetBoardByClassName(className, {
    currentStudentId: currentStudent.id,
    currentStudentName: currentStudent.name,
  })
}

export async function listPetClassOptions() {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { className: true },
    orderBy: { className: 'asc' },
  })

  return Array.from(
    new Set(
      students
        .map((student) => normalizeClassName(student.className))
        .filter(Boolean)
    )
  )
}

export async function getClassPetBoardByClassName(
  className: string,
  viewer?: {
    currentStudentId?: string | null
    currentStudentName?: string | null
  }
) {
  const normalizedClassName = normalizeClassName(className)
  if (!normalizedClassName) {
    return {
      currentStudentId: viewer?.currentStudentId || '',
      currentStudentName: viewer?.currentStudentName || '',
      className: normalizedClassName,
      students: [],
      summary: {
        totalStudents: 0,
        withPets: 0,
        withoutPets: 0,
        classWeeklyExp: 0,
      },
    }
  }

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const classmates = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      className: normalizedClassName,
    },
    orderBy: [{ name: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      name: true,
      pet: {
        select: {
          id: true,
          speciesKey: true,
          nickname: true,
          level: true,
          exp: true,
          currentHp: true,
          equipmentSlots: {
            select: {
              slotIndex: true,
              equipmentKey: true,
              equipmentName: true,
            },
            orderBy: { slotIndex: 'asc' },
          },
          skillSlots: {
            select: {
              slotIndex: true,
              skillKey: true,
              skillName: true,
            },
            orderBy: { slotIndex: 'asc' },
          },
          inventorySlots: {
            select: {
              slotIndex: true,
              itemKey: true,
              itemName: true,
              quantity: true,
            },
            orderBy: { slotIndex: 'asc' },
          },
          expRecords: {
            select: {
              id: true,
              expDelta: true,
              pointDelta: true,
              reason: true,
              source: true,
              levelBefore: true,
              levelAfter: true,
              occurredAt: true,
            },
            where: {
              occurredAt: {
                gte: weekAgo,
              },
            },
            orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
            take: 8,
          },
        },
      },
    },
  })

  const students = classmates.map((classmate) => {
    if (!classmate.pet) {
      return {
        studentId: classmate.id,
        studentName: classmate.name,
        isCurrentStudent: classmate.id === viewer?.currentStudentId,
        hasPet: false,
        pet: null,
      }
    }

    const pet = buildPetView(classmate.pet)
    const weeklyExp = classmate.pet.expRecords.reduce((sum, record) => sum + record.expDelta, 0)
    const weeklyLevelUps = classmate.pet.expRecords.filter(
      (record) => record.levelAfter > record.levelBefore
    ).length
    const battlePower = calculatePetBattlePower(pet.stats)
    const latestGrowthAt = classmate.pet.expRecords[0]?.occurredAt.toISOString() || null

    return {
      studentId: classmate.id,
      studentName: classmate.name,
      isCurrentStudent: classmate.id === viewer?.currentStudentId,
      hasPet: true,
      pet: {
        ...pet,
        battlePower,
        weeklyExp,
        weeklyLevelUps,
        latestGrowthAt,
        badges: [] as string[],
      },
    }
  })

  const activePetStudents = students.filter(
    (student): student is (typeof students)[number] & { hasPet: true; pet: NonNullable<(typeof students)[number]['pet']> } =>
      student.hasPet && Boolean(student.pet)
  )

  const maxLevel = Math.max(0, ...activePetStudents.map((student) => student.pet.level))
  const maxBattlePower = Math.max(0, ...activePetStudents.map((student) => student.pet.battlePower))
  const maxWeeklyExp = Math.max(0, ...activePetStudents.map((student) => student.pet.weeklyExp))

  for (const student of activePetStudents) {
    if (student.pet.level === maxLevel && maxLevel > 0) {
      student.pet.badges.push('班级最高等级')
    }
    if (student.pet.battlePower === maxBattlePower && maxBattlePower > 0) {
      student.pet.badges.push('班级最高战力')
    }
    if (student.pet.weeklyExp === maxWeeklyExp && maxWeeklyExp > 0) {
      student.pet.badges.push('本周成长最快')
    }
  }

  return {
    currentStudentId: viewer?.currentStudentId || '',
    currentStudentName: viewer?.currentStudentName || '',
    className: normalizedClassName,
    students,
    summary: {
      totalStudents: students.length,
      withPets: activePetStudents.length,
      withoutPets: students.length - activePetStudents.length,
      classWeeklyExp: activePetStudents.reduce((sum, student) => sum + student.pet.weeklyExp, 0),
    },
  }
}

export async function createStudentPet(studentId: string, speciesKey: string) {
  return prisma.$transaction(async (tx) => createStudentPetWithTx(tx, studentId, speciesKey))
}

export async function createStudentPetWithTx(
  tx: Prisma.TransactionClient,
  studentId: string,
  speciesKey: string
) {
  const species = getPetSpecies(speciesKey)
  if (!species) {
    throw new Error('宠物不存在')
  }

  const existingPet = await tx.studentPet.findUnique({
    where: { studentId },
    select: { id: true },
  })

  if (existingPet) {
    throw new Error('你已经拥有宠物了')
  }

  const baseStats = calculatePetStats(speciesKey, 1)

  const pet = await tx.studentPet.create({
    data: {
      studentId,
      speciesKey,
      currentHp: baseStats.maxHp,
    },
    select: {
      id: true,
      speciesKey: true,
      nickname: true,
      level: true,
      exp: true,
      currentHp: true,
    },
  })

  await tx.studentPetEquipmentSlot.createMany({
    data: Array.from({ length: PET_EQUIPMENT_SLOT_COUNT }, (_, slotIndex) => ({
      petId: pet.id,
      slotIndex,
    })),
  })

  await tx.studentPetSkillSlot.createMany({
    data: Array.from({ length: PET_SKILL_SLOT_COUNT }, (_, slotIndex) => ({
      petId: pet.id,
      slotIndex,
    })),
  })

  await tx.studentPetInventorySlot.createMany({
    data: Array.from({ length: PET_INVENTORY_SLOT_COUNT }, (_, slotIndex) => ({
      petId: pet.id,
      slotIndex,
    })),
  })

  return tx.studentPet.findUnique({
    where: { studentId },
    select: {
      id: true,
      speciesKey: true,
      nickname: true,
      level: true,
      exp: true,
      currentHp: true,
      equipmentSlots: {
        select: {
          slotIndex: true,
          equipmentKey: true,
          equipmentName: true,
        },
        orderBy: { slotIndex: 'asc' },
      },
      skillSlots: {
        select: {
          slotIndex: true,
          skillKey: true,
          skillName: true,
        },
        orderBy: { slotIndex: 'asc' },
      },
      inventorySlots: {
        select: {
          slotIndex: true,
          itemKey: true,
          itemName: true,
          quantity: true,
        },
        orderBy: { slotIndex: 'asc' },
      },
      expRecords: {
        select: {
          id: true,
          expDelta: true,
          pointDelta: true,
          reason: true,
          source: true,
          levelBefore: true,
          levelAfter: true,
          occurredAt: true,
        },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      },
    },
  })
}

export async function awardPetExpWithTx(
  tx: Prisma.TransactionClient,
  input: {
    studentId: string
    expDelta: number
    pointDelta?: number | null
    reason: string
    source?: string
    occurredAt?: Date
  }
) {
  const expDelta = Math.max(0, Math.round(input.expDelta))
  if (expDelta <= 0) {
    return null
  }

  const pet = await tx.studentPet.findUnique({
    where: { studentId: input.studentId },
    select: {
      id: true,
      speciesKey: true,
      level: true,
      exp: true,
      currentHp: true,
    },
  })

  if (!pet) {
    return null
  }

  const nextState = applyExpProgress({
    speciesKey: pet.speciesKey,
    level: pet.level,
    exp: pet.exp,
    currentHp: pet.currentHp,
    expDelta,
  })

  const updatedPet = await tx.studentPet.update({
    where: { id: pet.id },
    data: {
      level: nextState.level,
      exp: nextState.exp,
      currentHp: nextState.currentHp,
    },
    select: {
      id: true,
      speciesKey: true,
      level: true,
      exp: true,
      currentHp: true,
    },
  })

  await tx.studentPetExpRecord.create({
    data: {
      petId: pet.id,
      expDelta,
      pointDelta: input.pointDelta ?? null,
      reason: input.reason.trim() || '宠物获得经验',
      source: input.source || PET_EXP_SOURCE.POINT,
      levelBefore: pet.level,
      levelAfter: updatedPet.level,
      expBefore: pet.exp,
      expAfter: updatedPet.exp,
      occurredAt: input.occurredAt || new Date(),
    },
  })

  return updatedPet
}
