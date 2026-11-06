import { useState } from 'react'
import type { Finish } from '@/components/scene/models/configure'
import { ArtGroup } from './ArtDrop'
import { ChoiceOptions } from './ChoiceControls'
import { addToCart, lookupCep, shippingRates, trackAndGoToCart, type ShippingRate } from './commerce'
import type { CustomArt } from './customArt'
import type { PhotoError } from './gqphoto'
import { COLOR_LABEL, FINISH_LABEL } from './labels'
import { hasFrame, money, sizeLabel, takesGlass, type Choice, type ShopData } from './shop'

interface BuyPanelProps {
  shop: ShopData
  choice: Choice
  onPick: (next: Partial<Choice>) => void
  finishes: Finish[]
  sizes: string[]
  /** A variante da escolha: [id, Tamanho, Moldura, Cor, preço em centavos, disponível] */
  variant: ShopData['variants'][number] | undefined
  /** Personalizado: a foto do cliente */
  custom?: CustomArt
}

/**
 * A compra, no fim da história: entra ao lado do quadro (no celular, por cima, como uma folha
 * que sobe), com as mesmas escolhas do topo, preço, frete e o botão de comprar.
 */
export function BuyPanel({ shop, choice, onPick, finishes, sizes, variant, custom }: BuyPanelProps) {
  const options = { shop, choice, onPick, finishes, sizes }
  const price = variant?.[4] ?? null
  const glassOk = takesGlass(choice.finish)
  const photo = custom?.on ? custom : undefined
  const { buy, busy, error, available } = useBuy(shop, variant, photo)
  const sending = busy && photo?.progress != null
  const { pixPrice, installment } = paymentOf(shop, price)

  return (
    <div className="pointer-events-auto relative rounded-t-[2rem] bg-[#fbf9f5]/95 px-5 pt-8 pb-12 shadow-[0_-24px_60px_-40px_rgba(42,37,32,0.5)] backdrop-blur md:rounded-none md:bg-transparent md:px-10 md:pt-[12vh] md:pb-24 md:shadow-none md:backdrop-blur-none lg:px-16">
      <p className="text-[11px] font-semibold tracking-[0.28em] text-[#8a7d6c] uppercase">Quadro decorativo · Edição especial</p>
      <h2 className="mt-3 text-[1.75rem] leading-[1.1] font-light tracking-tight md:text-[2.6rem]">{shop.product.title}</h2>
      {shop.rating && (
        <a href="#avaliacoes" className="mt-3 inline-flex items-center gap-2 text-sm text-[#5a534e]">
          <span className="tracking-[0.12em] text-[#c85f12]">{stars(shop.rating.score)}</span>
          {shop.rating.score.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} · {shop.rating.total} avaliações da loja no Google
        </a>
      )}

      <div className="mt-6 border-t border-[#e4dccf] pt-6">
        <p className="text-[2.4rem] leading-none font-semibold tracking-tight">{price === null ? 'Indisponível' : money(price)}</p>
        {pixPrice !== null && (
          <p className="mt-2 text-sm text-[#5a534e]">
            <b className="font-semibold text-[#2a2520]">{money(pixPrice)}</b> no Pix ({shop.pix}% de desconto)
          </p>
        )}
        {installment !== null && (
          <p className="mt-1 text-sm text-[#5a534e]">
            ou em até {shop.installments}× de {money(installment)} sem juros
          </p>
        )}
      </div>

      <div className="mt-8 space-y-6">
        {photo && <ArtGroup custom={photo} />}
        <Group title="Tamanho (cm)" value={sizeLabel(choice.size, shop.art)}>
          <ChoiceOptions kind="tamanho" {...options} />
        </Group>
        <Group title="Moldura" value={FINISH_LABEL[choice.finish]}>
          <ChoiceOptions kind="moldura" {...options} />
        </Group>
        {glassOk && (
          <Group title="Vidro" value={choice.glass ? 'Com vidro' : 'Sem vidro'}>
            <ChoiceOptions kind="vidro" {...options} />
          </Group>
        )}
        {hasFrame(choice.finish) ? (
          <Group title="Cor da moldura" value={COLOR_LABEL[choice.color].name}>
            <ChoiceOptions kind="cor" {...options} />
          </Group>
        ) : (
          <p className="rounded-xl bg-[#f1ebe2] px-4 py-3 text-[13px] leading-relaxed text-[#5a534e]">
            Sem moldura: só a impressão aplicada numa placa de MDF, sem vidro e sem estrutura para pendurar.
          </p>
        )}
      </div>

      <Shipping shop={shop} variantId={variant?.[0] ?? null} />

      <button
        type="button"
        onClick={buy}
        disabled={!available || busy}
        className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-[#2a2520] text-sm font-semibold tracking-[0.18em] text-white uppercase transition hover:bg-[#c85f12] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {buyLabel(busy, available, photo)}
      </button>
      {sending && (
        <button type="button" onClick={photo?.cancel} className="mt-2 flex h-11 w-full items-center justify-center text-[13px] text-[#5a534e] underline underline-offset-4">
          Cancelar envio
        </button>
      )}
      {error && <p className="mt-3 text-center text-[13px] text-[#a3441a]" aria-live="polite">{error}</p>}

      <ul className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] leading-snug text-[#5a534e]">
        <li className="rounded-xl border border-[#e4dccf] px-2 py-3">Envio em 48h úteis</li>
        <li className="rounded-xl border border-[#e4dccf] px-2 py-3">Fábrica própria</li>
        <li className="rounded-xl border border-[#e4dccf] px-2 py-3">7 dias para devolver</li>
      </ul>
    </div>
  )
}

/** Texto do botão de comprar (com a foto: pedir a foto e mostrar o envio) */
function buyLabel(busy: boolean, available: boolean, photo: CustomArt | undefined): string {
  if (busy) return photo?.progress != null ? `Enviando sua foto… ${photo.progress}%` : 'Adicionando…'
  if (!available) return 'Indisponível'
  if (photo?.required && !photo.slot) return 'Envie sua foto'
  return 'Adicionar ao carrinho'
}

/**
 * Comprar a variante: põe no carrinho e segue para ele (também usado pela página imersiva).
 * Personalizado (`photo`): sem a foto, quando ela é obrigatória, o botão abre o seletor; com ela,
 * o item vai com a foto (no envio 's3', espera a foto terminar de subir).
 */
export function useBuy(shop: ShopData, variant: ShopData['variants'][number] | undefined, photo?: CustomArt) {
  const available = Boolean(variant && variant[5])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const buy = async () => {
    if (!variant || !available || busy) return
    if (!shop.cartRoot) {
      setError('Na página da loja este botão coloca o quadro no carrinho.')
      return
    }
    if (photo?.required && !photo.slot) {
      setError(null)
      photo.choose()
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (photo) {
        await photo.prepare()
        await addToCart(shop.cartRoot, variant[0], () => photo.send(variant[0]))
      } else {
        await addToCart(shop.cartRoot, variant[0])
      }
      trackAndGoToCart(shop.cartRoot, shop.product, variant[4])
    } catch (failure) {
      setBusy(false)
      const message = (failure as PhotoError & { message?: string }) ?? {}
      // Cancelou o envio: nada entrou na sacola; dá para tentar de novo
      if (message.canceled) return
      setError(message.description || message.message || 'Não deu para adicionar ao carrinho. Tente de novo.')
    }
  }
  return { buy, busy, error, available }
}

/** Preço no Pix e da parcela (centavos), como na página de produto */
export function paymentOf(shop: ShopData, price: number | null) {
  return {
    pixPrice: price !== null && shop.pix > 0 ? Math.round(price * (1 - shop.pix / 100)) : null,
    installment: price !== null && shop.installments > 1 ? Math.round(price / shop.installments) : null,
  }
}

/** Estrelas cheias e vazias, como na página de produto atual (4,6 → ★★★★☆) */
export function stars(score: number): string {
  const full = Math.min(5, Math.floor(score + 0.25))
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

function Group({ title, value, children }: { title: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 flex items-baseline justify-between text-[11px] font-semibold tracking-[0.24em] text-[#8a7d6c] uppercase">
        {title}
        <span className="text-xs font-medium tracking-normal text-[#2a2520] normal-case">{value}</span>
      </p>
      {children}
    </div>
  )
}

/** Frete pelo CEP: as tarifas da loja para a variante escolhida. `compact`: numa linha só, sem título (página imersiva) */
export function Shipping({ shop, variantId, compact }: { shop: ShopData; variantId: number | null; compact?: boolean }) {
  const [cep, setCep] = useState('')
  const [state, setState] = useState<{ place?: string; rates?: ShippingRate[]; error?: string; busy?: boolean }>({})

  const quote = async () => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return setState({ error: 'Digite o CEP com 8 números.' })
    if (!shop.cartRoot || variantId === null) return setState({ error: 'O frete é calculado na página da loja.' })
    setState({ busy: true })
    const place = await lookupCep(digits)
    try {
      const rates = await shippingRates(shop.cartRoot, variantId, digits, place?.uf ?? '')
      setState({ place: place ? `${place.city}/${place.uf}` : undefined, rates, error: rates.length ? undefined : 'Sem opção de envio para este CEP.' })
    } catch {
      setState({ error: 'Não deu para calcular agora. Tente de novo.' })
    }
  }

  return (
    <div className={compact ? 'mt-3.5' : 'mt-8 rounded-2xl border border-[#e4dccf] bg-white/70 p-4'}>
      <p className={`text-[11px] font-semibold tracking-[0.24em] text-[#8a7d6c] uppercase ${compact ? 'sr-only' : ''}`}>Frete e prazo</p>
      <form
        className={`flex gap-2 ${compact ? '' : 'mt-3'}`}
        onSubmit={(event) => {
          event.preventDefault()
          quote()
        }}
      >
        <input
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder={compact ? 'CEP para frete e prazo' : '00000-000'}
          aria-label="CEP"
          value={cep}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 8)
            setCep(digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits)
          }}
          className={`min-w-0 flex-1 rounded-full border border-[#d9cfc1] bg-white px-4 outline-none focus:border-[#2a2520] ${compact ? 'h-10 text-[13px]' : 'h-11 text-sm'}`}
        />
        <button type="submit" disabled={state.busy} className={`rounded-full border border-[#2a2520] px-5 text-xs font-semibold tracking-[0.12em] uppercase disabled:opacity-50 ${compact ? 'h-10' : 'h-11'}`}>
          {state.busy ? '…' : 'Calcular'}
        </button>
      </form>
      {state.error && <p className="mt-3 text-[13px] text-[#a3441a]">{state.error}</p>}
      {state.rates && state.rates.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {state.place && <li className="text-xs text-[#8a7d6c]">{state.place}</li>}
          {state.rates.map((rate) => (
            <li key={rate.name} className="flex justify-between gap-3">
              <span>
                {rate.name}
                {rate.days !== null && <span className="text-[#8a7d6c]"> · até {rate.days} dias úteis</span>}
              </span>
              <b className="font-semibold">{rate.price === 0 ? 'Grátis' : money(rate.price)}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
