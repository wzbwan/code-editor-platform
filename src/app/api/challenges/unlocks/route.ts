import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { getChallengeUnlockManagerData, saveChallengeUnlocks } from '@/lib/challenges/service'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const className = searchParams.get('className')?.trim() || ''
  if (!className) {
    return NextResponse.json({ error: '缺少班级' }, { status: 400 })
  }

  const data = await getChallengeUnlockManagerData(className)
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body: unknown = await request.json()
  const payload =
    body && typeof body === 'object'
      ? (body as {
          className?: unknown
          chapterKeys?: unknown
          levelKeys?: unknown
        })
      : {}
  const className = typeof payload.className === 'string' ? payload.className.trim() : ''
  const chapterKeys = Array.isArray(payload.chapterKeys)
    ? payload.chapterKeys.filter((item: unknown): item is string => typeof item === 'string')
    : []
  const levelKeys = Array.isArray(payload.levelKeys)
    ? payload.levelKeys
        .filter(
          (item: unknown): item is { chapterKey: string; levelKey: string } =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as { chapterKey?: unknown }).chapterKey === 'string' &&
            typeof (item as { levelKey?: unknown }).levelKey === 'string'
        )
        .map((item: { chapterKey: string; levelKey: string }) => ({
          chapterKey: item.chapterKey.trim(),
          levelKey: item.levelKey.trim(),
        }))
    : []

  try {
    const data = await saveChallengeUnlocks({
      className,
      chapterKeys,
      levelKeys,
    })

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '保存失败',
      },
      { status: 400 }
    )
  }
}
