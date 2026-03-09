import { requireStudent } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AssignmentList from './AssignmentList'

export default async function StudentPage() {
  const user = await requireStudent()
  
  const assignments = await prisma.assignment.findMany({
    include: {
      _count: { select: { submissions: true } },
      submissions: { 
        where: { studentId: user.id },
        select: { id: true, score: true, feedback: true } 
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">我的作业</h1>
      <AssignmentList assignments={JSON.parse(JSON.stringify(assignments))} />
    </div>
  )
}
