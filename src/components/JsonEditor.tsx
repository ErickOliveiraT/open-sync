import { useRef } from 'react'

// VS Code dark+ colour scheme
const C = {
  key:     '#9cdcfe', // object keys
  string:  '#ce9178', // string values
  number:  '#b5cea8', // numbers
  keyword: '#569cd6', // true / false / null
  default: '#d4d4d4', // punctuation / whitespace
}

function highlight(raw: string): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped.replace(
    /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*")\s*:|("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, key, str, keyword, num) => {
      if (key !== undefined)     return `<span style="color:${C.key}">${key}</span>:`
      if (str !== undefined)     return `<span style="color:${C.string}">${str}</span>`
      if (keyword !== undefined) return `<span style="color:${C.keyword}">${match}</span>`
      if (num !== undefined)     return `<span style="color:${C.number}">${match}</span>`
      return match
    },
  )
}

interface Props {
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  rows?: number
  placeholder?: string
}

const FONT = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.75rem', lineHeight: '1.5' }
const PAD  = { padding: '0.625rem 0.75rem' }

export default function JsonEditor({ value, onChange, invalid, rows = 4, placeholder }: Props) {
  const preRef = useRef<HTMLPreElement>(null)
  const taRef  = useRef<HTMLTextAreaElement>(null)

  function syncScroll() {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop  = taRef.current.scrollTop
      preRef.current.scrollLeft = taRef.current.scrollLeft
    }
  }

  const minH = `${rows * 1.5 + 1.25}rem`

  return (
    <div
      className={`relative rounded-lg overflow-hidden border ${invalid ? 'border-red-500' : 'border-slate-600'}`}
      style={{ background: '#1e1e1e', minHeight: minH }}
    >
      {/* Highlighted layer */}
      <pre
        ref={preRef}
        aria-hidden
        className="absolute inset-0 m-0 overflow-hidden pointer-events-none whitespace-pre-wrap break-words"
        style={{ ...FONT, ...PAD, color: C.default, background: 'transparent' }}
        dangerouslySetInnerHTML={{ __html: highlight(value) + '\n' }}
      />

      {/* Editable layer */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        rows={rows}
        placeholder={placeholder}
        spellCheck={false}
        className="relative w-full bg-transparent resize-y outline-none placeholder-slate-600"
        style={{ ...FONT, ...PAD, color: 'transparent', caretColor: '#ffffff', minHeight: minH }}
      />
    </div>
  )
}
