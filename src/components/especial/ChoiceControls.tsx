import type { ReactNode } from 'react'
import type { Finish } from '@/components/scene/models/configure'
import { FRAME_COLORS } from '@/components/scene/models/surfaces'
import { COLOR_LABEL, FINISH_LABEL, FINISH_ORDER, FINISH_SHORT, type ChoiceKey } from './labels'
import { hasFrame, sizeLabel, takesGlass, type Choice, type ShopData } from './shop'

/** Os botões de cada escolha: no topo (caixas e bandeja do celular) e no painel de compra */
interface OptionsProps {
  shop: ShopData
  choice: Choice
  onPick: (next: Partial<Choice>) => void
  /** Molduras e tamanhos que o produto tem */
  finishes: Finish[]
  sizes: string[]
  /** Menor, para a bandeja do celular */
  compact?: boolean
  /** Nomes curtos das molduras ("Canvas"), para caixas estreitas */
  short?: boolean
}

export function ChoiceOptions({ kind, ...props }: OptionsProps & { kind: ChoiceKey }) {
  const { shop, choice, onPick, finishes, sizes, compact, short } = props
  switch (kind) {
    case 'tamanho':
      return (
        <div className={`grid gap-1.5 ${compact ? 'grid-cols-6' : 'grid-cols-3'}`}>
          {sizes.map((size) => (
            <Chip key={size} compact={compact} active={choice.size === size} onClick={() => onPick({ size })}>
              {sizeLabel(size, shop.art)}
            </Chip>
          ))}
        </div>
      )
    case 'moldura':
      return (
        <div className={`grid gap-1.5 ${compact ? 'grid-cols-4' : 'grid-cols-2'}`}>
          {FINISH_ORDER.map((finish) => (
            <Chip key={finish} compact={compact} active={choice.finish === finish} disabled={!finishes.includes(finish)} onClick={() => onPick({ finish })}>
              {compact || short ? FINISH_SHORT[finish] : FINISH_LABEL[finish]}
            </Chip>
          ))}
        </div>
      )
    case 'cor': {
      const frame = hasFrame(choice.finish)
      return (
        // Quebra linha se faltar espaço: o nome da cor nunca vaza da caixa
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex gap-2">
            {FRAME_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                disabled={!frame}
                aria-pressed={choice.color === color}
                aria-label={COLOR_LABEL[color].name}
                title={COLOR_LABEL[color].name}
                onClick={() => onPick({ color })}
                className="size-8 rounded-full ring-1 ring-black/15 transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:ring-2 aria-pressed:ring-[#c85f12] aria-pressed:ring-offset-2"
                style={{ background: COLOR_LABEL[color].swatch }}
              />
            ))}
          </div>
          <p className="ml-auto text-xs whitespace-nowrap text-[#8a7d6c]">{frame ? COLOR_LABEL[choice.color].name : 'Sem moldura, sem cor'}</p>
        </div>
      )
    }
    case 'vidro': {
      const glassOk = takesGlass(choice.finish)
      return (
        <div className="grid grid-cols-2 gap-1.5">
          {[false, true].map((glass) => (
            <Chip key={String(glass)} compact={compact} active={choice.glass === glass && glassOk} disabled={!glassOk} onClick={() => onPick({ glass })}>
              {glass ? 'Com vidro' : 'Sem vidro'}
            </Chip>
          ))}
        </div>
      )
    }
  }
}

interface ChipProps {
  active: boolean
  disabled?: boolean
  /** Menor, para a bandeja do celular */
  compact?: boolean
  onClick: () => void
  children: ReactNode
}

export function Chip({ active, disabled, compact, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`min-w-0 truncate rounded-full border border-[#d9cfc1] font-medium whitespace-nowrap transition hover:border-[#2a2520] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#d9cfc1] aria-pressed:border-[#2a2520] aria-pressed:bg-[#2a2520] aria-pressed:text-white ${compact ? 'px-0.5 py-2 text-[10.5px] tracking-tight' : 'px-3 py-2 text-xs'}`}
    >
      {children}
    </button>
  )
}
