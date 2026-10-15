import { useState, type ReactNode, type RefObject } from 'react'
import type { Finish } from '@/components/scene/models/configure'
import type { PartDef } from '@/components/scene/models/types'
import { ChoiceOptions } from './ChoiceControls'
import { CHOICE_TITLE, CHOICES, COLOR_LABEL, FINISH_SHORT, type ChoiceKey } from './labels'
import { hasFrame, money, sizeLabel, takesGlass, type Choice, type ShopData } from './shop'
import { PACK_STEPS, PHRASES } from './story'

interface OverlayProps {
  shop: ShopData
  choice: Choice
  onPick: (next: Partial<Choice>) => void
  finishes: Finish[]
  sizes: string[]
  /** Preço da variante escolhida (centavos), se a combinação existir */
  price: number | null
  rootRef: RefObject<HTMLDivElement | null>
  /** Partes do quadro, da frente para o fundo: a vista por dentro explica cada uma */
  parts: PartDef[]
  /** Com vidro, a embalagem tem as cantoneiras laterais */
  glass: boolean
  /** Botão "Avançar": rola a página até a próxima etapa da história */
  onAdvance: () => void
}

/**
 * O HTML por cima da cena: as escolhas do topo (com as linhas até as partes), as frases do
 * ambiente, os títulos da vista por dentro e da embalagem e a dica da vitrine. A animação acha
 * os elementos pelos atributos data-* e muda opacidade e posição a cada frame (StoryScene).
 */
