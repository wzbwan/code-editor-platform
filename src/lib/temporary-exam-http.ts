import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './auth-options'
import { TemporaryExamError } from './temporary-exams'

export async function temporaryTeacher() {
  const session = await getServerSession(authOptions)
  if (session?.user.role !== 'TEACHER') throw new TemporaryExamError('未授权', 401)
  return session.user.id
}
export async function temporaryBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new TemporaryExamError('请发送 JSON 数据', 415)
  const reader = request.body?.getReader()
  if (!reader) throw new TemporaryExamError('请求不能为空')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 1024 * 1024) { await reader.cancel(); throw new TemporaryExamError('文件或答卷不能超过1MB', 413) }
    chunks.push(value)
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value as Record<string, unknown>
  } catch { throw new TemporaryExamError('JSON 格式错误') }
}
export async function temporaryResponse(work: () => Promise<unknown>) {
  try { return NextResponse.json(await work(), { headers: { 'Cache-Control': 'no-store' } }) }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '操作失败' }, {
      status: error instanceof TemporaryExamError ? error.status : 400, headers: { 'Cache-Control': 'no-store' },
    })
  }
}
