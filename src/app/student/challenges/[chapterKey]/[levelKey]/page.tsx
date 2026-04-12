import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStudent } from '@/lib/auth'
import { getStudentChallengeLevelView } from '@/lib/challenges/service'
import ChallengeLevelClient from './ChallengeLevelClient'

interface Props {
  params: Promise<{ chapterKey: string; levelKey: string }>
}

export default async function StudentChallengeLevelPage({ params }: Props) {
  const student = await requireStudent()
  const { chapterKey, levelKey } = await params
  const data = await getStudentChallengeLevelView(student.id, chapterKey, levelKey)

  if (!data) {
    notFound()
  }

  if (!data.level.isAccessible) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">当前关卡尚未解锁</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            请先完成前序关卡，或等待教师提前开放本关。
          </p>
          <Link
            href={`/student/challenges/${chapterKey}`}
            className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700"
          >
            返回章节
          </Link>
        </div>
      </div>
    )
  }

  return (
    <ChallengeLevelClient
      chapterKey={data.chapter.key}
      chapterTitle={data.chapter.title}
      level={{
        ...data.level,
        latestSubmittedAt: data.level.latestSubmittedAt
          ? data.level.latestSubmittedAt.toISOString()
          : null,
      }}
      previousLevel={
        data.previousLevel
          ? {
              key: data.previousLevel.key,
              title: data.previousLevel.title,
            }
          : null
      }
      nextLevel={
        data.nextLevel
          ? {
              key: data.nextLevel.key,
              title: data.nextLevel.title,
            }
          : null
      }
    />
  )
}
