import type { UIMessage } from 'ai'

interface MessageBubbleProps {
  message: UIMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-slate-900 text-white'
            : 'rounded-bl-sm bg-slate-100 text-slate-900'
        }`}
      >
        {message.parts.map((part, i) =>
          part.type === 'text' ? (
            <span key={i} className="whitespace-pre-wrap">
              {part.text}
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}
