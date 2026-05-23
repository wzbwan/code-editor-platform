interface QuestionContentProps {
  content: string
  className?: string
}

type ContentBlock =
  | {
      type: 'text'
      value: string
    }
  | {
      type: 'code'
      value: string
      language: string
    }

function parseFencedCodeBlocks(content: string): ContentBlock[] {
  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const blocks: ContentBlock[] = []
  let textLines: string[] = []
  let codeLines: string[] = []
  let codeLanguage = ''
  let inCodeBlock = false

  const flushText = () => {
    const value = textLines.join('\n').trim()
    if (value) {
      blocks.push({ type: 'text', value })
    }
    textLines = []
  }

  const flushCode = () => {
    blocks.push({
      type: 'code',
      value: codeLines.join('\n').replace(/\n+$/, ''),
      language: codeLanguage,
    })
    codeLines = []
    codeLanguage = ''
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCode()
        inCodeBlock = false
      } else {
        flushText()
        codeLanguage = trimmed.slice(3).trim()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
    } else {
      textLines.push(line)
    }
  }

  if (inCodeBlock) {
    flushCode()
  } else {
    flushText()
  }

  return blocks.length > 0 ? blocks : [{ type: 'text', value: content }]
}

export default function QuestionContent({ content, className = '' }: QuestionContentProps) {
  const blocks = parseFencedCodeBlocks(content)

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, index) =>
        block.type === 'code' ? (
          <div
            key={`${block.type}-${index}`}
            className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950"
          >
            {block.language && (
              <div className="border-b border-slate-800 px-4 py-2 font-mono text-xs text-slate-400">
                {block.language}
              </div>
            )}
            <pre className="overflow-x-auto px-4 py-3 text-sm leading-6 text-slate-100">
              <code>{block.value}</code>
            </pre>
          </div>
        ) : (
          <div key={`${block.type}-${index}`} className="whitespace-pre-wrap leading-7 text-slate-800">
            {block.value}
          </div>
        )
      )}
    </div>
  )
}
