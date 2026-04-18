import { listMilkTeaChapter } from '@/lib/challenges/chapters/list-milk-tea'
import { sequenceSetCampChapter } from '@/lib/challenges/chapters/sequence-set-camp'
import { ChallengeChapterDefinition, ChallengeLevelDefinition } from '@/lib/challenges/types'

const chapters = [listMilkTeaChapter, sequenceSetCampChapter] satisfies ChallengeChapterDefinition[]

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
