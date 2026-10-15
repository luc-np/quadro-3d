import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { Finish } from '@/components/scene/models/configure'
import { FRAME_COLORS } from '@/components/scene/models/surfaces'
import { paymentOf, Shipping, stars, useBuy } from '@/components/especial/BuyPanel'
import { FINISH_RICH_ORDER, FINISH_SPEC, finishPhoto } from '@/components/especial/finishPhotos'
import { COLOR_LABEL, FINISH_LABEL } from '@/components/especial/labels'
import { hasFrame, money, priceOf, sizeLabel, sizeMeters, takesGlass, type Choice, type ShopData } from '@/components/especial/shop'

interface HangTagProps {
  shop: ShopData
  choice: Choice
  onPick: (next: Partial<Choice>) => void
  finishes: Finish[]
  sizes: string[]
  /** A variante da escolha: [id, Tamanho, Moldura, Cor, preço em centavos, disponível] */
  variant: ShopData['variants'][number] | undefined
}

/**
 * Balanço da etiqueta pendurada, como um pêndulo (ângulo em graus): `stiffness` dá o ritmo (~1,4 s
 * por ida e volta), `damping` faz o balanço morrer em ~5 s; com o mouse em cima, a etiqueta
 * assenta reta em ~0,3 s (`settle`, por segundo). Ao abrir começa em `start` graus; ao tirar o
 * mouse, ganha `push` graus/s para o lado em que ele saiu.
 */
const SWAY = { stiffness: 20, damping: 1.2, settle: 10, start: 1.6, push: 5.5, delay: 500 }

/** Contorno da etiqueta: os cantos de cima cortados (onde fica o ilhós) e os de baixo quase retos */
const TAG_SHAPE = 'polygon(46px 0, calc(100% - 46px) 0, 100% 40px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 40px)'

/**
 * A compra da página imersiva como uma etiqueta pendurada (barbante, ilhós, cantos cortados):
 * nome, nota e preço no alto e as escolhas com imagens — a arte no tamanho, a foto da moldura,
 * a arte com e sem vidro e a moldura em cada cor —, o frete e o botão de comprar.
 */
