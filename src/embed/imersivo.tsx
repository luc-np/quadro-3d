/**
 * Página de produto imersiva, embutível no tema da loja (sem Next): o modelo de produto
 * `product.imersivo` põe um <gq-imersivo> com os dados do produto (JSON) e carrega este módulo
 * com <script type="module">. Ao carregar, o módulo monta a página em cada <gq-imersivo>.
 *
 * Como a página especial: tudo dentro de um Shadow DOM, com o CSS (Tailwind) só lá dentro.
 * A fonte (Montserrat) é a do documento, carregada pela seção.
 *
 * Gerado por `npm run build:especial` (scripts/build-especial.mjs), junto com a especial.
 */
import { createRoot } from 'react-dom/client'
import Imersivo, { type ImersivoProps } from '@/components/imersivo/Imersivo'
import type { ShopData } from '@/components/especial/shop'
import { setTextureUrlResolver } from '@/components/scene/materials'
// CSS da página (Tailwind, gerado pelo build): entra como texto no Shadow DOM
import css, { properties } from 'especial:css'

interface HostData {
  shop: ShopData
  crumb?: ImersivoProps['crumb']
  /** Endereço de cada arquivo do projeto, pelo caminho em public/ (no tema, com outros nomes) */
  assets: Record<string, string>
}

/** O three r186 exige WebGL 2: sem ele, a seção mostra o aviso que já vem no HTML */
function supported(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return gl !== null
  } catch {
    return false
  }
}

/** Onde a página começa (px, do topo do documento): abaixo da faixa e do cabeçalho do tema. O palco ocupa o resto da tela. */
function pageTop(host: HTMLElement): number {
  return Math.round(host.getBoundingClientRect().top + window.scrollY)
}

/**
 * Onde o palco fica preso ao rolar (px do topo da tela): logo abaixo do cabeçalho flutuante do tema
 * (a cápsula fica presa a 8 px do topo), como na página especial
 */
function headerOffset(): number {
  const header = document.querySelector('.gq-sh-section')
  return header ? Math.round(header.getBoundingClientRect().height + 16) : 0
}

export function mount(host: HTMLElement) {
  const data = JSON.parse(host.querySelector('script[type="application/json"]')?.textContent ?? 'null') as HostData | null
  if (!data || !supported()) return
  setTextureUrlResolver((url) => data.assets[url] ?? url)

  // O Tailwind 4 registra as variáveis dele com @property, que o navegador ignora dentro de um
  // Shadow DOM: o registro vai no documento (o mesmo da página especial)
  if (!document.getElementById('gq-imersivo-properties')) {
    const registry = document.createElement('style')
    registry.id = 'gq-imersivo-properties'
    registry.textContent = properties
    document.head.append(registry)
  }

  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = css
  const container = document.createElement('div')
  container.style.setProperty('--font-especial', "Montserrat, 'Helvetica Neue', Arial, sans-serif")
  shadow.replaceChildren(style, container)
  host.removeAttribute('data-loading')

  const root = createRoot(container)
  let offset = -1
  let sticky = -1
  const render = () => {
    const next = pageTop(host)
    const nextSticky = headerOffset()
    if (next === offset && nextSticky === sticky) return
    offset = next
    sticky = nextSticky
    root.render(<Imersivo shop={data.shop} crumb={data.crumb} topOffset={offset} stickyTop={sticky} />)
  }
  render()
  window.addEventListener('resize', render)
  return {
    destroy() {
      window.removeEventListener('resize', render)
      root.unmount()
    },
  }
}

for (const host of document.querySelectorAll<HTMLElement>('gq-imersivo')) mount(host)
