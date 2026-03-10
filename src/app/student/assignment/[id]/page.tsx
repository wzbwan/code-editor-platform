import { requireStudent } from '@/lib/auth'
import { ASSIGNMENT_STATUS } from '@/lib/constants'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import CodeEditorClient from './CodeEditorClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AssignmentPage({ params }: Props) {
  const user = await requireStudent()
  const { id } = await params
  
  const assignment = await prisma.assignment.findFirst({
    where: {
      id,
      status: ASSIGNMENT_STATUS.ACTIVE,
    },
    include: {
      submissions: {
        where: { studentId: user.id },
      },
    },
  })

  if (!assignment) {
    notFound()
  }

  return (
    <CodeEditorClient
      assignment={JSON.parse(JSON.stringify(assignment))}
    />
  )
}
