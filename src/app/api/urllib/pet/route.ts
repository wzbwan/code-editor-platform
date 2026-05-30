import { NextRequest, NextResponse } from 'next/server'
import { getStudentPetProfile } from '@/lib/pets/service'
import {
  authenticateStudentCredentials,
  readCredentialsFromSearchParams,
} from '@/lib/urllib-student-api'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const auth = await authenticateStudentCredentials(
    readCredentialsFromSearchParams(searchParams)
  )

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const profile = await getStudentPetProfile(auth.student.id)

  return NextResponse.json(
    {
      student: auth.student,
      pet: profile.pet,
      availablePets: profile.availablePets,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
