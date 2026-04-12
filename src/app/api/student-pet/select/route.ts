import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { createStudentPet, getStudentPetProfile } from '@/lib/pets/service'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const speciesKey = typeof body.speciesKey === 'string' ? body.speciesKey.trim() : ''

  if (!speciesKey) {
    return NextResponse.json({ error: '请选择宠物' }, { status: 400 })
  }

  try {
    await createStudentPet(session.user.id, speciesKey)
    const profile = await getStudentPetProfile(session.user.id)
    return NextResponse.json(profile)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '创建宠物失败',
      },
      { status: 400 }
    )
  }
}