export function HangTag({ shop, choice, onPick, finishes, sizes, variant }: HangTagProps) {
  const price = variant?.[4] ?? null
  const { buy, busy, error, available } = useBuy(shop, variant)
  const { pixPrice, installment } = paymentOf(shop, price)
  const frame = hasFrame(choice.finish)
  const frameColor = frame ? COLOR_LABEL[choice.color].swatch : null
  const words = (shop.product.short || shop.product.title).trim().split(/\s+/)
  const last = words.pop()
  const glassOk = takesGlass(choice.finish)
  const swayRef = useSway()

  return (
    // Pendurada: balança em volta do ponto onde o barbante está preso, no alto do palco (useSway)
    <div ref={swayRef} className="relative origin-[50%_-58px] drop-shadow-[0_22px_28px_rgba(42,37,32,0.2)]">
      <div className="relative bg-[#fbf8f2] px-4 pt-11 pb-4 text-[#2a2520] md:px-5" style={{ clipPath: TAG_SHAPE }}>
        {/* O furo do ilhós (o aro vem por cima do barbante, logo abaixo) */}
        <span aria-hidden className="absolute top-3 left-1/2 size-[22px] -translate-x-1/2 rounded-full bg-[#e4dcd0] shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)]" />

        <div className="text-center">
          <h1 className="text-[1.5rem] leading-[1.1] font-light tracking-tight md:text-[1.6rem]">
            {words.length > 0 && `${words.join(' ')} `}
            <em className="font-semibold text-[#c85f12] not-italic">{last}</em>
          </h1>
          {shop.rating && (
            <a href="#avaliacoes" className="mt-1 inline-block text-[11.5px] text-[#8a7d6c]">
              <span className="tracking-[0.1em] text-[#c85f12]">{stars(shop.rating.score)}</span> {shop.rating.score.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ·{' '}
              {shop.rating.total} avaliações da loja no Google
            </a>
          )}
          <p className="mt-2 flex items-baseline justify-center gap-2">
            <span className="text-[1.7rem] leading-none font-semibold tracking-tight">{price === null ? 'Indisponível' : money(price)}</span>
            {installment !== null && (
              <span className="text-[11.5px] text-[#8a7d6c]">
                {shop.installments}× de {money(installment)}
              </span>
            )}
          </p>
          {pixPrice !== null && (
            <p className="mt-1 text-[11.5px] font-semibold text-[#2f7d4f]">
              {money(pixPrice)} no Pix ({shop.pix}% de desconto)
            </p>
          )}
        </div>

        <div className="mt-3 border-t border-dashed border-[#e2d7c8]" />

        <Section title="Tamanho" value={`${sizeLabel(choice.size, shop.art)} cm`}>
          <div className="grid grid-cols-3 gap-1.5">
            {sizes.map((size) => {
              const sizePrice = priceOf(shop, { ...choice, size })
              return (
                <Option key={size} active={choice.size === size} disabled={sizePrice === null} onClick={() => onPick({ size })} className="flex items-center gap-1.5 px-1.5 py-1">
                  <span className="flex h-[30px] w-[22px] shrink-0 items-end justify-center">
                    <ArtThumb art={shop.art} frameColor={frameColor} size={sizeThumb(size, sizes, shop.art)} />
                  </span>
                  <span className="min-w-0 text-left leading-tight">
                    <b className="block text-[12px] font-semibold">{sizeLabel(size, shop.art)}</b>
                    <span className="block text-[10.5px] text-[#8a7d6c]">{sizePrice === null ? '—' : money(sizePrice)}</span>
                  </span>
                </Option>
              )
            })}
          </div>
        </Section>

        <Section title="Moldura" value={FINISH_SPEC[choice.finish]}>
          <FinishOptions shop={shop} choice={choice} onPick={onPick} finishes={finishes} />
        </Section>

        {glassOk && (
          <Section title="Vidro" value={choice.glass ? 'Protege em cozinha e área externa' : 'Indicado para sala e quarto'}>
            <GlassOptions shop={shop} choice={choice} onPick={onPick} />
          </Section>
        )}

        {frame ? (
          <Section title="Cor da moldura" value={COLOR_LABEL[choice.color].name}>
            <div className="flex gap-1.5">
              {FRAME_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-pressed={choice.color === color}
                  aria-label={`Moldura ${COLOR_LABEL[color].name}`}
                  title={COLOR_LABEL[color].name}
                  onClick={() => onPick({ color })}
                  className="h-10 min-w-0 flex-1 rounded-lg border-2 border-white bg-cover bg-center shadow-[0_0_0_1px_#e6ddd0] transition hover:shadow-[0_0_0_1px_#c85f12] aria-pressed:shadow-[0_0_0_2px_#d7622c]"
                  style={{ backgroundColor: COLOR_LABEL[color].swatch, backgroundImage: `url(${finishPhoto(choice.finish, color)})` }}
                />
              ))}
            </div>
          </Section>
        ) : (
          <p className="mt-3 rounded-lg bg-[#f1ebe2] px-3 py-2 text-[11.5px] leading-snug text-[#5a534e]">
            Sem moldura: só a impressão aplicada numa placa de MDF, sem vidro e sem estrutura para pendurar.
          </p>
        )}

        <Shipping shop={shop} variantId={variant?.[0] ?? null} compact />

        <button
          type="button"
          onClick={buy}
          disabled={!available || busy}
          className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-[#2f7d4f] text-[13px] font-semibold tracking-[0.16em] text-white uppercase transition hover:bg-[#256640] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Adicionando…' : available ? 'Adicionar ao carrinho' : 'Indisponível'}
        </button>
        {error && <p className="mt-2 text-center text-[12px] text-[#a3441a]">{error}</p>}
        <p className="mt-2 text-center text-[10.5px] text-[#8a7d6c]">Envio em 48h úteis · Fábrica própria · 7 dias para devolver</p>
      </div>
      {/* Aro do ilhós (o furo está no corpo da etiqueta, logo acima) */}
      <span aria-hidden className="pointer-events-none absolute top-3 left-1/2 size-[22px] -translate-x-1/2 rounded-full border-[3px] border-[#c9ad86] shadow-[0_1px_1px_rgba(0,0,0,0.15)]" />
      {/* Barbante (no computador): um cordão que desce do alto do palco e termina numa laçada que
          passa por cima do aro e entra no furo */}
      <svg aria-hidden viewBox="0 0 24 86" fill="none" className="pointer-events-none absolute -top-[58px] left-1/2 hidden h-[86px] w-6 -translate-x-1/2 md:block">
        <path
          d="M12 0V50M12 50C9.6 57 8.7 69 9.4 77C10 82.6 14 82.6 14.6 77C15.3 69 14.4 57 12 50"
          stroke="#8a6a4f"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12.45 0V48" stroke="#c4a684" strokeWidth="0.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/**
 * O balanço da etiqueta (só no computador, sem toque, e sem "reduzir movimento"): ao abrir, balança de leve e
 * para; com o mouse em cima, para; ao tirar o mouse, volta a balançar e para de novo
 */
function useSway() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    // Só no computador (tela larga, sem toque): no celular, deitado ou não, e no tablet ela fica parada
    const desktop = window.matchMedia('(min-width: 48rem)').matches && !window.matchMedia('(pointer: coarse)').matches
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !desktop) return
    let angle = SWAY.start
    let velocity = 0
    let holding = false
    let frame = 0
    let last = 0
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (holding) {
        // Mouse em cima: para de balançar e assenta reta
        velocity = 0
        angle *= Math.exp(-SWAY.settle * dt)
      } else {
        velocity += (-SWAY.stiffness * angle - SWAY.damping * velocity) * dt
        angle += velocity * dt
      }
      if (Math.abs(angle) < 0.004 && Math.abs(velocity) < 0.01) {
        angle = 0
        velocity = 0
        element.style.transform = ''
        frame = 0
        return
      }
      element.style.transform = `rotate(${angle.toFixed(3)}deg)`
      frame = requestAnimationFrame(step)
    }
    const run = () => {
      if (frame) return
      last = performance.now()
      frame = requestAnimationFrame(step)
    }
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      holding = true
      run()
    }
    const leave = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      holding = false
      // O empurrão vai para o lado em que o mouse saiu
      const box = element.getBoundingClientRect()
      velocity += event.clientX < box.left + box.width / 2 ? SWAY.push : -SWAY.push
      run()
    }
    element.style.transform = `rotate(${SWAY.start}deg)`
    const timer = window.setTimeout(run, SWAY.delay)
    element.addEventListener('pointerenter', enter)
    element.addEventListener('pointerleave', leave)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
      element.removeEventListener('pointerenter', enter)
      element.removeEventListener('pointerleave', leave)
      element.style.transform = ''
    }
  }, [])
  return ref
}

