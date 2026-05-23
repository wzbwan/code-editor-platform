import { requireStudent } from '@/lib/auth'
import { getStudentTrainingHome } from '@/lib/training'
import StudentTrainingList from './StudentTrainingList'

export default async function StudentTrainingPage() {
  const student = await requireStudent()
  const trainingSets = await getStudentTrainingHome(student.id)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">训练场</h1>
        <p className="mt-2 text-sm text-slate-500">
          进入老师发布的考前训练，逐题练习并即时查看反馈。
        </p>
      </div>
      <StudentTrainingList trainingSets={JSON.parse(JSON.stringify(trainingSets))} />
    </div>
  )
}
