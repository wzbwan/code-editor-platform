import { NextResponse } from 'next/server'
import { verifyClassDefenseBearerRequest } from '@/lib/class-defense/auth'
import { getActiveClassDefenseSessionForStudent } from '@/lib/class-defense/service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const student = await verifyClassDefenseBearerRequest(request)
  if (!student) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const session = await getActiveClassDefenseSessionForStudent(student)
  return NextResponse.json({
    active: Boolean(session),
    session,
  })
}
