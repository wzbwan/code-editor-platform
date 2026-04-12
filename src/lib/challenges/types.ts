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

export interface ChallengeChapterDefinition {
  key: string
  title: string
  description: string
  theme: string
  levels: ChallengeLevelDefinition[]
}

export interface ChallengeJudgeResult {
  passed: boolean
  message: string
  stdout: string
  stderr: string
}
