import type { Finish } from '@/components/scene/models/configure'
import type { FrameColor } from '@/components/scene/models/surfaces'

/**
 * Dados do produto da loja, como a seção do tema entrega (e o demo-product.json, no Next):
 * as variantes são [id, Tamanho, Moldura, Cor da moldura, preço em centavos, disponível].
 */
export interface ShopData {
  /** `short`: o nome curto da loja, sem "Quadro Decorativo" (o título do cartão da página imersiva) */
  product: { id: number; title: string; url: string; short?: string }
  /** Arte de impressão (foto do produto "arte da peça 1 de 1", na CDN da Shopify) */
  art: { url: string; width: number; height: number }
  /** Duo e trio: uma arte por peça (a primeira é `art`); sem isso, uma peça só */
  arts?: string[]
  variants: [number, string, string, string, number, boolean][]
  /** Variante aberta na página */
  selected: number
  /** Desconto no Pix (%) e parcelas sem juros */
  pix: number
  installments: number
  /** Na loja: rotas do carrinho. Fora dela (o Next), comprar e cotar frete ficam desligados. */
  cartRoot?: string
  /** Nota e total das avaliações da loja no Google, e algumas delas (as da página de produto) */
  rating?: { score: number; total: number }
  reviews?: Review[]
  /** Descrição do produto (HTML da loja) */
  description?: string
  /** Página imersiva: o ambiente que abre primeiro (metafield custom.ambiente_padrao, nome ou chave) */
  room?: string | null
}

/** Avaliação da loja: nome, data, texto, fotos e ambientes (o formato do snippet gq-pdp-reviews) */
export interface Review {
  n: string
  t: string
  x: string
  imgs?: string[]
  f?: string[]
}

/** A escolha na página: a moldura do 3D separada do vidro, a cor e o tamanho */
export interface Choice {
  size: string
  finish: Finish
  color: FrameColor
  glass: boolean
}

export const takesGlass = (finish: Finish) => finish === 'filete' || finish === 'caixa'
export const hasFrame = (finish: Finish) => finish !== 'placa'

/** Opção "Moldura" da loja ↔ moldura do 3D e vidro */
const FINISH_OPTION: Record<string, { finish: Finish; glass: boolean }> = {
  'Sem moldura (placa)': { finish: 'placa', glass: false },
  Filete: { finish: 'filete', glass: false },
  'Filete com vidro': { finish: 'filete', glass: true },
  Caixa: { finish: 'caixa', glass: false },
  'Caixa com vidro': { finish: 'caixa', glass: true },
  'Canvas / Flutuante': { finish: 'canvas', glass: false },
}

/** Opção "Cor da moldura" da loja ↔ cor do 3D */
const COLOR_OPTION: Record<string, FrameColor> = { Preta: 'preta', Branca: 'branca', Tabaco: 'tabaco', Freijó: 'freijo', Crua: 'crua' }

function finishOption(finish: Finish, glass: boolean): string {
  return Object.entries(FINISH_OPTION).find(([, value]) => value.finish === finish && value.glass === (glass && takesGlass(finish)))?.[0] ?? ''
}

function colorOption(finish: Finish, color: FrameColor): string {
  if (!hasFrame(finish)) return 'Não se aplica'
  return Object.entries(COLOR_OPTION).find(([, value]) => value === color)?.[0] ?? ''
}

/** A escolha de uma variante (a cor fica a anterior quando a variante não tem cor) */
export function choiceOf(shop: ShopData, variantId: number, fallbackColor: FrameColor = 'freijo'): Choice {
  const variant = shop.variants.find(([id]) => id === variantId) ?? shop.variants[0]
  const { finish, glass } = FINISH_OPTION[variant[2]] ?? { finish: 'caixa' as Finish, glass: false }
  return { size: variant[1], finish, glass, color: COLOR_OPTION[variant[3]] ?? fallbackColor }
}

/** A variante da escolha, se existir */
export function variantOf(shop: ShopData, choice: Choice) {
  const finish = finishOption(choice.finish, choice.glass)
  const color = colorOption(choice.finish, choice.color)
  return shop.variants.find(([, size, moldura, cor]) => size === choice.size && moldura === finish && cor === color)
}

/** Preço (centavos) da escolha, ou null se a combinação não existe */
export function priceOf(shop: ShopData, choice: Choice): number | null {
  return variantOf(shop, choice)?.[4] ?? null
}

/** Tamanhos do produto, na ordem da loja */
export function sizesOf(shop: ShopData): string[] {
  return [...new Set(shop.variants.map(([, size]) => size))]
}

/** Molduras que o produto tem (para o 3D: sem separar o vidro) */
export function finishesOf(shop: ShopData): Finish[] {
  return [...new Set(shop.variants.map(([, , moldura]) => FINISH_OPTION[moldura]?.finish).filter(Boolean))] as Finish[]
}

/**
 * Medida física (m) de um tamanho da loja ("40x60", "120x80"), na orientação da arte:
 * a loja escreve alguns tamanhos grandes deitados, mas a peça segue a arte (retrato aqui).
 */
export function sizeMeters(size: string, art: ShopData['art']): { width: number; height: number } {
  const [a, b] = size.split(/x/i).map((value) => Number(value) / 100)
  const portrait = art.height >= art.width
  return portrait ? { width: Math.min(a, b), height: Math.max(a, b) } : { width: Math.max(a, b), height: Math.min(a, b) }
}

/** "40x60" → "40×60", sempre na orientação da arte */
export function sizeLabel(size: string, art: ShopData['art']): string {
  const { width, height } = sizeMeters(size, art)
  return `${Math.round(width * 100)}×${Math.round(height * 100)}`
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Centavos → "R$ 459,90" */
export function money(cents: number): string {
  return BRL.format(cents / 100)
}
