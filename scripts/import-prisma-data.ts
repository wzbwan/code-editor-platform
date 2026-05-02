import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'

const prisma = new PrismaClient()
const data = JSON.parse(readFileSync('backups/sqlite-export.json', 'utf8'))

async function insert(model: any, rows: any[]) {
  if (!rows?.length) return
  await model.createMany({ data: rows })
}

async function main() {
  await insert(prisma.user, data.users)
  await insert(prisma.appSetting, data.appSettings)
  await insert(prisma.assignment, data.assignments)
  await insert(prisma.submission, data.submissions)
  await insert(prisma.studentPointRecord, data.studentPointRecords)
  await insert(prisma.studentPet, data.studentPets)
  await insert(prisma.studentPetEquipmentSlot, data.studentPetEquipmentSlots)
  await insert(prisma.studentPetSkillSlot, data.studentPetSkillSlots)
  await insert(prisma.studentPetInventorySlot, data.studentPetInventorySlots)
  await insert(prisma.studentPetExpRecord, data.studentPetExpRecords)
  await insert(prisma.questionBankItem, data.questionBankItems)
  await insert(prisma.practicePaper, data.practicePapers)
  await insert(prisma.paperQuestion, data.paperQuestions)
  await insert(prisma.practiceSession, data.practiceSessions)
  await insert(prisma.practiceSessionStudent, data.practiceSessionStudents)
  await insert(prisma.practiceResponse, data.practiceResponses)
  await insert(prisma.challengeChapterUnlock, data.challengeChapterUnlocks)
  await insert(prisma.challengeLevelUnlock, data.challengeLevelUnlocks)
  await insert(prisma.challengeProgress, data.challengeProgresses)
  await insert(prisma.challengeSubmission, data.challengeSubmissions)
  await insert(prisma.godotSessionBootstrap, data.godotSessionBootstraps)
}

main()
  .finally(async () => prisma.$disconnect())
