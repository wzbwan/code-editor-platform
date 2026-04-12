import Link from 'next/link'
import { requireStudent } from '@/lib/auth'
import { getStudentChallengeHome } from '@/lib/challenges/service'

export default async function StudentChallengesPage() {
  const student = await requireStudent()
  const data = await getStudentChallengeHome(student.id)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">代码闯关</h1>
          <p className="mt-2 text-sm text-slate-600">
            当前班级：{data.className || '未分班'}。教师开放章节后，你可以逐关挑战并获得积分。
          </p>
        </div>
        <Link href="/student" className="text-sm text-blue-600 hover:underline">
          返回学生首页
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {data.chapters.map((chapter) => (
          <div key={chapter.key} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                  {chapter.theme}
                </div>
                <h2 className="mt-3 text-xl font-semibold text-slate-900">{chapter.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{chapter.description}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  chapter.isUnlocked
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {chapter.isUnlocked ? '已开放' : '未开放'}
              </span>
            </div>

            <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
              <span>
                已通关 {chapter.passedLevels} / {chapter.totalLevels}
              </span>
              <span>当前可挑战 {chapter.accessibleLevels} 关</span>
            </div>

            <div className="mt-5">
              {chapter.isUnlocked ? (
                <Link
                  href={`/student/challenges/${chapter.key}`}
                  className="inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700"
                >
                  进入章节
                </Link>
              ) : (
                <div className="text-sm text-slate-500">教师尚未开放本章</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
