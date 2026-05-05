import { NextResponse } from 'next/server'
import { verifyGodotChallengeBearerRequest } from '@/lib/godot-challenges/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const student = await verifyGodotChallengeBearerRequest(request)
  if (!student) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  return NextResponse.json({ user: student })
}
