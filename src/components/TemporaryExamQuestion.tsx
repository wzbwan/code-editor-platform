import type { PublicTemporaryPaper } from '@/lib/temporary-exam-paper'

export default function TemporaryExamQuestion({ question }: { question: PublicTemporaryPaper['questions'][number] }) {
  return <div className="space-y-3">
    <div className="flex items-start justify-between gap-4">
      <h3 className="whitespace-pre-wrap font-medium leading-7">{question.number}. {question.content}</h3>
      <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{question.score} 分</span>
    </div>
    {question.code && <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-sm leading-6 text-slate-100">{question.code}</pre>}
  </div>
}
