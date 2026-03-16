import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Providers from '@/components/Providers'

export const metadata: Metadata = {
  title: 'Python代码编辑器平台',
  description: '在线Python代码编辑和作业提交平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <Navbar />
          <main className="min-h-screen bg-gray-100">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
