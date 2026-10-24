import { NextResponse } from 'next/server'
import paper from '../../../../../resources/temporary-exams/python-basics-60.json'
import { temporaryResponse, temporaryTeacher } from '@/lib/temporary-exam-http'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  return temporaryResponse(async () => {
    await temporaryTeacher()
    return paper
  }).then(async response => {
    if (new URL(request.url).searchParams.get('download') === '1' && response.ok) {
      return new NextResponse(JSON.stringify(await response.json(), null, 2), { headers: {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="python-basics-60.json"',
      } })
    }
    return response
  })
}
