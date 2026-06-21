import { campusStudyDataManagerChapter } from '@/lib/challenges/chapters/campus-study-data-manager'
import { fileArchiveStationChapter } from '@/lib/challenges/chapters/file-archive-station'
import { fireRescueDataCenterChapter } from '@/lib/challenges/chapters/fire-rescue-data-center'
import { finalExamDataCenterChapter } from '@/lib/challenges/chapters/final-exam-data-center'
import { hospitalErDataCenterChapter } from '@/lib/challenges/chapters/hospital-er-data-center'
import { lambdaListLabChapter } from '@/lib/challenges/chapters/lambda-list-lab'
import { listMilkTeaChapter } from '@/lib/challenges/chapters/list-milk-tea'
import { policeDutyDataCenterChapter } from '@/lib/challenges/chapters/police-duty-data-center'
import { robotRepairStationChapter } from '@/lib/challenges/chapters/robot-repair-station'
import { sequenceSetCampChapter } from '@/lib/challenges/chapters/sequence-set-camp'
import { spaceMarketAdventureChapter } from '@/lib/challenges/chapters/space-market-adventure'
import { ChallengeChapterDefinition, ChallengeLevelDefinition } from '@/lib/challenges/types'

const chapters = [
  listMilkTeaChapter,
  sequenceSetCampChapter,
  spaceMarketAdventureChapter,
  robotRepairStationChapter,
  fileArchiveStationChapter,
  campusStudyDataManagerChapter,
  lambdaListLabChapter,
  policeDutyDataCenterChapter,
  fireRescueDataCenterChapter,
  hospitalErDataCenterChapter,
  finalExamDataCenterChapter,
] satisfies ChallengeChapterDefinition[]

export function getAllChallengeChapters() {
  return chapters
}

export function getChallengeChapter(chapterKey: string) {
  return chapters.find((chapter) => chapter.key === chapterKey) || null
}

export function getChallengeLevel(
  chapterKey: string,
  levelKey: string
): ChallengeLevelDefinition | null {
  return getChallengeChapter(chapterKey)?.levels.find((level) => level.key === levelKey) || null
}
