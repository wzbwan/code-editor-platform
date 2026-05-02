import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { clearLoginFailures, getLoginRetryAfterSeconds, recordLoginFailure } from '@/lib/auth-throttle'
import { createLoginRetryError } from '@/lib/auth-throttle-messages'
import { SESSION_CLIENT_TYPES } from '@/lib/session-client'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: '用户名', type: 'text' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const username = credentials.username.trim()
        const retryAfterSeconds = await getLoginRetryAfterSeconds(username)
        if (retryAfterSeconds > 0) {
          throw new Error(createLoginRetryError(retryAfterSeconds))
        }

        const user = await prisma.user.findUnique({
          where: { username },
        })

        if (!user) {
          return null
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!passwordMatch) {
          const nextRetryAfterSeconds = await recordLoginFailure(username)
          throw new Error(createLoginRetryError(nextRetryAfterSeconds))
        }

        await clearLoginFailures(username)

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          clientType: SESSION_CLIENT_TYPES.WEB,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.username = user.username
        token.name = user.name
        token.clientType = user.clientType || SESSION_CLIENT_TYPES.WEB
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.name = (token.name as string) || session.user.name
        session.user.role = token.role as string
        session.user.username = token.username as string
        session.user.clientType = (token.clientType as string) || SESSION_CLIENT_TYPES.WEB
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production',
}