export function Overlay({ shop, choice, onPick, finishes, sizes, price, rootRef, parts, glass, onAdvance }: OverlayProps) {
  // Celular: qual escolha a bandeja de baixo mostra
  const [tab, setTab] = useState<ChoiceKey>('moldura')
  const frame = hasFrame(choice.finish)
  const glassOk = takesGlass(choice.finish)
  const off: Record<ChoiceKey, string | undefined> = {
    moldura: undefined,
    tamanho: undefined,
    cor: frame ? undefined : 'Sem moldura não tem cor.',
    vidro: glassOk ? undefined : 'Vidro só em filete e caixa.',
  }
  const value: Record<ChoiceKey, string> = {
    moldura: FINISH_SHORT[choice.finish],
    tamanho: sizeLabel(choice.size, shop.art),
    cor: frame ? COLOR_LABEL[choice.color].name : '—',
    vidro: glassOk ? (choice.glass ? 'Com vidro' : 'Sem vidro') : '—',
  }
  const options = { shop, choice, onPick, finishes, sizes }
  const summary = [sizeLabel(choice.size, shop.art), FINISH_SHORT[choice.finish] + (glassOk && choice.glass ? ' com vidro' : ''), frame ? COLOR_LABEL[choice.color].name : null]
    .filter(Boolean)
    .join(' · ')

  const packSteps = PACK_STEPS.filter((step) => glass || !step.glassOnly)

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-40 text-[#2a2520]">
      {/* Topo: escolhas ligadas às partes do quadro */}
      <div data-hero className="absolute inset-0">
        <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {CHOICES.map((key) => (
            <g key={key} className={off[key] ? 'opacity-35' : ''}>
              <polyline
                data-line={key}
                pathLength={1}
                fill="none"
                strokeWidth={1}
                strokeDasharray={off[key] ? '0.012 0.012' : '1'}
                className={`${off[key] ? '' : 'especial-draw'} ${tab === key ? 'stroke-[#c85f12] md:stroke-[#2a2520]' : 'stroke-[#2a2520]'}`}
              />
              <circle data-dot={key} r={5} fill="#fff" stroke="#c85f12" strokeWidth={2} className="especial-pulse" />
            </g>
          ))}
        </svg>

        <div data-hero-title className="absolute top-8 left-1/2 w-full -translate-x-1/2 px-6 text-center md:top-[7%]">
          <h1 className="text-[1.75rem] leading-tight font-light tracking-tight md:text-6xl">
            O seu quadro, <em className="font-semibold text-[#c85f12] not-italic">do seu jeito</em>
          </h1>
          <p className="mt-1.5 text-xs text-[#8a7d6c] md:mt-3 md:text-base">
            {summary} · <b className="font-semibold text-[#2a2520]">{price === null ? 'indisponível' : money(price)}</b>
          </p>
        </div>

        {/* Computador: uma caixa por escolha, em volta do quadro */}
        <Panel id="cor" title="Cor da moldura" className="top-[27%] left-[7%]" disabled={!frame} note={off.cor && 'Sem moldura, sem cor'}>
          <ChoiceOptions kind="cor" {...options} />
        </Panel>
        <Panel id="vidro" title="Vidro" className="top-[60%] left-[7%]" disabled={!glassOk} note={off.vidro && 'Só em filete e caixa'}>
          <ChoiceOptions kind="vidro" {...options} />
        </Panel>
        <Panel id="moldura" title="Moldura" className="top-[27%] right-[7%]">
          <ChoiceOptions kind="moldura" short {...options} />
        </Panel>
        <Panel id="tamanho" title="Tamanho (cm)" className="top-[56%] right-[7%]">
          <ChoiceOptions kind="tamanho" {...options} />
        </Panel>

        {/* Celular: etiquetas à direita do quadro (a altura acompanha a parte) e as opções numa bandeja embaixo */}
        {CHOICES.map((key) => (
          <button
            key={key}
            type="button"
            data-panel={key}
            data-follow
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={`especial-panel pointer-events-auto absolute top-1/2 right-4 w-[6.5rem] rounded-xl border border-[#e4dccf] bg-white/85 px-3 py-2 text-left shadow-[0_10px_24px_-18px_rgba(42,37,32,0.6)] backdrop-blur transition-colors aria-pressed:border-[#c85f12] md:hidden ${off[key] ? 'opacity-60' : ''}`}
          >
            <span className="block text-[9px] font-semibold tracking-[0.24em] text-[#8a7d6c] uppercase">{CHOICE_TITLE[key]}</span>
            <span className="block truncate text-[13px] font-semibold">{value[key]}</span>
          </button>
        ))}
        <div
          data-tray
          className="especial-panel pointer-events-auto absolute inset-x-4 bottom-4 rounded-2xl border border-[#e4dccf] bg-white/90 p-3 shadow-[0_18px_40px_-24px_rgba(42,37,32,0.45)] backdrop-blur md:hidden"
        >
          <div role="tablist" aria-label="Escolhas" className="mb-3 grid grid-cols-4 gap-1 rounded-full bg-[#f1ebe2] p-1">
            {CHOICES.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className="rounded-full py-1.5 text-[9.5px] font-semibold tracking-[0.12em] text-[#8a7d6c] uppercase transition aria-selected:bg-white aria-selected:text-[#2a2520] aria-selected:shadow-sm"
              >
                {CHOICE_TITLE[key]}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="flex min-h-9 items-center">
            {off[tab] ? (
              <p className="flex w-full items-center justify-between gap-3 text-xs text-[#8a7d6c]">
                {off[tab]}
                <button type="button" onClick={() => setTab('moldura')} className="shrink-0 rounded-full border border-[#2a2520] px-3 py-1.5 font-medium text-[#2a2520]">
                  Trocar moldura
                </button>
              </p>
            ) : (
              <div className="w-full">
                <ChoiceOptions kind={tab} compact {...options} />
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Frases do ambiente */}
      {PHRASES.map((phrase, index) => (
        <div
          key={phrase.title}
          data-phrase={index}
          className="absolute top-[14%] left-6 isolate max-w-md opacity-0 md:top-[13%] md:left-[8%]"
        >
          {/* Névoa da cor da parede atrás da frase: legível mesmo sobre a planta ou os móveis da foto */}
          <span aria-hidden className="absolute -inset-x-10 -inset-y-8 -z-10 rounded-[3rem] bg-[#f4f1ec]/75 blur-2xl" />
          <p className="text-[1.9rem] leading-[1.05] font-light tracking-tight md:text-6xl">
            {phrase.title.split(' ').slice(0, -1).join(' ')}{' '}
            <em className="font-semibold text-[#c85f12] not-italic">{phrase.title.split(' ').slice(-1)}</em>
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#5a534e] md:mt-4 md:text-base">{phrase.text}</p>
        </div>
      ))}

      {/* Vista por dentro: cada parte explicada, com linha até ela */}
      <div data-explode-hint className="absolute top-6 left-6 max-w-sm opacity-0 md:top-[12%] md:left-[8%]">
        <p className="text-[1.7rem] leading-[1.05] font-light tracking-tight md:text-5xl">
          Por dentro <em className="font-semibold text-[#c85f12] not-italic">do quadro</em>
        </p>
        <p className="mt-2 text-sm text-[#5a534e] md:mt-4 md:text-base">Cada camada, da frente para o fundo.</p>
        {/* Computador: as explicações se acumulam embaixo do título */}
        <ol className="mt-8 hidden w-72 space-y-5 md:block">
          {parts.map((part) => (
            <li key={part.id} data-part-label={part.id} className="opacity-0">
              <p className="text-[11px] font-semibold tracking-[0.24em] text-[#8a7d6c] uppercase">{part.label}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#5a534e]">{part.description}</p>
            </li>
          ))}
        </ol>
        <AdvanceButton onClick={onAdvance} className="mt-8 hidden md:inline-flex" />
      </div>
      <svg data-part-leaders className="absolute inset-0 h-full w-full overflow-visible opacity-0" aria-hidden>
        {parts.map((part) => (
          <g key={part.id} data-part-leader={part.id} style={{ opacity: 0 }}>
            <polyline data-part-line={part.id} fill="none" stroke="#2a2520" strokeWidth={1} />
            <circle data-part-dot={part.id} r={5} fill="#fff" stroke="#c85f12" strokeWidth={2} />
          </g>
        ))}
      </svg>
      {/* Celular: uma parte por vez, num cartão embaixo */}
      <div className="absolute inset-x-4 bottom-4 md:hidden">
        {parts.map((part, index) => (
          <div key={part.id} data-part-label={part.id} data-single className="absolute inset-x-0 bottom-0 rounded-2xl bg-white/90 p-4 opacity-0 shadow-xl backdrop-blur">
            <p className="text-[10px] font-semibold tracking-[0.24em] text-[#8a7d6c] uppercase">
              {index + 1} de {parts.length} · {part.label}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#5a534e]">{part.description}</p>
            <CardFooter index={index} count={parts.length} onAdvance={onAdvance} />
          </div>
        ))}
      </div>

      {/* Embalagem: título e etapas com linhas até as peças */}
      <div data-pack-title className="absolute top-6 left-6 max-w-sm opacity-0 md:top-[12%] md:left-[8%]">
        <p className="text-[1.7rem] leading-[1.05] font-light tracking-tight md:text-5xl">
          Pronto para <em className="font-semibold text-[#c85f12] not-italic">viajar</em>
        </p>
        <p className="mt-2 text-sm text-[#5a534e] md:mt-4 md:text-base">Assim cada quadro sai da nossa fábrica.</p>
        {/* Computador: as etapas se acumulam embaixo do título */}
        <ol className="mt-10 hidden w-72 space-y-6 md:block">
          {packSteps.map(({ key, title, text }) => (
            <li key={key} data-pack-label={key} className="opacity-0">
              <p className="text-[11px] font-semibold tracking-[0.24em] text-[#8a7d6c] uppercase">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#5a534e]">{text}</p>
            </li>
          ))}
        </ol>
        <AdvanceButton onClick={onAdvance} className="mt-8 hidden md:inline-flex" />
      </div>
      <svg data-pack-leaders className="absolute inset-0 h-full w-full overflow-visible opacity-0" aria-hidden>
        {packSteps.map(({ key }) => (
          <g key={key} data-pack-leader={key} style={{ opacity: 0 }}>
            <polyline data-pack-line={key} fill="none" stroke="#2a2520" strokeWidth={1} />
            <circle data-pack-dot={key} r={5} fill="#fff" stroke="#c85f12" strokeWidth={2} />
          </g>
        ))}
      </svg>
      {/* Celular: uma etapa por vez, num cartão embaixo */}
      <div className="absolute inset-x-4 bottom-4 md:hidden">
        {packSteps.map(({ key, title, text }, index) => (
          <div key={key} data-pack-label={key} data-single className="absolute inset-x-0 bottom-0 rounded-2xl bg-white/90 p-4 opacity-0 shadow-xl backdrop-blur">
            <p className="text-[10px] font-semibold tracking-[0.24em] text-[#8a7d6c] uppercase">{title}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#5a534e]">{text}</p>
            <CardFooter index={index} count={packSteps.length} onAdvance={onAdvance} last={index === packSteps.length - 1} />
          </div>
        ))}
      </div>

      {/* Aviso de rolagem, a história toda: a posição (acima dos cartões de baixo) e o texto mudam por etapa */}
      <div data-scroll-cue className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 transition-opacity duration-300 md:bottom-6">
        <div className="flex items-center gap-2 rounded-full border border-[#e4dccf] bg-white/85 py-1.5 pr-2 pl-4 shadow-[0_8px_24px_-16px_rgba(42,37,32,0.6)] backdrop-blur">
          <span data-scroll-cue-text className="text-[10px] font-semibold tracking-[0.22em] whitespace-nowrap text-[#8a7d6c] uppercase md:text-[11px]">
            Role para ver na parede
          </span>
          <span className="flex size-6 animate-bounce items-center justify-center rounded-full bg-[#c85f12] text-[13px] text-white">↓</span>
        </div>
      </div>

      {/* Vitrine: o quadro gira arrastando */}
      <p
        data-showcase-hint
        className="absolute top-[52%] left-0 w-full text-center text-[10px] font-semibold tracking-[0.24em] text-[#8a7d6c] uppercase opacity-0 md:top-auto md:bottom-8 md:w-1/2 md:text-[11px]"
      >
        ↔ Arraste para girar
      </p>

    </div>
  )
}

interface PanelProps {
  id: ChoiceKey
  title: string
  className: string
  children: ReactNode
  disabled?: boolean
  note?: string
}

/** Caixa de uma escolha, em volta do quadro (só no computador) */
function Panel({ id, title, className, children, disabled, note }: PanelProps) {
  return (
    <div
      data-panel={id}
      className={`especial-panel pointer-events-auto absolute hidden w-72 rounded-2xl border border-[#e4dccf] bg-white/85 p-4 shadow-[0_18px_40px_-24px_rgba(42,37,32,0.45)] backdrop-blur md:block ${disabled ? 'opacity-60' : ''} ${className}`}
    >
      <p className="mb-3 flex items-baseline justify-between text-[11px] font-semibold tracking-[0.24em] text-[#8a7d6c] uppercase">
        {title}
        {note && <span className="text-[10px] font-medium tracking-normal normal-case">{note}</span>}
      </p>
      {children}
    </div>
  )
}

/** Rodapé dos cartões do celular: em que etapa está (pontos) e o botão que leva à próxima */
function CardFooter({ index, count, onAdvance, last }: { index: number; count: number; onAdvance: () => void; last?: boolean }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <span className="flex gap-1.5" aria-hidden>
        {Array.from({ length: count }, (_, dot) => (
          <span key={dot} className={`h-1.5 rounded-full transition-all ${dot === index ? 'w-4 bg-[#c85f12]' : 'w-1.5 bg-[#d9cfc1]'}`} />
        ))}
      </span>
      <AdvanceButton onClick={onAdvance} label={last ? 'Ver preço e comprar' : undefined} />
    </div>
  )
}

/** Botão "Avançar": a página rola sozinha até a próxima etapa (rolar com o dedo continua valendo) */
function AdvanceButton({ onClick, label = 'Avançar', className = 'inline-flex' }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} items-center gap-2 rounded-full bg-[#2a2520] py-2 pr-2 pl-4 text-[11px] font-semibold tracking-[0.16em] text-white uppercase shadow-sm transition hover:bg-[#c85f12]`}
    >
      {label}
      <span className="flex size-5 items-center justify-center rounded-full bg-[#c85f12] text-[12px]">↓</span>
    </button>
  )
}
