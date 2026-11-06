/**
 * A foto do cliente nos personalizados é do tema da loja: assets/gq-photo.js (window.GQPhoto), o
 * mesmo da página de produto e da sacola. Ele escolhe o arquivo, abre na orientação certa (EXIF),
 * enquadra na proporção da peça, mede a resolução e manda para o carrinho. Aqui ficam só os tipos
 * e o acesso: a página especial usa a prévia do enquadramento como arte do 3D.
 *
 * Fora da loja (o Next), não há GQPhoto: a página fica sem a parte da foto.
 */

/** Como a foto chega: só a prévia (e-mail depois), pela Shopify no carrinho ou pelo nosso servidor */
export type Envio = 'email' | 'shopify' | 's3'

/** Uma peça com foto (de load() ou crop()); só os campos que a página usa */
export interface PhotoSlot {
  name: string
  file?: File
  /** Envio 's3': o link da foto enviada */
  arte?: string
  /** Medidas da foto original (já girada) */
  iw: number
  ih: number
  zoom: number
  /** Cópia reduzida, para a janela de enquadramento */
  url: string
  /** Imagem do enquadramento (JPEG ~1600 px), na proporção da peça */
  preview: string
}

export interface PhotoQuality {
  level: 'ok' | 'low'
  label: string
  dpi: number
}

/** Erro do GQPhoto: o texto para o cliente; `canceled` quando o cliente cancelou */
export interface PhotoError {
  description?: string
  canceled?: boolean
}

export interface GQPhotoApi {
  choose(): Promise<File | null>
  check(file: File, envio: Envio): string
  load(file: File): Promise<PhotoSlot>
  crop(slot: PhotoSlot, opts: { w: number; h: number; sub?: string }): Promise<PhotoSlot | null>
  refresh(slot: PhotoSlot, w: number, h: number): Promise<PhotoSlot>
  quality(slot: PhotoSlot, w: number, h: number): PhotoQuality
  upload(slot: PhotoSlot, endpoint: string, onProgress?: (pct: number) => void, signal?: AbortSignal): Promise<string>
  form(o: {
    variantId: number
    quantity: number
    slots: (PhotoSlot | null)[]
    w: number
    h: number
    envio: Envio
  }): Promise<{ data: FormData; hasFiles: boolean }>
  send(data: FormData, onProgress?: (pct: number) => void, signal?: AbortSignal): Promise<unknown>
  LOAD_ERROR: string
}

/** O GQPhoto do tema, se a página o carregou */
export function gqPhoto(): GQPhotoApi | null {
  return (window as unknown as { GQPhoto?: GQPhotoApi }).GQPhoto ?? null
}
