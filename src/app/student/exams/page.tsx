import Link from 'next/link'
import { requireStudent } from '@/lib/auth'
import { getStudentActiveExam } from '@/lib/exams'

export default async function StudentExamsPage() {
  const student = await requireStudent()
  const activeExam = await getStudentActiveExam(student.id)
  const submittedAt = activeExam?.studentSessions[0]?.submittedAt

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">期末考试</h1>
      <div className="mt-6 rounded-xl bg-white p-6 shadow">
        {activeExam ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{activeExam.title}</h2>
              <p className="mt-2 text-sm text-slate-500">
                当前有进行中的考试，请进入考试页面完成作答。
              </p>
            </div>
            {submittedAt ? (
              <button
                type="button"
                disabled
                className="rounded-lg bg-slate-200 px-4 py-2 text-slate-500"
              >
                已提交
              </button>
            ) : (
              <Link
                href={`/student/exams/${activeExam.id}`}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                进入考试
              </Link>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">
            当前没有进行中的考试。
          </div>
        )}
      </div>
    </div>
  )
}
