import { NextResponse } from 'next/server'
import { verifyGodotChallengeBearerRequest } from '@/lib/godot-challenges/auth'
import { getStudentPyPointBalance } from '@/lib/student-py-points'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const student = await verifyGodotChallengeBearerRequest(request)
  if (!student) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const data = await getStudentPyPointBalance(student.id)
    return NextResponse.json({
      pyPointBalance: data.pyPointBalance,
      user: data,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取Py点失败' },
      { status: 400 }
    )
  }
}
