import { requireTeacher } from '@/lib/auth'
import { getTeacherTrainingDashboard } from '@/lib/training'
import TrainingManager from './TrainingManager'

export default async function TeacherTrainingPage() {
  const teacher = await requireTeacher()
  const data = await getTeacherTrainingDashboard(teacher.id)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">训练场</h1>
        <p className="mt-2 text-sm text-slate-500">
          发布考前训练任务，学生可反复练习并即时查看反馈。
        </p>
      </div>
      <TrainingManager initialData={JSON.parse(JSON.stringify(data))} />
    </div>
  )
}
