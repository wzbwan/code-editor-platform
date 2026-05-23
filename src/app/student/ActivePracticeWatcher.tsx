'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export default function ActivePracticeWatcher() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const poll = async () => {
      if (pathname === '/student/practice') {
        return
      }

      const res = await fetch('/api/student-practice/active')
      const data = await res.json()

      if (res.ok && data.active) {
        router.push('/student/practice')
        return
      }

      if (pathname?.startsWith('/student/exams')) {
        return
      }

      const examRes = await fetch('/api/student-exams/active')
      const examData = await examRes.json()

      if (examRes.ok && examData.active && examData.exam?.id) {
        router.push(`/student/exams/${examData.exam.id}`)
      }
    }

    void poll()
    const timer = window.setInterval(() => {
      void poll()
    }, 5000)

    return () => window.clearInterval(timer)
  }, [pathname, router])

  return null
}
