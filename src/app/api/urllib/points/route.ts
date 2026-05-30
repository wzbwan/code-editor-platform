import { NextRequest, NextResponse } from 'next/server'
import { listStudentPointRecords } from '@/lib/student-points'
import {
  authenticateStudentCredentials,
  parseRecordTake,
  readCredentialsFromRequest,
} from '@/lib/urllib-student-api'

export async function POST(request: NextRequest) {
  const body = await readCredentialsFromRequest(request)
  const auth = await authenticateStudentCredentials({
    studentNo: body.studentNo,
    password: body.password,
  })

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const takeResult = parseRecordTake(body.take)
  if (!takeResult.ok) {
    return NextResponse.json({ error: takeResult.error }, { status: 400 })
  }

  const records = await listStudentPointRecords(auth.student.id, takeResult.take)

  return NextResponse.json(
    {
      student: auth.student,
      records,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
