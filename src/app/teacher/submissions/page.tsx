import { requireTeacher } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import SubmissionReviewer from './SubmissionReviewer'

interface Props {
  searchParams: Promise<{ assignmentId?: string }>
}

export default async function SubmissionsPage({ searchParams }: Props) {
  await requireTeacher()
  const { assignmentId } = await searchParams
  
  const [submissions, assignments] = await Promise.all([
    assignmentId
      ? prisma.submission.findMany({
          where: { assignmentId },
          include: {
            student: { select: { id: true, name: true, username: true } },
            assignment: { select: { id: true, title: true } },
          },
          orderBy: { submittedAt: 'desc' },
        })
      : [],
    prisma.assignment.findMany({
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">批阅作业</h1>
      <SubmissionReviewer
        submissions={JSON.parse(JSON.stringify(submissions))}
        assignments={JSON.parse(JSON.stringify(assignments))}
        selectedAssignmentId={assignmentId || ''}
      />
    </div>
  )
}
