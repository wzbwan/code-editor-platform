import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  return NextResponse.json({
    runnerUrl:
      process.env.LOCAL_RUNNER_URL?.trim() || 'http://127.0.0.1:18423',
    sharedToken:
      process.env.LOCAL_RUNNER_SHARED_TOKEN?.trim() ||
      process.env.MOBILE_API_TOKEN?.trim() ||
      '',
    timeoutSeconds: Number(process.env.LOCAL_RUNNER_TIMEOUT_SECONDS || '300'),
  })
}
