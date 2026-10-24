import { prisma } from '@/lib/prisma'
import { createTemporaryExam } from '@/lib/temporary-exams'
import { temporaryBody, temporaryResponse, temporaryTeacher } from '@/lib/temporary-exam-http'

export const dynamic = 'force-dynamic'
export async function GET() {
  return temporaryResponse(async () => {
    const teacherId = await temporaryTeacher()
    return prisma.temporaryExam.findMany({ where: { teacherId }, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, startsAt: true, endsAt: true, status: true, _count: { select: { attempts: true } } } })
  })
}
export async function POST(request: Request) {
  return temporaryResponse(async () => createTemporaryExam(await temporaryTeacher(), await temporaryBody(request)))
}
