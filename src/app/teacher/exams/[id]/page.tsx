import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth'
import { getTeacherExamDetail } from '@/lib/exams'
import ExamTeacherBoard from './ExamTeacherBoard'

interface Props {
  params: {
    id: string
  }
}

export default async function TeacherExamDetailPage({ params }: Props) {
  const teacher = await requireTeacher()
  const data = await getTeacherExamDetail(teacher.id, params.id)

  if (!data) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <ExamTeacherBoard examId={params.id} initialData={JSON.parse(JSON.stringify(data))} />
    </div>
  )
}
