'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Highlight, themes } from 'prism-react-renderer'

interface CodeEditorProps {
  code: string
  onChange: (code: string) => void
  readOnly?: boolean
  className?: string
}

export default function CodeEditor({ code, onChange, readOnly = false, className = '' }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showWarning, setShowWarning] = useState(false)

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return

    if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      e.preventDefault()
      setShowWarning(true)
      setTimeout(() => setShowWarning(false), 2000)
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      const newCode = code.substring(0, start) + '    ' + code.substring(end)
      onChange(newCode)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4
        }
      }, 0)
    }
  }, [code, onChange, readOnly])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (readOnly) return
    e.preventDefault()
    setShowWarning(true)
    setTimeout(() => setShowWarning(false), 2000)
  }, [readOnly])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (readOnly) return
    e.preventDefault()
  }, [readOnly])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (readOnly) return
    onChange(e.target.value)
  }, [onChange, readOnly])

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (document.activeElement === textareaRef.current && !readOnly) {
        e.preventDefault()
        setShowWarning(true)
        setTimeout(() => setShowWarning(false), 2000)
      }
    }

    document.addEventListener('paste', handleGlobalPaste)
    return () => document.removeEventListener('paste', handleGlobalPaste)
  }, [readOnly])

  const lineCount = code.split('\n').length

  return (
    <div className={`relative ${className}`}>
      {showWarning && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
          禁止粘贴代码，请手动输入！
        </div>
      )}
      <div className="relative flex bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
        <div className="flex-shrink-0 bg-gray-800 text-gray-500 text-right select-none py-4 px-3 font-mono text-sm leading-6">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1}>{i + 1}</div>
          ))}
        </div>
        <div className="relative flex-1">
          <Highlight theme={themes.vsDark} code={code || ' '} language="python">
            {({ className: hlClassName, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className={`${hlClassName} absolute inset-0 p-4 m-0 overflow-auto font-mono text-sm leading-6 pointer-events-none`}
                style={{ ...style, background: 'transparent', margin: 0 }}
              >
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onContextMenu={handleContextMenu}
            spellCheck={false}
            readOnly={readOnly}
            className="relative w-full h-full min-h-[400px] p-4 bg-transparent text-transparent caret-white font-mono text-sm leading-6 resize-none focus:outline-none selection:bg-blue-500/30"
            style={{ caretColor: 'white' }}
            placeholder="在此输入Python代码..."
          />
        </div>
      </div>
    </div>
  )
}