function Section({ title, value, children }: { title: string; value: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="shrink-0 text-[10.5px] font-bold tracking-[0.12em] uppercase">{title}</span>
        <span className="truncate text-[11px] text-[#8a7d6c]">{value}</span>
      </p>
      {children}
    </div>
  )
}

/** Botão de opção da etiqueta: o escolhido com a borda e o fundo laranja da página de produto */
function Option({
  active,
  disabled,
  onClick,
  onHover,
  className = '',
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  onHover?: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      onPointerEnter={onHover}
      onFocus={onHover}
      className={`min-w-0 rounded-[10px] border border-[#e6ddd0] bg-white transition hover:border-[#c85f12] disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-[#d7622c] aria-pressed:bg-[#fff4ea] aria-pressed:shadow-[inset_0_0_0_1px_#d7622c] ${className}`}
    >
      {children}
    </button>
  )
}

/** A arte em miniatura, com a moldura na cor escolhida (sem moldura, só a arte) */
function ArtThumb({ art, frameColor, size, style }: { art: ShopData['art']; frameColor: string | null; size: { width: number; height: number }; style?: CSSProperties }) {
  return (
    <span
      className="block shrink-0 overflow-hidden rounded-[1.5px] bg-[#e8e0d4] shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
      style={{ width: size.width, height: size.height, border: frameColor ? `1.5px solid ${frameColor}` : undefined, ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art.url} alt="" loading="lazy" className="block size-full object-cover" />
    </span>
  )
}

/** Tamanho da miniatura (px): a arte cresce com o tamanho, do menor (12 px) ao maior (28 px) */
function sizeThumb(size: string, sizes: string[], art: ShopData['art']) {
  const longest = (value: string) => {
    const { width, height } = sizeMeters(value, art)
    return Math.max(width, height)
  }
  const all = sizes.map(longest)
  const min = Math.min(...all)
  const max = Math.max(...all)
  const long = 12 + ((longest(size) - min) / (max - min || 1)) * 16
  const { width, height } = sizeMeters(size, art)
  return width >= height ? { width: long, height: (long * height) / width } : { width: (long * width) / height, height: long }
}

/** Acabamentos: a foto da moldura na cor escolhida, o nome e a diferença de preço para a placa */
function FinishOptions({ shop, choice, onPick, finishes }: { shop: ShopData; choice: Choice; onPick: (next: Partial<Choice>) => void; finishes: Finish[] }) {
  const base = priceOf(shop, { ...choice, finish: 'placa', glass: false })
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {FINISH_RICH_ORDER.filter((finish) => finishes.includes(finish)).map((finish) => {
        const finishPrice = priceOf(shop, { ...choice, finish, glass: false })
        const delta = finish === 'placa' || base === null || finishPrice === null ? null : finishPrice - base
        return (
          <Option key={finish} active={choice.finish === finish} disabled={finishPrice === null} onClick={() => onPick({ finish })} className="flex flex-col items-center p-1 pb-1.5 text-center">
            <span className="block aspect-[4/3] w-full rounded-md bg-[#e8e0d4] bg-cover bg-center" style={{ backgroundImage: `url(${finishPhoto(finish, choice.color)})` }} />
            <b className="mt-1 text-[11px] leading-tight font-semibold">{FINISH_LABEL[finish]}</b>
            <span className="text-[10px] font-semibold text-[#c85f12]">
              {finish === 'placa' ? 'base' : delta === null ? '—' : `${delta < 0 ? '−' : '+'}${money(Math.abs(delta)).replace(',00', '')}`}
            </span>
          </Option>
        )
      })}
    </div>
  )
}

