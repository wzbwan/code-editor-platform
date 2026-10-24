import { teacherTemporaryExamAction, teacherTemporaryExamDetail } from '@/lib/temporary-exams'
import { temporaryBody, temporaryResponse, temporaryTeacher } from '@/lib/temporary-exam-http'

export const dynamic = 'force-dynamic'
type Context = { params: { id: string } }
export async function GET(_request: Request, { params }: Context) {
  return temporaryResponse(async () => teacherTemporaryExamDetail(await temporaryTeacher(), params.id))
}
export async function POST(request: Request, { params }: Context) {
  return temporaryResponse(async () => teacherTemporaryExamAction(await temporaryTeacher(), params.id, await temporaryBody(request)))
}
