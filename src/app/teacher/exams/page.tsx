import { requireTeacher } from '@/lib/auth'
import { getTeacherExamDashboard } from '@/lib/exams'
import ExamManager from './ExamManager'

export default async function TeacherExamsPage() {
  const teacher = await requireTeacher()
  const data = await getTeacherExamDashboard(teacher.id)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">期末考试</h1>
        <p className="mt-2 text-sm text-slate-500">
          统一管理客观题和程序题考试，程序题复用代码闯关题目。
        </p>
      </div>
      <ExamManager initialData={JSON.parse(JSON.stringify(data))} />
    </div>
  )
}
