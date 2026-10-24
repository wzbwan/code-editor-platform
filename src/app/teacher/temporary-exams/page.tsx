import { requireTeacher } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import TemporaryExamManager from './TemporaryExamManager'

export default async function Page() {
  const teacher = await requireTeacher()
  const exams = await prisma.temporaryExam.findMany({ where: { teacherId: teacher.id }, orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, startsAt: true, endsAt: true, status: true, _count: { select: { attempts: true } } } })
  return <TemporaryExamManager initialExams={JSON.parse(JSON.stringify(exams))} />
}
