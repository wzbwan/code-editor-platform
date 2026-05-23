import { notFound } from 'next/navigation'
import { requireStudent } from '@/lib/auth'
import { getStudentTrainingAttemptView } from '@/lib/training'
import StudentTrainingAttemptClient from './StudentTrainingAttemptClient'

interface Props {
  params: {
    attemptId: string
  }
}

export default async function StudentTrainingAttemptPage({ params }: Props) {
  const student = await requireStudent()
  const data = await getStudentTrainingAttemptView(student.id, params.attemptId)
  if (!data) {
    notFound()
  }

  return (
    <StudentTrainingAttemptClient
      attemptId={params.attemptId}
      initialData={JSON.parse(JSON.stringify(data))}
    />
  )
}
