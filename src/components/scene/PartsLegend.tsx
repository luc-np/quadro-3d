import type { Ref } from 'react'
import type { PartDef } from './models/types'

interface PartsLegendProps {
  parts: PartDef[]
  ref?: Ref<HTMLOListElement>
  /** Posição e largura: quem usa decide */
  className?: string
  /** Itens já visíveis. Sem isso, começam ocultos e quem controla a cena os revela via `ref`. */
  revealed?: boolean
}

/**
 * Explicação de cada parte, numerada como os marcadores na cena. HTML real, sempre no DOM
 * (o leitor de tela lê mesmo quando a animação ainda não revelou). Em tela estreita, só os
 * rótulos aparecem; as descrições ficam para leitor de tela.
 * `role="list"` mantém a semântica de lista no Safari, que a descarta com `list-style: none`.
 */
export function PartsLegend({ parts, ref, className = '', revealed = false }: PartsLegendProps) {
  return (
    <ol ref={ref} role="list" aria-label="Partes do quadro" className={`flex flex-col gap-3 font-sans md:gap-6 ${className}`}>
      {parts.map((part, index) => (
        <li key={part.id} className={`flex gap-3 ${revealed ? '' : 'opacity-0'}`}>
          <span
            aria-hidden
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white"
          >
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-medium text-neutral-900 md:text-base">{part.label}</p>
            {/* Estreito: só o rótulo, para o quadro caber; a descrição segue legível para leitor de tela */}
            <p className="sr-only text-sm leading-relaxed text-neutral-600 md:not-sr-only md:mt-1">{part.description}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
