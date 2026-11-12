/**
 * Galeria 3D da página de produto (sem Next): o tema carrega este módulo assim que a página abre
 * e monta o quadro na vitrine. Três vistas — 3D (de frente, inclina com o mouse e gira arrastando),
 * Na parede e Escala (as da página imersiva) — e a troca entre elas é animada.
 *
 *   const galeria = mount(element, config, { assets, room, onReady })
 *   galeria.update(novaConfig)   // trocou a variante ou a vista (config.mode)
 *   galeria.prepareRoom()        // começa a baixar a foto do ambiente (antes de ir para a parede)
 *   galeria.prepareRooms()       // e as de todos os ambientes (a pessoa vai escolher onde o quadro fica)
 *   galeria.destroy()
 *
 * Como o visualizador, se registra em window.GQ3DGaleria: o tema o carrega com <script type="module">
 * (a Shopify minifica os JS do tema e troca o import() dinâmico por require()).
 *
 * Gerado por `npm run build:galeria` (scripts/build-galeria.mjs).
 */
import { useMemo } from 'react'
import { AmbientLight, Color, DirectionalLight, Group, Mesh, MeshBasicMaterial, NeutralToneMapping, OrthographicCamera, PlaneGeometry } from 'three'
import { createRoot, extend } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { assetUrl, setTextureUrlResolver, textureUrls } from '@/components/scene/materials'
import { configureModel, type ModelFinish } from '@/components/scene/models/configure'
import { FRAME_FINISHES, type FrameColor } from '@/components/scene/models/surfaces'
import { CAMERA } from '@/components/scene/Studio'
import { SCENE_BACKGROUND } from '@/components/scene/theme'
import { ROOMS, sizedRoom, type RoomDef } from '@/components/imersivo/rooms'
import { GaleriaStage, NARROW_WIDTH, type GaleriaMode, type Insets } from '@/components/galeria/GaleriaScene'

/**
 * Só as peças do three que a cena usa (<group>, <mesh>, luzes...). O <Canvas> do R3F registraria o
 * three inteiro (extend(THREE)) e o arquivo não encolheria; sem ele, também não vai o React DOM.
 */
extend({ AmbientLight, Color, DirectionalLight, Group, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry })

export interface GaleriaConfig {
  finish: ModelFinish
  glass: boolean
  color: FrameColor
  /** Largura e altura de cada peça como fica na parede (cm) */
  width: number
  height: number
  /** Uma arte por peça (URLs com CORS liberado); o número de artes é o número de peças */
  arts: string[]
  mode: GaleriaMode
  /**
   * O ambiente da parede escolhido na página ("Me ajude a escolher": o móvel na largura dita).
   * Sem ele, o da visita, o do produto ou o quarto. Vale também para a página imersiva (gq-room).
   */
  room?: { key: string; size?: string | null }
}

export interface MountOptions {
  /**
   * Endereço de cada arquivo do projeto pelo caminho em public/ (texturas e fotos do ambiente).
   * `small`: as versões leves (texturas de 512 px, fotos menores), usadas no celular.
   */
  assets: { full: Record<string, string>; small?: Record<string, string> }
  background?: string
  /** O ambiente do produto (metafield custom.ambiente_padrao, pelo nome ou pela chave); senão o da visita ou o quarto */
  room?: string | null
  /** Área do palco coberta pelo HTML do tema (px) */
  insets?: Partial<Insets>
  /** A cena apareceu (texturas e luz carregadas): o tema troca a imagem provisória pelo 3D */
  onReady?: () => void
  /** O ambiente da parede (nome e onde o quadro fica: "acima da cama") */
  onRoom?: (room: { key: string; label: string; above: string }) => void
}

export interface GaleriaHandle {
  update: (config: GaleriaConfig) => void
  prepareRoom: () => void
  prepareRooms: () => void
  destroy: () => void
}