/** Vidro: a arte em miniatura (com o reflexo, no "com vidro") e quanto o vidro soma */
function GlassOptions({ shop, choice, onPick }: { shop: ShopData; choice: Choice; onPick: (next: Partial<Choice>) => void }) {
  const without = priceOf(shop, { ...choice, glass: false })
  const withGlass = priceOf(shop, { ...choice, glass: true })
  const delta = without !== null && withGlass !== null ? withGlass - without : null
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {[false, true].map((glass) => (
        <Option key={String(glass)} active={choice.glass === glass} onClick={() => onPick({ glass })} className="flex items-center gap-2 px-1.5 py-1.5">
          <span className="relative block size-8 shrink-0 overflow-hidden rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shop.art.url} alt="" loading="lazy" className="block size-full object-cover" />
            {glass && <span className="absolute inset-0 bg-[linear-gradient(125deg,transparent_28%,rgba(255,255,255,0.7)_44%,transparent_60%)]" />}
          </span>
          <b className="text-[12px] font-semibold">{glass ? 'Com vidro' : 'Sem vidro'}</b>
          {glass && delta !== null && <span className="ml-auto text-[10.5px] font-semibold text-[#c85f12]">+{money(delta).replace(',00', '')}</span>}
        </Option>
      ))}
    </div>
  )
}
