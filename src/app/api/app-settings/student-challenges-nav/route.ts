import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { APP_SETTING_KEYS, getBooleanAppSetting, setBooleanAppSetting } from '@/lib/app-settings'
import { authOptions } from '@/lib/auth-options'

export const dynamic = 'force-dynamic'

export async function GET() {
  const visible = await getBooleanAppSetting(APP_SETTING_KEYS.studentChallengesNavVisible, true)

  return NextResponse.json(
    { visible },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body: unknown = await request.json()
  const visible =
    body && typeof body === 'object' ? (body as { visible?: unknown }).visible : undefined

  if (typeof visible !== 'boolean') {
    return NextResponse.json({ error: '参数错误' }, { status: 400 })
  }

  const nextVisible = await setBooleanAppSetting(
    APP_SETTING_KEYS.studentChallengesNavVisible,
    visible
  )

  return NextResponse.json({ visible: nextVisible })
}
