import { requireTeacher } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AssignmentManager from './AssignmentManager'

export default async function TeacherPage() {
  const teacher = await requireTeacher()
  
  const assignments = await prisma.assignment.findMany({
    where: {
      teacherId: teacher.id,
    },
    include: {
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">作业管理</h1>
      <AssignmentManager assignments={JSON.parse(JSON.stringify(assignments))} />
    </div>
  )
}
