import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'node:fs'

const prisma = new PrismaClient()

async function main() {
  const data = {
    users: await prisma.user.findMany(),
    appSettings: await prisma.appSetting.findMany(),
    assignments: await prisma.assignment.findMany(),
    submissions: await prisma.submission.findMany(),
    studentPointRecords: await prisma.studentPointRecord.findMany(),
    studentPets: await prisma.studentPet.findMany(),
    studentPetEquipmentSlots: await prisma.studentPetEquipmentSlot.findMany(),
    studentPetSkillSlots: await prisma.studentPetSkillSlot.findMany(),
    studentPetInventorySlots: await prisma.studentPetInventorySlot.findMany(),
    studentPetExpRecords: await prisma.studentPetExpRecord.findMany(),
    questionBankItems: await prisma.questionBankItem.findMany(),
    practicePapers: await prisma.practicePaper.findMany(),
    paperQuestions: await prisma.paperQuestion.findMany(),
    practiceSessions: await prisma.practiceSession.findMany(),
    practiceSessionStudents: await prisma.practiceSessionStudent.findMany(),
    practiceResponses: await prisma.practiceResponse.findMany(),
    challengeChapterUnlocks: await prisma.challengeChapterUnlock.findMany(),
    challengeLevelUnlocks: await prisma.challengeLevelUnlock.findMany(),
    challengeProgresses: await prisma.challengeProgress.findMany(),
    challengeSubmissions: await prisma.challengeSubmission.findMany(),
    godotSessionBootstraps: await prisma.godotSessionBootstrap.findMany(),
  }

  mkdirSync('backups', { recursive: true })
  writeFileSync('backups/sqlite-export.json', JSON.stringify(data, null, 2))
}

main()
  .finally(async () => prisma.$disconnect())
