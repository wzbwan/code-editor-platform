import { NextResponse } from 'next/server'
import { getStudentChallengeHome } from '@/lib/challenges/service'
import { verifyGodotChallengeBearerRequest } from '@/lib/godot-challenges/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const student = await verifyGodotChallengeBearerRequest(request)
  if (!student) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const data = await getStudentChallengeHome(student.id)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取闯关首页失败' },
      { status: 400 }
    )
  }
}
