import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('123456', 10)
  
  const teacher = await prisma.user.upsert({
    where: { username: 'teacher' },
    update: {},
    create: {
      username: 'teacher',
      password: hashedPassword,
      name: '教师账号',
      role: 'TEACHER',
    },
  })

  const student1 = await prisma.user.upsert({
    where: { username: 'student1' },
    update: {},
    create: {
      username: 'student1',
      password: hashedPassword,
      name: '张三',
      className: '1班',
      role: 'STUDENT',
    },
  })

  const student2 = await prisma.user.upsert({
    where: { username: 'student2' },
    update: {},
    create: {
      username: 'student2',
      password: hashedPassword,
      name: '李四',
      className: '1班',
      role: 'STUDENT',
    },
  })

  const assignment1 = await prisma.assignment.upsert({
    where: { id: 'assignment1' },
    update: {},
    create: {
      id: 'assignment1',
      title: 'Hello World',
      description: '编写一个Python程序，输出"Hello, World!"',
      teacherId: teacher.id,
    },
  })

  const assignment2 = await prisma.assignment.upsert({
    where: { id: 'assignment2' },
    update: {},
    create: {
      id: 'assignment2',
      title: '计算阶乘',
      description: '编写一个Python函数，计算给定数字的阶乘。\n\n例如：\n factorial(5) = 120',
      teacherId: teacher.id,
    },
  })

  console.log({ teacher, student1, student2, assignment1, assignment2 })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
