import Link from 'next/link'
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">作业管理</h1>
          <p className="mt-2 text-sm text-slate-600">管理作业、闯关任务和课堂练习资源。</p>
        </div>
        <Link
          href="/teacher/challenges/designer"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
        >
          设计代码闯关
        </Link>
      </div>
      <AssignmentManager assignments={JSON.parse(JSON.stringify(assignments))} />
    </div>
  )
}
