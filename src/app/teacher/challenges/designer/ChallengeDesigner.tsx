'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ChallengeChapterDefinition,
  ChallengeJudgeConfig,
  ChallengeJudgeResult,
  ChallengeValue,
} from '@/lib/challenges/types'
import { judgeChallengeWithLocalRunner } from '@/lib/challenges/client-judge'

type JudgeMode = ChallengeJudgeConfig['mode']

interface DesignerLevel {
  key: string
  title: string
  summary: string
  description: string
  points: number
  initialCode: string
  judgeMode: JudgeMode
  expectedOutput: string
  expectedVariablesJson: string
}

interface DesignerChapter {
  key: string
  title: string
  description: string
  theme: string
  levels: DesignerLevel[]
}

interface TestState {
  running: boolean
  result: ChallengeJudgeResult | null
  error: string
}

interface Props {
  initialChapters: ChallengeChapterDefinition[]
}

const STORAGE_KEY = 'teacher-challenge-designer-draft-v1'

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function toDesignerLevel(level: ChallengeChapterDefinition['levels'][number]): DesignerLevel {
  return {
    key: level.key,
    title: level.title,
    summary: level.summary,
    description: level.description,
    points: level.points,
    initialCode: level.initialCode,
    judgeMode: level.judge.mode,
    expectedOutput: level.judge.mode === 'OUTPUT' ? level.judge.expectedOutput : '',
    expectedVariablesJson:
      level.judge.mode === 'VARIABLES' ? formatJson(level.judge.expectedVariables) : '{\n  \n}',
  }
}

function toDesignerChapter(chapter: ChallengeChapterDefinition): DesignerChapter {
  return {
    key: chapter.key,
    title: chapter.title,
    description: chapter.description,
    theme: chapter.theme,
    levels: chapter.levels.map(toDesignerLevel),
  }
}

function makeNewLevel(index: number): DesignerLevel {
  return {
    key: `new-level-${index + 1}`,
    title: `新关卡 ${index + 1}`,
    summary: '填写这一关的练习目标。',
    description: '任务：请描述学生需要完成的代码目标。',
    points: 2,
    initialCode: '# 在这里编写初始代码\n',
    judgeMode: 'VARIABLES',
    expectedOutput: '',
    expectedVariablesJson: '{\n  "result": null\n}',
  }
}

function makeNewChapter(index: number): DesignerChapter {
  return {
    key: `new-chapter-${index + 1}`,
    title: `新闯关任务 ${index + 1}`,
    theme: 'Python 主题',
    description: '填写这个闯关任务的学习场景和能力目标。',
    levels: [makeNewLevel(0)],
  }
}

function parseVariablesJson(raw: string) {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('变量判题配置必须是 JSON 对象，例如 {"answer": 42}')
  }
  return parsed as Record<string, ChallengeValue>
}

function buildJudge(level: DesignerLevel): ChallengeJudgeConfig {
  if (level.judgeMode === 'OUTPUT') {
    return {
      mode: 'OUTPUT',
      expectedOutput: level.expectedOutput,
    }
  }

  return {
    mode: 'VARIABLES',
    expectedVariables: parseVariablesJson(level.expectedVariablesJson),
  }
}

function toExportChapter(chapter: DesignerChapter): ChallengeChapterDefinition {
  return {
    key: chapter.key.trim(),
    title: chapter.title.trim(),
    description: chapter.description.trim(),
    theme: chapter.theme.trim(),
    helpDoc: {
      title: `${chapter.title.trim() || '闯关任务'}速查`,
      intro: '请在正式发布前补充本任务对应的知识速查内容。',
      sections: [],
    },
    levels: chapter.levels.map((level) => ({
      key: level.key.trim(),
      title: level.title.trim(),
      summary: level.summary.trim(),
      description: level.description.trim(),
      points: Number(level.points) || 0,
      initialCode: level.initialCode,
      judge: buildJudge(level),
    })),
  }
}

function validateLevel(level: DesignerLevel) {
  const errors: string[] = []

  if (!level.key.trim()) errors.push('关卡 key 不能为空')
  if (!level.title.trim()) errors.push('关卡标题不能为空')
  if (level.points < 0) errors.push('积分不能小于 0')

  if (level.judgeMode === 'VARIABLES') {
    try {
      parseVariablesJson(level.expectedVariablesJson)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '变量判题 JSON 无效')
    }
  }

  return errors
}

