import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth'
import { getTeacherPracticeSessionView } from '@/lib/practice'
import PracticeTeacherBoard from '../PracticeTeacherBoard'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TeacherPracticePage({ params }: Props) {
  const teacher = await requireTeacher()
  const { id } = await params
  const data = await getTeacherPracticeSessionView(teacher.id, id)

  if (!data) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4">
        <Link href="/teacher/questions" className="text-blue-600 hover:underline">
          返回试题管理
        </Link>
      </div>
      <PracticeTeacherBoard
        sessionId={id}
        initialData={JSON.parse(JSON.stringify(data))}
      />
    </div>
  )
}
