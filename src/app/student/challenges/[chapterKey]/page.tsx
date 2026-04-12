import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStudent } from '@/lib/auth'
import { getStudentChallengeChapterView } from '@/lib/challenges/service'

interface Props {
  params: Promise<{ chapterKey: string }>
}

export default async function StudentChallengeChapterPage({ params }: Props) {
  const student = await requireStudent()
  const { chapterKey } = await params
  const data = await getStudentChallengeChapterView(student.id, chapterKey)

  if (!data) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <Link href="/student/challenges" className="text-sm text-blue-600 hover:underline">
            返回章节列表
          </Link>
          <div className="mt-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            {data.chapter.theme}
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">{data.chapter.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {data.chapter.description}
          </p>
        </div>
        <div className="rounded-2xl bg-white px-5 py-4 text-right shadow-sm ring-1 ring-slate-200">
          <div className="text-xs text-slate-500">章节状态</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {data.chapter.isUnlocked ? '已开放' : '未开放'}
          </div>
        </div>
      </div>

      {!data.chapter.isUnlocked ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">本章尚未开放</h2>
          <p className="mt-3 text-sm text-slate-600">请等待教师为你的班级开放本章。</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.chapter.levels.map((level, index) => (
            <div
              key={level.key}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">第 {index + 1} 关</div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{level.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{level.summary}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    level.isPassed
                      ? 'bg-emerald-100 text-emerald-700'
                      : level.isAccessible
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {level.isPassed ? '已通关' : level.isAccessible ? '可挑战' : '未解锁'}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>积分 {level.points}</span>
                <span>尝试 {level.attemptCount} 次</span>
              </div>

              <div className="mt-5">
                {level.isAccessible ? (
                  <Link
                    href={`/student/challenges/${data.chapter.key}/${level.key}`}
                    className="inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white hover:bg-slate-800"
                  >
                    {level.isPassed ? '再次查看' : '开始闯关'}
                  </Link>
                ) : (
                  <div className="text-sm text-slate-500">完成前序关卡或等待教师提前开放</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