function validateChapter(chapter: DesignerChapter) {
  const errors: string[] = []

  if (!chapter.key.trim()) errors.push('任务 key 不能为空')
  if (!chapter.title.trim()) errors.push('任务标题不能为空')
  if (chapter.levels.length === 0) errors.push('至少需要 1 个关卡')

  const levelKeys = chapter.levels.map((level) => level.key.trim()).filter(Boolean)
  const duplicatedKey = levelKeys.find((key, index) => levelKeys.indexOf(key) !== index)
  if (duplicatedKey) errors.push(`关卡 key 重复：${duplicatedKey}`)

  chapter.levels.forEach((level, index) => {
    validateLevel(level).forEach((error) => errors.push(`第 ${index + 1} 关：${error}`))
  })

  return errors
}

export default function ChallengeDesigner({ initialChapters }: Props) {
  const initialDesignerChapters = useMemo(
    () => initialChapters.map(toDesignerChapter),
    [initialChapters]
  )
  const [chapters, setChapters] = useState<DesignerChapter[]>(initialDesignerChapters)
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0)
  const [selectedLevelIndex, setSelectedLevelIndex] = useState(0)
  const [testCode, setTestCode] = useState(initialDesignerChapters[0]?.levels[0]?.initialCode || '')
  const [testState, setTestState] = useState<TestState>({
    running: false,
    result: null,
    error: '',
  })
  const [message, setMessage] = useState('')
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  const selectedChapter = chapters[selectedChapterIndex] || chapters[0]
  const selectedLevel = selectedChapter?.levels[selectedLevelIndex] || selectedChapter?.levels[0]
  const chapterErrors = selectedChapter ? validateChapter(selectedChapter) : []

  useEffect(() => {
    const rawDraft = window.localStorage.getItem(STORAGE_KEY)
    if (!rawDraft) return

    try {
      const draft = JSON.parse(rawDraft) as DesignerChapter[]
      if (Array.isArray(draft) && draft.length > 0) {
        setChapters(draft)
        setTestCode(draft[0]?.levels[0]?.initialCode || '')
        setMessage('已载入浏览器草稿')
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (!selectedLevel) return
    setTestCode(selectedLevel.initialCode)
    setTestState({ running: false, result: null, error: '' })
  }, [selectedChapterIndex, selectedLevelIndex, selectedLevel?.key])

  const updateSelectedChapter = (patch: Partial<DesignerChapter>) => {
    setChapters((current) =>
      current.map((chapter, index) =>
        index === selectedChapterIndex ? { ...chapter, ...patch } : chapter
      )
    )
  }

  const updateSelectedLevel = (patch: Partial<DesignerLevel>) => {
    setChapters((current) =>
      current.map((chapter, chapterIndex) => {
        if (chapterIndex !== selectedChapterIndex) return chapter

        return {
          ...chapter,
          levels: chapter.levels.map((level, levelIndex) =>
            levelIndex === selectedLevelIndex ? { ...level, ...patch } : level
          ),
        }
      })
    )
  }

  const addChapter = () => {
    setChapters((current) => [...current, makeNewChapter(current.length)])
    setSelectedChapterIndex(chapters.length)
    setSelectedLevelIndex(0)
    setMessage('已新增闯关任务')
  }

  const addLevel = () => {
    if (!selectedChapter) return

    setChapters((current) =>
      current.map((chapter, index) =>
        index === selectedChapterIndex
          ? { ...chapter, levels: [...chapter.levels, makeNewLevel(chapter.levels.length)] }
          : chapter
      )
    )
    setSelectedLevelIndex(selectedChapter.levels.length)
    setMessage('已新增关卡')
  }

  const duplicateLevel = () => {
    if (!selectedChapter || !selectedLevel) return
    const copy: DesignerLevel = {
      ...selectedLevel,
      key: `${selectedLevel.key}-copy`,
      title: `${selectedLevel.title} 副本`,
    }

    setChapters((current) =>
      current.map((chapter, chapterIndex) =>
        chapterIndex === selectedChapterIndex
          ? {
              ...chapter,
              levels: [
                ...chapter.levels.slice(0, selectedLevelIndex + 1),
                copy,
                ...chapter.levels.slice(selectedLevelIndex + 1),
              ],
            }
          : chapter
      )
    )
    setSelectedLevelIndex(selectedLevelIndex + 1)
    setMessage('已复制当前关卡')
  }

  const removeLevel = () => {
    if (!selectedChapter || selectedChapter.levels.length <= 1) {
      setMessage('至少保留 1 个关卡')
      return
    }

    setChapters((current) =>
      current.map((chapter, chapterIndex) =>
        chapterIndex === selectedChapterIndex
          ? {
              ...chapter,
              levels: chapter.levels.filter((_, levelIndex) => levelIndex !== selectedLevelIndex),
            }
          : chapter
      )
    )
    setSelectedLevelIndex(Math.max(0, selectedLevelIndex - 1))
    setMessage('已删除关卡')
  }

  const saveDraft = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters))
    setMessage('草稿已保存到当前浏览器')
  }

  const resetDraft = () => {
    window.localStorage.removeItem(STORAGE_KEY)
    setChapters(initialDesignerChapters)
    setSelectedChapterIndex(0)
    setSelectedLevelIndex(0)
    setTestCode(initialDesignerChapters[0]?.levels[0]?.initialCode || '')
    setMessage('已恢复为系统内置模板')
  }

  const exportJson = () => {
    if (!selectedChapter) return
    const errors = validateChapter(selectedChapter)
    if (errors.length > 0) {
      setMessage(`导出前请先修正：${errors[0]}`)
      return
    }

    const content = formatJson(toExportChapter(selectedChapter))
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedChapter.key || 'challenge'}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage('已导出当前任务 JSON')
  }

  const importJson = () => {
    try {
      const imported = JSON.parse(importText) as ChallengeChapterDefinition | ChallengeChapterDefinition[]
      const importedChapters = (Array.isArray(imported) ? imported : [imported]).map(toDesignerChapter)
      if (importedChapters.length === 0) {
        setMessage('导入内容不能为空')
        return
      }
      setChapters(importedChapters)
      setSelectedChapterIndex(0)
      setSelectedLevelIndex(0)
      setShowImport(false)
      setImportText('')
      setMessage('导入成功')
    } catch (error) {
      setMessage(error instanceof Error ? `导入失败：${error.message}` : '导入失败')
    }
  }

  const runTest = async () => {
    if (!selectedChapter || !selectedLevel) return

    const errors = validateLevel(selectedLevel)
    if (errors.length > 0) {
      setTestState({ running: false, result: null, error: errors[0] })
      return
    }

    setTestState({ running: true, result: null, error: '' })

    try {
      const result = await judgeChallengeWithLocalRunner({
        code: testCode,
        chapterTitle: selectedChapter.title,
        levelTitle: selectedLevel.title,
        judge: buildJudge(selectedLevel),
      })
      setTestState({ running: false, result, error: '' })
    } catch (error) {
      setTestState({
        running: false,
        result: null,
        error: error instanceof Error ? error.message : '测试运行失败',
      })
    }
  }

  if (!selectedChapter || !selectedLevel) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
        暂无可编辑的代码闯关任务。
      </div>
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">任务列表</h2>
            <button
              type="button"
              onClick={addChapter}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800"
            >
              新建任务
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {chapters.map((chapter, index) => (
              <button
                key={`${chapter.key}-${index}`}
                type="button"
                onClick={() => {
                  setSelectedChapterIndex(index)
                  setSelectedLevelIndex(0)
                }}
                className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition ${
                  index === selectedChapterIndex
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="block font-medium">{chapter.title || '未命名任务'}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {chapter.theme || '未设置主题'} · {chapter.levels.length} 关
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">关卡</h2>
            <button
              type="button"
              onClick={addLevel}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
            >
              新增关卡
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {selectedChapter.levels.map((level, index) => (
              <button
                key={`${level.key}-${index}`}
                type="button"
                onClick={() => setSelectedLevelIndex(index)}
                className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition ${
                  index === selectedLevelIndex
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="block font-medium">第 {index + 1} 关</span>
                <span className="mt-1 block truncate text-xs text-slate-500">
                  {level.title || '未命名关卡'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="space-y-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">设计与发布准备</h2>
              <p className="mt-1 text-sm text-slate-600">
                编辑任务结构、配置判题规则，并在右侧测试代码是否能通过当前关卡。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveDraft}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                保存草稿
              </button>
              <button
                type="button"
                onClick={exportJson}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                导出 JSON
              </button>
              <button
                type="button"
                onClick={() => setShowImport((current) => !current)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                导入
              </button>
              <button
                type="button"
                onClick={resetDraft}
                className="rounded-lg border border-rose-200 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
              >
                恢复模板
              </button>
            </div>
          </div>

          {message && <div className="mt-4 text-sm text-slate-600">{message}</div>}

          {chapterErrors.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {chapterErrors[0]}
            </div>
          )}

          {showImport && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="text-sm font-medium text-slate-800">粘贴任务 JSON</label>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                className="mt-2 h-40 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="支持单个 ChallengeChapterDefinition 或数组"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={importJson}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                >
                  确认导入
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-6">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-base font-semibold text-slate-900">任务信息</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">任务 key</span>
                  <input
                    value={selectedChapter.key}
                    onChange={(event) => updateSelectedChapter({ key: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">主题标签</span>
                  <input
                    value={selectedChapter.theme}
                    onChange={(event) => updateSelectedChapter({ theme: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">任务标题</span>
                  <input
                    value={selectedChapter.title}
                    onChange={(event) => updateSelectedChapter({ title: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">任务描述</span>
                  <textarea
                    value={selectedChapter.description}
                    onChange={(event) => updateSelectedChapter({ description: event.target.value })}
                    className="mt-1 h-24 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900">关卡内容</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={duplicateLevel}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    复制关卡
                  </button>
                  <button
                    type="button"
                    onClick={removeLevel}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    删除关卡
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">关卡 key</span>
                  <input
                    value={selectedLevel.key}
                    onChange={(event) => updateSelectedLevel({ key: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">积分</span>
                  <input
                    type="number"
                    min={0}
                    value={selectedLevel.points}
                    onChange={(event) =>
                      updateSelectedLevel({ points: Number(event.target.value) })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">关卡标题</span>
                  <input
                    value={selectedLevel.title}
                    onChange={(event) => updateSelectedLevel({ title: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">摘要</span>
                  <input
                    value={selectedLevel.summary}
                    onChange={(event) => updateSelectedLevel({ summary: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">任务说明</span>
                  <textarea
                    value={selectedLevel.description}
                    onChange={(event) => updateSelectedLevel({ description: event.target.value })}
                    className="mt-1 h-32 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-slate-700">初始代码</span>
                  <textarea
                    value={selectedLevel.initialCode}
                    onChange={(event) => updateSelectedLevel({ initialCode: event.target.value })}
                    className="mt-1 h-44 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm leading-6 text-slate-100 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    spellCheck={false}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-base font-semibold text-slate-900">判题配置</h3>
              <div className="mt-4">
                <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
                  {(['VARIABLES', 'OUTPUT'] as JudgeMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateSelectedLevel({ judgeMode: mode })}
                      className={`rounded-md px-4 py-2 text-sm ${
                        selectedLevel.judgeMode === mode
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mode === 'VARIABLES' ? '变量判题' : '输出判题'}
                    </button>
                  ))}
                </div>
              </div>

              {selectedLevel.judgeMode === 'VARIABLES' ? (
                <label className="mt-4 block text-sm">
                  <span className="font-medium text-slate-700">期望变量 JSON</span>
                  <textarea
                    value={selectedLevel.expectedVariablesJson}
                    onChange={(event) =>
                      updateSelectedLevel({ expectedVariablesJson: event.target.value })
                    }
                    className="mt-1 h-52 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-sm leading-6 text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    spellCheck={false}
                  />
                </label>
              ) : (
                <label className="mt-4 block text-sm">
                  <span className="font-medium text-slate-700">期望输出</span>
                  <textarea
                    value={selectedLevel.expectedOutput}
                    onChange={(event) => updateSelectedLevel({ expectedOutput: event.target.value })}
                    className="mt-1 h-52 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-sm leading-6 text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    spellCheck={false}
                  />
                </label>
              )}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">测试运行</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    使用当前判题配置运行测试代码，结果只用于教师设计验证。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTestCode(selectedLevel.initialCode)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    使用初始代码
                  </button>
                  <button
                    type="button"
                    onClick={runTest}
                    disabled={testState.running}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {testState.running ? '测试中...' : '运行测试'}
                  </button>
                </div>
              </div>

              <textarea
                value={testCode}
                onChange={(event) => setTestCode(event.target.value)}
                className="mt-4 h-64 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm leading-6 text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                spellCheck={false}
              />

              {testState.error && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {testState.error}
                </div>
              )}

              {testState.result && (
                <div
                  className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                    testState.result.passed
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  <div className="font-medium">{testState.result.message}</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase text-slate-500">stdout</div>
                      <pre className="mt-1 min-h-24 overflow-auto rounded-lg bg-white p-3 text-xs text-slate-800">
                        {testState.result.stdout || '无输出'}
                      </pre>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-slate-500">stderr</div>
                      <pre className="mt-1 min-h-24 overflow-auto rounded-lg bg-white p-3 text-xs text-slate-800">
                        {testState.result.stderr || '无错误'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
