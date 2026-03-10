import { requireTeacher } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listStudentPointRecords } from '@/lib/student-points'
import StudentManager from './StudentManager'

export default async function StudentsPage() {
  await requireTeacher()
  
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: {
      id: true,
      username: true,
      name: true,
      pointBalance: true,
      createdAt: true,
      _count: { select: { submissions: true } },
    },
    orderBy: { username: 'asc' },
  })

  const recentPointRecords = await listStudentPointRecords(undefined, 20)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">学生管理</h1>
      <StudentManager
        students={JSON.parse(JSON.stringify(students))}
        recentPointRecords={JSON.parse(JSON.stringify(recentPointRecords))}
      />
    </div>
  )
}
