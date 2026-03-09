import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

export async function requireTeacher() {
  const user = await requireAuth()
  if (user.role !== 'TEACHER') {
    redirect('/student')
  }
  return user
}

export async function requireStudent() {
  const user = await requireAuth()
  if (user.role !== 'STUDENT') {
    redirect('/teacher')
  }
  return user
}