/** O three r186 exige WebGL 2: o tema mantém a vista de frente sem ele */
export function supported(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return gl !== null
  } catch {
    return false
  }
}

const GAP = 24

export function mount(element: HTMLElement, config: GaleriaConfig, options: MountOptions): GaleriaHandle {
  const narrow = window.innerWidth < NARROW_WIDTH
  const { full, small } = options.assets
  // Celular: texturas de 512 px e fotos menores (quando existem); computador: as cheias
  setTextureUrlResolver((url) => (narrow && small?.[url]) || full[url] || url)

  const startKey = initialRoom(options.room)
  let roomSel: { key: string; size: string | null } = { key: startKey, size: initialFurniture()[startKey] ?? null }
  const resolveRoom = (sel: { key: string; size?: string | null }) => sizedRoom(ROOMS.find((item) => item.key === sel.key) ?? ROOMS[0]!, sel.size ?? undefined)
  let room = resolveRoom(roomSel)
  options.onRoom?.({ key: room.key, label: room.label, above: room.above })
  const insets: Insets = { top: GAP, right: GAP, bottom: GAP, left: GAP, ...options.insets }

  // O canvas e, por cima, as cotas da escala (HTML; o visual vem do tema: .gq3g-dim)
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'display:block;width:100%;height:100%'
  const dims = document.createElement('div')
  dims.className = 'gq3g-dims'
  dims.setAttribute('aria-hidden', 'true')
  dims.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden'
  for (const key of ['w', 'h', 'fw', 'fh']) {
    const dim = document.createElement('div')
    dim.className = 'gq3g-dim'
    dim.dataset.dim = key
    dim.style.opacity = '0'
    dim.innerHTML = '<span data-dim-line class="gq3g-dim__line"></span><span data-dim-label class="gq3g-dim__label"></span>'
    dims.append(dim)
  }
  element.append(canvas, dims)
  const annotations = { current: dims }

  const root = createRoot(canvas)
  const size = () => ({ width: element.clientWidth, height: element.clientHeight, top: 0, left: 0 })
  let current = config
  let roomOn = config.mode !== 'frente'
  let ready = false
  let configured: Promise<unknown> | null = null
  const onReady = () => {
    if (ready) return
    ready = true
    options.onReady?.()
    // Com o 3D na tela: as madeiras das outras cores e a foto do ambiente, sem pressa
    idle(() => {
      for (const url of Object.values(textureUrls(FRAME_FINISHES))) useTexture.preload(url)
      prepareRoom()
    })
  }
  const render = () => {
    // A primeira vez espera o renderizador; as outras já desenham
    void (configured ??= root.configure({
      gl: { toneMapping: NeutralToneMapping, powerPreference: 'high-performance' },
      // Celular: menos pixels (a galeria é pequena e a GPU é fraca)
      dpr: narrow ? [1, 1.5] : [1, 2],
      shadows: 'percentage',
      frameloop: 'demand',
      camera: CAMERA,
      size: size(),
    })).then(() =>
      root.render(
        <Galeria config={current} room={room} roomOn={roomOn} insets={insets} background={options.background ?? SCENE_BACKGROUND} annotations={annotations} onReady={onReady} />,
      ),
    )
  }
  const prepareRoom = () => {
    if (roomOn) return
    roomOn = true
    render()
  }
  /**
   * As fotos de todos os ambientes (e de cada largura do móvel), no formato que a galeria usa agora
   * (mais alta que larga: as do celular): trocar de ambiente não espera a foto baixar
   */
  const prepareRooms = () => {
    prepareRoom()
    const layout = element.clientHeight > element.clientWidth ? 'narrow' : 'wide'
    const photos = ROOMS.flatMap((item) => [item[layout], ...(item.sizes?.options ?? []).map((option) => option[layout])])
    for (const src of new Set(photos.map((photo) => photo.src))) useTexture.preload(assetUrl(src))
  }
  render()
  // A vitrine muda de tamanho (girar o celular, abrir a janela): o canvas acompanha
  const observer = new ResizeObserver(() => {
    if (configured && element.clientWidth > 0 && element.clientHeight > 0) void configured.then(() => root.configure({ size: size() }))
  })
  observer.observe(element)

  return {
    update(next) {
      current = next
      if (next.mode !== 'frente') roomOn = true
      const sel = next.room
      if (sel && (sel.key !== roomSel.key || (sel.size ?? null) !== roomSel.size) && ROOMS.some((item) => item.key === sel.key)) {
        roomSel = { key: sel.key, size: sel.size ?? null }
        room = resolveRoom(roomSel)
        saveRoom(roomSel)
        options.onRoom?.({ key: room.key, label: room.label, above: room.above })
      }
      render()
    },
    prepareRoom,
    prepareRooms,
    destroy() {
      observer.disconnect()
      root.unmount()
      canvas.remove()
      dims.remove()
    },
  }
}

