import type { UIMessage } from 'ai'

interface MessageBubbleProps {
  message: UIMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  const textParts = message.parts.filter(
    (p): p is Extract<typeof p, { type: 'text' }> =>
      p.type === 'text' && p.text.trim().length > 0,
  )

  if (textParts.length === 0) return null

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-slate-900 text-white'
            : 'rounded-bl-sm bg-slate-100 text-slate-900'
        }`}
      >
        {textParts.map((part, i) => (
          <span key={i} className="whitespace-pre-wrap">
            {part.text}
          </span>
        ))}
      </div>
    </div>
  )
}
