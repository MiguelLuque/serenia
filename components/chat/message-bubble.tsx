import type { UIMessage } from 'ai'
import { BrandOrb } from '@/components/brand/brand-mark'

interface MessageBubbleProps {
  message: UIMessage
  /** Muestra el orbe de Serenia: solo en el primer mensaje de cada grupo suyo. */
  showAvatar?: boolean
  /** Fundido de entrada para mensajes nuevos (no para el historial al cargar). */
  animate?: boolean
}

export function MessageBubble({ message, showAvatar = true, animate = false }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  const textParts = message.parts.filter(
    (p): p is Extract<typeof p, { type: 'text' }> =>
      p.type === 'text' && p.text.trim().length > 0,
  )

  if (textParts.length === 0) return null

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} ${animate ? 'chat-msg-in' : ''}`}>
      {!isUser && (
        showAvatar
          ? <BrandOrb className="mb-0.5 size-6" />
          : <span aria-hidden className="w-6 shrink-0" />
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[78%] ${
          isUser
            ? 'rounded-br-md bg-teal-700 text-white'
            : 'rounded-bl-md border border-stone-200 bg-white text-stone-800 shadow-[0_1px_2px_rgba(28,25,23,0.04)]'
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

/** Burbuja de «Serenia está escribiendo». Decorativa: el estado accesible lo da el aviso de estado del chat. */
export function TypingBubble() {
  return (
    <div aria-hidden className="chat-msg-in flex items-end gap-2.5">
      <BrandOrb className="mb-0.5 size-6" />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-stone-200 bg-white px-4 py-3.5">
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
      </div>
    </div>
  )
}