interface GaleriaProps {
  config: GaleriaConfig
  room: RoomDef
  roomOn: boolean
  insets: Insets
  background: string
  annotations: { current: HTMLDivElement }
  onReady: () => void
}

/** Os modelos das peças (um por arte) e a cena */
function Galeria({ config, room, roomOn, insets, background, annotations, onReady }: GaleriaProps) {
  const { finish, glass, color, width, height, arts, mode } = config
  const artKey = arts.join('|')
  const models = useMemo(() => {
    const list = artKey ? artKey.split('|') : [undefined]
    return list.map((art) => configureModel({ finish, glass, color, width: width / 100, height: height / 100, art }))
  }, [finish, glass, color, width, height, artKey])
  return <GaleriaStage models={models} mode={mode} room={room} roomOn={roomOn} insets={insets} background={background} annotationsRef={annotations} onReady={onReady} />
}

/** Roda quando o navegador estiver livre (ou em 1,2 s, no Safari sem requestIdleCallback) */
function idle(task: () => void) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(task, { timeout: 2500 })
  else setTimeout(task, 1200)
}

/** Chaves da visita, as mesmas da página imersiva: o ambiente escolhido lá vale aqui */
const ROOM_KEY = 'gq-room'
const FURNITURE_KEY = 'gq-room-size'

/**
 * O ambiente que abre: o escolhido nesta visita; senão o do produto (pelo nome ou pela chave, sem
 * ligar para acento); senão o quarto
 */
function initialRoom(fromProduct: string | null | undefined): string {
  const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  const known = (value: string | null | undefined) => (value ? ROOMS.find((room) => room.key === plain(value) || plain(room.label) === plain(value))?.key : undefined)
  let saved: string | null = null
  try {
    saved = sessionStorage.getItem(ROOM_KEY)
  } catch {
    // Sem armazenamento: fica o do produto
  }
  return known(saved) ?? known(fromProduct) ?? 'quarto'
}

/** Guarda o ambiente (e a largura do móvel) da visita, como a página imersiva */
function saveRoom({ key, size }: { key: string; size?: string | null }) {
  try {
    sessionStorage.setItem(ROOM_KEY, key)
    if (size) sessionStorage.setItem(FURNITURE_KEY, JSON.stringify({ ...initialFurniture(), [key]: size }))
  } catch {
    // Sem armazenamento: vale só nesta página
  }
}

/** As larguras do móvel escolhidas nesta visita ({ sala: '240', quarto: 'king' }) */
function initialFurniture(): Record<string, string> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(FURNITURE_KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  } catch {
    return {}
  }
}

declare global {
  interface Window {
    /** `padrao`: conhece a moldura padrão; sem ele, o tema manda o filete no lugar dela */
    GQ3DGaleria?: { mount: typeof mount; supported: typeof supported; padrao: true }
  }
}

window.GQ3DGaleria = { mount, supported, padrao: true }
window.dispatchEvent(new Event('gq3d:galeria'))
