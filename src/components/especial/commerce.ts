/**
 * Carrinho e frete da loja (Shopify Ajax API), como na página de produto atual do tema
 * (assets/gq-pdp.js): a variante vai para /cart/add.js e a página segue para /cart; o frete
 * é cotado com a peça no carrinho, que volta como estava.
 */

type Json = Record<string, unknown>

async function cartJson<T = Json>(root: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    root + path,
    body === undefined
      ? { headers: { Accept: 'application/json' } }
      : { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) },
  )
  const json = await response.json()
  if (!response.ok) throw json
  return json as T
}

// Uma operação de carrinho por vez: a cotação mexe no carrinho e o desfaz
let cartLock: Promise<unknown> = Promise.resolve()
function withCart<T>(task: () => Promise<T>): Promise<T> {
  const run = cartLock.then(task, task)
  cartLock = run.catch(() => undefined)
  return run
}

/**
 * Põe a variante no carrinho. `send`: o item já montado por quem chama (o personalizado manda a
 * foto pelo GQPhoto do tema, com progresso e cancelamento: customArt.ts); sem ele, só a variante.
 */
export async function addToCart(root: string, variantId: number, send?: () => Promise<unknown>): Promise<void> {
  await withCart(send ?? (() => cartJson(root, 'cart/add.js', { items: [{ id: variantId, quantity: 1 }] })))
}

/** Avisa as ferramentas de anúncio da loja (as mesmas da página de produto) e segue para o carrinho */
export function trackAndGoToCart(root: string, product: { id: number; title: string }, price: number) {
  let gone = false
  const go = () => {
    if (gone) return
    gone = true
    window.location.href = root + 'cart'
  }
  const value = price / 100
  const w = window as unknown as {
    dataLayer?: unknown[]
    fbq?: (...args: unknown[]) => void
  }
  try {
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({
      event: 'add_to_cart',
      ecommerce: { items: [{ item_name: product.title, item_id: String(product.id), price: value, item_brand: 'Go Quadros', index: 0, quantity: 1 }] },
      eventCallback: go,
      eventTimeout: 1000,
    })
  } catch {}
  try {
    w.fbq?.('track', 'AddToCart', { content_ids: [String(product.id)], content_name: product.title, content_type: 'product', currency: 'BRL', value })
  } catch {}
  setTimeout(go, 1200)
}

export interface ShippingRate {
  name: string
  /** Centavos */
  price: number
  /** Prazo máximo em dias úteis, se a tarifa informar */
  days: number | null
}

/** Cidade/UF do CEP (ViaCEP), também usado pela página de produto atual */
export async function lookupCep(cep: string): Promise<{ city: string; uf: string } | null> {
  try {
    const data = (await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json()) as { erro?: boolean; localidade?: string; uf?: string }
    return data && !data.erro ? { city: data.localidade ?? '', uf: data.uf ?? '' } : null
  } catch {
    return null
  }
}

/**
 * A Shopify só cota frete para o carrinho: põe a variante, pede as tarifas do CEP e devolve o
 * carrinho como estava. As tarifas são as cadastradas na loja (ou as do app de frete).
 */
export function shippingRates(root: string, variantId: number, cep: string, uf: string): Promise<ShippingRate[]> {
  return withCart(async () => {
    const before = await cartJson<{ items?: { key: string; quantity: number }[] }>(root, 'cart.js')
    const added = await cartJson<{ items?: { key: string }[]; key?: string }>(root, 'cart/add.js', { items: [{ id: variantId, quantity: 1 }] })
    const key = added.items?.[0]?.key ?? added.key
    // A mesma linha (variante sem propriedades) volta à quantidade de antes. Pela chave, não pela
    // variante: o mesmo quadro com a foto do cliente é outra linha e não pode ser mexido aqui
    const had = (before.items ?? []).find((item) => item.key === key)
    const restore = () => cartJson(root, 'cart/change.js', { id: key, quantity: had ? had.quantity : 0 })
    const query = new URLSearchParams({
      'shipping_address[zip]': `${cep.slice(0, 5)}-${cep.slice(5)}`,
      'shipping_address[country]': 'Brazil',
      ...(uf ? { 'shipping_address[province]': uf } : {}),
    })
    try {
      const result = await cartJson<{ shipping_rates?: { name?: string; presentment_name?: string; price?: string; delivery_days?: (number | null)[] }[] }>(
        root,
        `cart/shipping_rates.json?${query}`,
      )
      return (result.shipping_rates ?? [])
        .map((rate) => {
          const days = (rate.delivery_days ?? []).filter((day): day is number => day !== null)
          return { name: rate.name || rate.presentment_name || 'Envio', price: Math.round(Number(rate.price ?? 0) * 100), days: days.length ? Math.max(...days) : null }
        })
        .sort((a, b) => a.price - b.price)
    } finally {
      await restore()
    }
  })
}
