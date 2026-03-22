import { requireTeacher } from '@/lib/auth'
import { getTeacherQuizDashboard } from '@/lib/practice'
import QuizManager from './QuizManager'

export default async function TeacherQuestionsPage() {
  const teacher = await requireTeacher()
  const dashboard = await getTeacherQuizDashboard(teacher.id)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">试题管理</h1>
      <QuizManager
        questions={JSON.parse(JSON.stringify(dashboard.questions))}
        papers={JSON.parse(JSON.stringify(dashboard.papers))}
        sessions={JSON.parse(JSON.stringify(dashboard.sessions))}
        classOptions={JSON.parse(JSON.stringify(dashboard.classOptions))}
      />
    </div>
  )
}
