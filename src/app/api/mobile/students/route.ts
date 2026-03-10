import { NextRequest, NextResponse } from 'next/server'
import { authenticateMobileApiRequest } from '@/lib/mobile-api'
import { prisma } from '@/lib/prisma'
import { matchesStudentQuery } from '@/lib/student-search'

export async function GET(request: NextRequest) {
  const auth = await authenticateMobileApiRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')?.trim() || ''

  const students = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
    },
    select: {
      id: true,
      name: true,
      username: true,
      pointBalance: true,
    },
    orderBy: {
      username: 'asc',
    },
  })

  const filteredStudents = students
    .filter((student) => matchesStudentQuery(student, query))
    .slice(0, 20)

  return NextResponse.json({
    students: filteredStudents,
  })
}
