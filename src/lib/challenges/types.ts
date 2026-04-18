export type ChallengeValue =
  | string
  | number
  | boolean
  | null
  | ChallengeValue[]
  | { [key: string]: ChallengeValue }

export interface ChallengeVariableJudgeConfig {
  mode: 'VARIABLES'
  expectedVariables: Record<string, ChallengeValue>
}

export interface ChallengeOutputJudgeConfig {
  mode: 'OUTPUT'
  expectedOutput: string
}

export type ChallengeJudgeConfig =
  | ChallengeVariableJudgeConfig
  | ChallengeOutputJudgeConfig

export interface ChallengeLevelDefinition {
  key: string
  title: string
  summary: string
  description: string
  points: number
  initialCode: string
  judge: ChallengeJudgeConfig
}

export interface ChallengeHelpDocSection {
  title: string
  points: string[]
  exampleTitle?: string
  exampleCode?: string
}

export interface ChallengeHelpDoc {
  title: string
  intro: string
  sections: ChallengeHelpDocSection[]
  closingTip?: string
}

export interface ChallengeChapterDefinition {
  key: string
  title: string
  description: string
  theme: string
  helpDoc: ChallengeHelpDoc
  levels: ChallengeLevelDefinition[]
}

export interface ChallengeJudgeResult {
  passed: boolean
  message: string
  stdout: string
  stderr: string
}
