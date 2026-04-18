import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getChallengeLevel } from '@/lib/challenges/registry'
import {
  ChallengeJudgeResult,
  ChallengeLevelDefinition,
  ChallengeOutputJudgeConfig,
  ChallengeValue,
  ChallengeVariableJudgeConfig,
} from '@/lib/challenges/types'

const VARIABLE_START_MARKER = '__CODEX_CHALLENGE_VARIABLES_START__'
const VARIABLE_END_MARKER = '__CODEX_CHALLENGE_VARIABLES_END__'

interface PythonRunResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, '\n').trim()
}

function challengeValuesEqual(left: ChallengeValue, right: ChallengeValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
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

async function runPythonScript(script: string): Promise<PythonRunResult> {
  const tempDir = await mkdtemp(join(tmpdir(), 'challenge-judge-'))
  const scriptPath = join(tempDir, 'main.py')
  const timeoutSeconds = Number(process.env.CHALLENGE_TIMEOUT_SECONDS || '8')
  const candidateCommands = Array.from(
    new Set(
      [
        process.env.CHALLENGE_PYTHON_COMMAND?.trim(),
        'python3',
        'python',
      ].filter(Boolean) as string[]
    )
  )

  await writeFile(scriptPath, script, 'utf8')

  try {
    let lastError: Error | null = null

    for (const command of candidateCommands) {
      try {
        return await new Promise<PythonRunResult>((resolve, reject) => {
          const child = spawn(command, [scriptPath], {
            cwd: tempDir,
          })

          let stdout = ''
          let stderr = ''
          let settled = false

          const timeout = setTimeout(() => {
            child.kill('SIGKILL')
            if (!settled) {
              settled = true
              resolve({
                stdout,
                stderr: `${stderr}\n执行超时，请检查是否出现死循环。`.trim(),
                exitCode: null,
              })
            }
          }, timeoutSeconds * 1000)

          child.stdout.on('data', (chunk) => {
            stdout += String(chunk)
          })

          child.stderr.on('data', (chunk) => {
            stderr += String(chunk)
          })

          child.on('error', (error) => {
            clearTimeout(timeout)
            if (!settled) {
              settled = true
              reject(error)
            }
          })

          child.on('close', (exitCode) => {
            clearTimeout(timeout)
            if (!settled) {
              settled = true
              resolve({ stdout, stderr, exitCode })
            }
          })
        })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          lastError = error as Error
          continue
        }
        throw error
      }
    }

    throw lastError || new Error('未找到可用的 Python 命令')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
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

async function judgeByVariables(
  level: ChallengeLevelDefinition & { judge: ChallengeVariableJudgeConfig },
  code: string
): Promise<ChallengeJudgeResult> {
  const runResult = await runPythonScript(
    buildVariableJudgeScript(code, Object.keys(level.judge.expectedVariables))
  )
  const { stdout, payload } = extractVariablePayload(runResult.stdout)

  if (!payload) {
    return {
      passed: false,
      message:
        runResult.exitCode === null
          ? '代码未正常执行完成，无法读取判题变量。'
          : '代码执行后没有拿到判题变量，请检查是否存在语法或运行错误。',
      stdout,
      stderr: runResult.stderr,
    }
  }

  for (const [variableName, expectedValue] of Object.entries(level.judge.expectedVariables)) {
    const actual = payload[variableName]
    if (!actual || actual.missing) {
      return {
        passed: false,
        message: `缺少变量 ${variableName}，请按要求保存结果。`,
        stdout,
        stderr: runResult.stderr,
      }
    }

    if (actual.nonJson) {
      return {
        passed: false,
        message: `变量 ${variableName} 的结果无法判定，请使用基础类型或列表保存结果。`,
        stdout,
        stderr: runResult.stderr,
      }
    }

    if (!challengeValuesEqual((actual.value ?? null) as ChallengeValue, expectedValue)) {
      return {
        passed: false,
        message: `变量 ${variableName} 的结果不正确。`,
        stdout,
        stderr: runResult.stderr,
      }
    }
  }

  return {
    passed: true,
    message: '恭喜通关，结果正确。',
    stdout,
    stderr: runResult.stderr,
  }
}

async function judgeByOutput(
  level: ChallengeLevelDefinition & { judge: ChallengeOutputJudgeConfig },
  code: string
): Promise<ChallengeJudgeResult> {
  const runResult = await runPythonScript(code)
  const actualOutput = normalizeOutput(runResult.stdout)
  const expectedOutput = normalizeOutput(level.judge.expectedOutput)

  if (actualOutput !== expectedOutput) {
    return {
      passed: false,
      message: '输出结果不正确，请对照题目要求检查输出顺序和格式。',
      stdout: runResult.stdout,
      stderr: runResult.stderr,
    }
  }

  return {
    passed: true,
    message: '恭喜通关，输出结果正确。',
    stdout: runResult.stdout,
    stderr: runResult.stderr,
  }
}

export async function judgeChallengeSubmission(
  chapterKey: string,
  levelKey: string,
  code: string
) {
  const level = getChallengeLevel(chapterKey, levelKey)
  if (!level) {
    throw new Error('关卡不存在')
  }

  if (!code.trim()) {
    return {
      passed: false,
      message: '代码不能为空。',
      stdout: '',
      stderr: '',
    }
  }

  if (level.judge.mode === 'VARIABLES') {
    return judgeByVariables(level as ChallengeLevelDefinition & { judge: ChallengeVariableJudgeConfig }, code)
  }

  return judgeByOutput(level as ChallengeLevelDefinition & { judge: ChallengeOutputJudgeConfig }, code)
}
