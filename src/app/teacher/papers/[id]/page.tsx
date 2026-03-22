import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth'
import { getTeacherPracticePaperDetail } from '@/lib/practice'
import PaperEditor from './PaperEditor'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TeacherPaperPage({ params }: Props) {
  const teacher = await requireTeacher()
  const { id } = await params
  const paper = await getTeacherPracticePaperDetail(teacher.id, id)

  if (!paper) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PaperEditor initialPaper={JSON.parse(JSON.stringify(paper))} />
    </div>
  )
}
