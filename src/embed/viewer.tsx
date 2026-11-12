/**
 * Visualizador 3D embutível (sem Next): o tema da loja importa este módulo quando a pessoa
 * abre o 3D na galeria da página de produto.
 *
 *   const viewer = mount(element, config, { textures })
 *   viewer.update(novaConfig)   // trocou tamanho, moldura, cor ou vidro
 *   viewer.zoom(0.8)            // aproxima (fator sobre a distância)
 *   viewer.reset()              // volta à vista inicial
 *   viewer.destroy()
 *
 * Gerado por `npm run build:embed` (scripts/build-embed.mjs).
 *
 * Além dos exports, o módulo se registra em window.GQ3DViewer: o tema o carrega com uma tag
 * <script type="module">, porque a Shopify minifica os JS do tema e troca o import() dinâmico
 * por require(), que não existe no navegador.
 */
import { createRef, type RefObject } from 'react'
import { createRoot } from 'react-dom/client'
import { useTexture } from '@react-three/drei'
import { setTextureUrlResolver, textureUrls } from '@/components/scene/materials'
import { FRAME_FINISHES } from '@/components/scene/models/surfaces'
import { SCENE_BACKGROUND } from '@/components/scene/theme'
import { EmbedScene, type ViewerConfig, type ViewerControls } from './EmbedScene'

export type { ViewerConfig } from './EmbedScene'

export interface MountOptions {
  /**
   * Endereço de cada textura do projeto, pelo caminho em public/ (ex.: "/textures/madeira/...").
   * No tema, os arquivos ficam em assets com outros nomes.
   */
  textures?: Record<string, string>
  background?: string
  /** Chamado quando a cena termina de carregar (para tirar o "carregando" do tema) */
  onReady?: () => void
  /**
   * Só gira na horizontal; o arrasto vertical rola a página (celular e tablet). Sem isso,
   * arrastar o dedo para cima/baixo em cima do 3D girava o quadro e prendia a rolagem.
   */
  horizontalOnly?: boolean
}

export interface ViewerHandle {
  update: (config: ViewerConfig) => void
  zoom: (factor: number) => void
  reset: () => void
  destroy: () => void
}

/** O three r186 exige WebGL 2: o tema esconde o 3D sem ele */
export function supported(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return gl !== null
  } catch {
    return false
  }
}

export function mount(element: HTMLElement, config: ViewerConfig, options: MountOptions = {}): ViewerHandle {
  const textures = options.textures ?? {}
  setTextureUrlResolver((url) => textures[url] ?? url)
  // As madeiras das cinco cores já começam a baixar: trocar a cor não deixa a cena em branco
  for (const url of Object.values(textureUrls(FRAME_FINISHES))) useTexture.preload(url)

  const root = createRoot(element)
  const controls: RefObject<ViewerControls | null> = createRef()
  const background = options.background ?? SCENE_BACKGROUND
  const render = (next: ViewerConfig) =>
    root.render(
      <EmbedScene
        config={next}
        background={background}
        controlsRef={controls}
        onReady={options.onReady}
        horizontalOnly={options.horizontalOnly}
      />,
    )
  render(config)

  return {
    update: render,
    zoom: (factor) => controls.current?.zoom(factor),
    reset: () => controls.current?.reset(),
    destroy: () => root.unmount(),
  }
}

declare global {
  interface Window {
    /** `padrao`: conhece a moldura padrão; sem ele, o tema manda o filete no lugar dela */
    GQ3DViewer?: { mount: typeof mount; supported: typeof supported; padrao: true }
  }
}

window.GQ3DViewer = { mount, supported, padrao: true }
