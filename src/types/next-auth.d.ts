import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      username: string
      role: string
      clientType: string
    }
  }

  interface User {
    id: string
    name: string
    username: string
    role: string
    clientType: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    username: string
    clientType: string
  }
}
