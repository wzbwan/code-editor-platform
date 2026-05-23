import { notFound } from 'next/navigation'
import { requireStudent } from '@/lib/auth'
import { getStudentExamView } from '@/lib/exams'
import StudentExamClient from './StudentExamClient'

interface Props {
  params: {
    id: string
  }
}

export default async function StudentExamPage({ params }: Props) {
  const student = await requireStudent()
  const data = await getStudentExamView(student.id, params.id)

  if (!data) {
    notFound()
  }

  return <StudentExamClient examId={params.id} initialData={JSON.parse(JSON.stringify(data))} />
}
