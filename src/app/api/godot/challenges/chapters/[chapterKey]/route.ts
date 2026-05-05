import { NextResponse } from 'next/server'
import { getStudentChallengeChapterView } from '@/lib/challenges/service'
import { verifyGodotChallengeBearerRequest } from '@/lib/godot-challenges/auth'

export const runtime = 'nodejs'

interface Props {
  params: Promise<{ chapterKey: string }>
}

export async function GET(request: Request, { params }: Props) {
  const student = await verifyGodotChallengeBearerRequest(request)
  if (!student) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { chapterKey } = await params

  try {
    const data = await getStudentChallengeChapterView(student.id, chapterKey)
    if (!data) {
      return NextResponse.json({ error: '章节不存在' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取章节失败' },
      { status: 400 }
    )
  }
}
