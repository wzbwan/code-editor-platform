import { requireTeacher } from '@/lib/auth'
import { getAssignmentStatusSummary } from '@/lib/assignment-status'
import { prisma } from '@/lib/prisma'
import SubmissionStatusBoard from './SubmissionStatusBoard'

interface Props {
  searchParams: Promise<{ assignmentId?: string; className?: string }>
}

export default async function AssignmentStatusPage({ searchParams }: Props) {
  const teacher = await requireTeacher()
  const { assignmentId, className } = await searchParams

  const assignments = await prisma.assignment.findMany({
    where: {
      teacherId: teacher.id,
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const initialSelectedAssignmentId = assignmentId || assignments[0]?.id || ''
  const initialStatusData = initialSelectedAssignmentId
    ? await getAssignmentStatusSummary({
        teacherId: teacher.id,
        assignmentId: initialSelectedAssignmentId,
        className,
      })
    : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">提交状态</h1>
      <SubmissionStatusBoard
        assignments={JSON.parse(JSON.stringify(assignments))}
        initialSelectedAssignmentId={initialSelectedAssignmentId}
        initialStatusData={JSON.parse(JSON.stringify(initialStatusData))}
      />
    </div>
  )
}
