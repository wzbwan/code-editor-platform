import { NextRequest, NextResponse } from 'next/server'
import { calculatePetStats } from '@/lib/pets/service'
import { getPetSpecies } from '@/lib/pets/registry'
import { prisma } from '@/lib/prisma'

function normalizeQueryValue(value: string | null) {
  return value?.trim() || ''
}

function findStudentPetByStudentNo(studentNo: string) {
  return prisma.user.findFirst({
    where: {
      role: 'STUDENT',
      username: studentNo,
    },
    orderBy: [{ username: 'asc' }, { name: 'asc' }],
    select: {
      username: true,
      name: true,
      className: true,
      pet: {
        select: {
          speciesKey: true,
          nickname: true,
          level: true,
          currentHp: true,
        },
      },
    },
  })
}

function findStudentPetByName(name: string) {
  return prisma.user.findFirst({
    where: {
      role: 'STUDENT',
      name,
    },
    orderBy: [{ username: 'asc' }, { name: 'asc' }],
    select: {
      username: true,
      name: true,
      className: true,
      pet: {
        select: {
          speciesKey: true,
          nickname: true,
          level: true,
          currentHp: true,
        },
      },
    },
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const studentNo = normalizeQueryValue(searchParams.get('studentNo'))
  const name = normalizeQueryValue(searchParams.get('name'))
  const query = normalizeQueryValue(searchParams.get('query'))

  if (!studentNo && !name && !query) {
    return NextResponse.json(
      { error: '请提供 studentNo、name 或 query 参数' },
      { status: 400 }
    )
  }

  const student = studentNo
    ? await findStudentPetByStudentNo(studentNo)
    : name
      ? await findStudentPetByName(name)
      : (await findStudentPetByStudentNo(query)) ||
        (await findStudentPetByName(query))

  if (!student) {
    return NextResponse.json({ error: '未找到学生' }, { status: 404 })
  }

  if (!student.pet) {
    return NextResponse.json({ error: '该学生还没有宠物' }, { status: 404 })
  }

  const species = getPetSpecies(student.pet.speciesKey)
  if (!species) {
    return NextResponse.json({ error: '宠物类型不存在' }, { status: 500 })
  }

  const stats = calculatePetStats(student.pet.speciesKey, student.pet.level)

  return NextResponse.json(
    {
      studentName: student.name,
      studentNo: student.username,
      className: student.className,
      petName: student.pet.nickname || species.name,
      petLevel: student.pet.level,
      attack: stats.attack,
      defense: stats.defense,
      hp: Math.min(student.pet.currentHp, stats.maxHp),
      maxHp: stats.maxHp,
      critRate: stats.critRate,
      dodgeRate: stats.dodgeRate,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
