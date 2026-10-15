/**
 * Página especial de produto, embutível no tema da loja (sem Next): o modelo de produto
 * `product.especial` põe um <gq-especial> com os dados do produto (JSON) e carrega este módulo
 * com <script type="module">. Ao carregar, o módulo monta a página em cada <gq-especial>.
 *
 * Tudo fica dentro de um Shadow DOM, com o CSS da página (Tailwind) só lá dentro: o CSS do tema
 * não entra e o da página não vaza. A fonte (Montserrat) é a do documento, carregada pela seção.
 *
 * Gerado por `npm run build:especial` (scripts/build-especial.mjs).
 */
import { createRoot } from 'react-dom/client'
import Especial from '@/components/especial/Especial'
import type { ShopData } from '@/components/especial/shop'
import { setTextureUrlResolver } from '@/components/scene/materials'
// CSS da página (Tailwind, gerado pelo build): entra como texto no Shadow DOM
import css, { properties } from 'especial:css'

interface HostData {
  shop: ShopData
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

/**
 * Altura (px) do cabeçalho flutuante do tema (a cápsula fica presa a 8 px do topo): o palco da
 * história fica logo abaixo dele, sem a cápsula cobrir o título
 */
function headerOffset(): number {
  const header = document.querySelector('.gq-sh-section')
  return header ? Math.round(header.getBoundingClientRect().height + 16) : 0
}

export function mount(host: HTMLElement) {
  const data = JSON.parse(host.querySelector('script[type="application/json"]')?.textContent ?? 'null') as HostData | null
  if (!data || !supported()) return
  setTextureUrlResolver((url) => data.assets[url] ?? url)

  // O Tailwind 4 dá valor inicial às variáveis dele (deslocar, girar, anel, sombra) com @property,
  // que o navegador ignora dentro de um Shadow DOM: o registro vai no documento e vale para tudo
  if (!document.getElementById('gq-especial-properties')) {
    const registry = document.createElement('style')
    registry.id = 'gq-especial-properties'
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
  const render = () => {
    const next = headerOffset()
    if (next === offset) return
    offset = next
    root.render(<Especial shop={data.shop} environment="lightformers" topOffset={offset} />)
  }
  render()
  // A cápsula muda de altura entre celular e computador
  window.addEventListener('resize', render)
  return {
    destroy() {
      window.removeEventListener('resize', render)
      root.unmount()
    },
  }
}

for (const host of document.querySelectorAll<HTMLElement>('gq-especial')) mount(host)
