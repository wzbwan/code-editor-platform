import { getPublicTemporaryExam, joinTemporaryExam, mutateTemporaryAttempt } from '@/lib/temporary-exams'
import { temporaryBody, temporaryResponse } from '@/lib/temporary-exam-http'

export const dynamic = 'force-dynamic'
type Context = { params: { id: string } }
export async function GET(_request: Request, { params }: Context) {
  return temporaryResponse(() => getPublicTemporaryExam(params.id))
}
export async function POST(request: Request, { params }: Context) {
  return temporaryResponse(async () => {
    const input = await temporaryBody(request)
    return input.action === 'JOIN' ? joinTemporaryExam(params.id, input) : mutateTemporaryAttempt(params.id, input)
  })
}
