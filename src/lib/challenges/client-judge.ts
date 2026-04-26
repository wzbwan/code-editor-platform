import {
  ChallengeJudgeConfig,
  ChallengeJudgeResult,
  ChallengeValue,
} from '@/lib/challenges/types'

const VARIABLE_START_MARKER = '__CODEX_CHALLENGE_VARIABLES_START__'
const VARIABLE_END_MARKER = '__CODEX_CHALLENGE_VARIABLES_END__'

export interface LocalRunnerSessionConfig {
  runnerUrl: string
  sharedToken: string
  timeoutSeconds: number
}

interface LocalRunnerExecutionResult {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
}

function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, '\n').trim()
}

function isChallengeRecord(value: ChallengeValue): value is { [key: string]: ChallengeValue } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function challengeValuesEqual(left: ChallengeValue, right: ChallengeValue): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }

    return left.every((item, index) => challengeValuesEqual(item, right[index]))
  }

  if (isChallengeRecord(left) || isChallengeRecord(right)) {
    if (!isChallengeRecord(left) || !isChallengeRecord(right)) {
      return false
    }

    const leftKeys = Object.keys(left).sort()
    const rightKeys = Object.keys(right).sort()
    if (!challengeValuesEqual(leftKeys, rightKeys)) {
      return false
    }

    return leftKeys.every((key) => challengeValuesEqual(left[key], right[key]))
  }

  return left === right
}

function sanitizePythonFilename(input: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'challenge'}.py`
}

function buildVariableJudgeScript(code: string, variableNames: string[]) {
  const variableNamesJson = JSON.stringify(variableNames, null, 0)

  return `${code}

import json

def __challenge_normalize(value):
    if isinstance(value, set):
        normalized_items = [__challenge_normalize(item) for item in value]
        return sorted(
            normalized_items,
            key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True)
        )
    if isinstance(value, tuple):
        return [__challenge_normalize(item) for item in value]
    if isinstance(value, list):
        return [__challenge_normalize(item) for item in value]
    if isinstance(value, dict):
        return {
            str(key): __challenge_normalize(item)
            for key, item in value.items()
        }
    return value

__challenge_result = {}
for __challenge_name in ${variableNamesJson}:
    if __challenge_name in globals():
        try:
            __challenge_value = __challenge_normalize(globals()[__challenge_name])
            json.dumps(__challenge_value, ensure_ascii=False)
            __challenge_result[__challenge_name] = {
                "missing": False,
                "value": __challenge_value,
            }
        except TypeError:
            __challenge_result[__challenge_name] = {
                "missing": False,
                "value": repr(globals()[__challenge_name]),
                "nonJson": True,
            }
    else:
        __challenge_result[__challenge_name] = {
            "missing": True,
        }

print("${VARIABLE_START_MARKER}")
print(json.dumps(__challenge_result, ensure_ascii=False))
print("${VARIABLE_END_MARKER}")
`
}

function extractVariablePayload(stdout: string) {
  const startIndex = stdout.lastIndexOf(VARIABLE_START_MARKER)
  const endIndex = stdout.lastIndexOf(VARIABLE_END_MARKER)

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return {
      stdout,
      payload: null as Record<string, { missing: boolean; value?: ChallengeValue; nonJson?: boolean }> | null,
    }
  }

  const rawPayload = stdout
    .slice(startIndex + VARIABLE_START_MARKER.length, endIndex)
    .trim()

  const visibleStdout = `${stdout.slice(0, startIndex)}${stdout.slice(
    endIndex + VARIABLE_END_MARKER.length
  )}`.trim()

  try {
    return {
      stdout: visibleStdout,
      payload: JSON.parse(rawPayload) as Record<
        string,
        { missing: boolean; value?: ChallengeValue; nonJson?: boolean }
      >,
    }
  } catch {
    return { stdout: visibleStdout, payload: null }
  }
}

export async function getLocalRunnerSessionConfig(): Promise<LocalRunnerSessionConfig> {
  const res = await fetch('/api/local-runner/session')
  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || '无法获取本地运行器配置')
  }

  return data as LocalRunnerSessionConfig
}

export async function runCodeWithLocalRunner(input: {
  runner: LocalRunnerSessionConfig
  code: string
  filenameBase: string
}): Promise<LocalRunnerExecutionResult> {
  const res = await fetch(`${input.runner.runnerUrl}/v1/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(input.runner.sharedToken
        ? {
            'X-Runner-Token': input.runner.sharedToken,
          }
        : {}),
    },
    body: JSON.stringify({
      code: input.code,
      timeoutSeconds: input.runner.timeoutSeconds,
      filename: sanitizePythonFilename(input.filenameBase),
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || '本地运行器执行失败')
  }

  return data as LocalRunnerExecutionResult
}

export async function judgeChallengeWithLocalRunner(input: {
  code: string
  chapterTitle: string
  levelTitle: string
  judge: ChallengeJudgeConfig
}) {
  if (!input.code.trim()) {
    return {
      passed: false,
      message: '代码不能为空。',
      stdout: '',
      stderr: '',
    } satisfies ChallengeJudgeResult
  }

  const runner = await getLocalRunnerSessionConfig()
  const filenameBase = `${input.chapterTitle}-${input.levelTitle}`

  if (input.judge.mode === 'VARIABLES') {
    const runResult = await runCodeWithLocalRunner({
      runner,
      code: buildVariableJudgeScript(input.code, Object.keys(input.judge.expectedVariables)),
      filenameBase,
    })
    const { stdout, payload } = extractVariablePayload(runResult.stdout)

    if (!payload) {
      return {
        passed: false,
        message:
          runResult.timedOut || runResult.exitCode !== 0
            ? '代码未正常执行完成，无法读取判题变量。'
            : '代码执行后没有拿到判题变量，请检查是否存在语法或运行错误。',
        stdout,
        stderr: runResult.stderr,
      } satisfies ChallengeJudgeResult
    }

    for (const [variableName, expectedValue] of Object.entries(input.judge.expectedVariables)) {
      const actual = payload[variableName]
      if (!actual || actual.missing) {
        return {
          passed: false,
          message: `缺少变量 ${variableName}，请按要求保存结果。`,
          stdout,
          stderr: runResult.stderr,
        } satisfies ChallengeJudgeResult
      }

      if (actual.nonJson) {
        return {
          passed: false,
          message: `变量 ${variableName} 的结果无法判定，请使用基础类型或列表保存结果。`,
          stdout,
          stderr: runResult.stderr,
        } satisfies ChallengeJudgeResult
      }

      if (!challengeValuesEqual((actual.value ?? null) as ChallengeValue, expectedValue)) {
        return {
          passed: false,
          message: `变量 ${variableName} 的结果不正确。`,
          stdout,
          stderr: runResult.stderr,
        } satisfies ChallengeJudgeResult
      }
    }

    return {
      passed: true,
      message: '恭喜通关，结果正确。',
      stdout,
      stderr: runResult.stderr,
    } satisfies ChallengeJudgeResult
  }

  const runResult = await runCodeWithLocalRunner({
    runner,
    code: input.code,
    filenameBase,
  })

  if (normalizeOutput(runResult.stdout) !== normalizeOutput(input.judge.expectedOutput)) {
    return {
      passed: false,
      message: '输出结果不正确，请对照题目要求检查输出顺序和格式。',
      stdout: runResult.stdout,
      stderr: runResult.stderr,
    } satisfies ChallengeJudgeResult
  }

  return {
    passed: true,
    message: '恭喜通关，输出结果正确。',
    stdout: runResult.stdout,
    stderr: runResult.stderr,
  } satisfies ChallengeJudgeResult
}
