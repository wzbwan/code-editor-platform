import { NextResponse } from 'next/server'
import { temporaryResponse, temporaryTeacher } from '@/lib/temporary-exam-http'
import { teacherTemporaryExamDetail, TemporaryExamError } from '@/lib/temporary-exams'
import { temporaryPapersZip, temporaryScoresWorkbook } from '@/lib/temporary-exam-export'

export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const teacherId = await temporaryTeacher()
    const detail = await teacherTemporaryExamDetail(teacherId, params.id)
    const query = new URL(request.url).searchParams
    const format = query.get('format') || 'scores'
    const attemptId = query.get('attemptId')
    if (attemptId && !detail.attempts.some(a => a.id === attemptId)) throw new TemporaryExamError('答卷不存在', 404)
    if (!['scores', 'papers'].includes(format)) throw new TemporaryExamError('不支持的导出格式')
    const output = format === 'papers' ? await temporaryPapersZip(detail, attemptId) : temporaryScoresWorkbook(detail)
    return new NextResponse(new Uint8Array(output), { headers: {
      'Content-Type': format === 'papers' ? 'application/zip' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="exam-${params.id}${attemptId ? `-${attemptId}` : ''}.${format === 'papers' ? 'zip' : 'xlsx'}"`,
      'Cache-Control': 'no-store',
    } })
  } catch (e) { return temporaryResponse(async () => { throw e }) }
}
