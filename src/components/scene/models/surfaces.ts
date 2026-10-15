import type { SurfaceDef, TiledTextures } from './types'

export const TEXTURES = '/textures'

/** Arte (2:3), reduzida do original de 6319 × 9478. `alt` é usado na versão estática, sem WebGL. */
export const ARTWORK = {
  src: `${TEXTURES}/arte/print_209c97c7.webp`,
  width: 1365,
  height: 2048,
  alt: 'Pintura abstrata em relevo, com pinceladas largas em tons de creme, bege e terracota',
}

// ─── Canvas ──────────────────────────────────────────────────────────────────

/**
 * Trama do canvas (Poly Haven "hessian_380"). A amostra real tem ~27 cm de juta;
 * reduzida a 12 cm, a trama fica na escala de uma lona de pintura.
 */
const WEAVE: TiledTextures & { map?: never } = {
  normalMap: `${TEXTURES}/canvas/hessian_380_nor_gl_1k.webp`,
  tile: 0.12,
}
const WEAVE_NORMAL_SCALE = 0.8
const CANVAS_ROUGHNESS = 0.9

/**
 * Uma superfície por arte, sempre o mesmo objeto para a mesma URL: o renderizador divide o
 * material entre superfícies iguais (ex.: frente e laterais da tela).
 */
function perArt(build: (art: string) => SurfaceDef): (art?: string) => SurfaceDef {
  const cache = new Map<string, SurfaceDef>()
  return (art = ARTWORK.src) => {
    let surface = cache.get(art)
    if (!surface) {
      surface = build(art)
      cache.set(art, surface)
    }
    return surface
  }
}

/** Frente da tela: a arte impressa no tecido, com o relevo da trama */
export const canvasPrint = perArt((art) => ({
  art,
  tiled: WEAVE,
  color: '#ffffff',
  roughness: CANVAS_ROUGHNESS,
  normalScale: WEAVE_NORMAL_SCALE,
}))

export const CANVAS_PRINT = canvasPrint()

/** Avesso do tecido, sem impressão */
export const RAW_COTTON: SurfaceDef = {
  color: '#e9e2d3',
  roughness: CANVAS_ROUGHNESS,
  normalScale: WEAVE_NORMAL_SCALE,
  tiled: WEAVE,
}

/** Laterais da tela: a borda da arte esticada, ou tecido numa cor sólida */
export type EdgeFinish = 'stretch' | { color: string }

export function canvasEdge(finish: EdgeFinish, art?: string): SurfaceDef {
  if (finish === 'stretch') return canvasPrint(art)
  return { ...RAW_COTTON, color: finish.color }
}

// ─── Papel fotográfico e MDF ─────────────────────────────────────────────────

/** Papel fotográfico fosco impresso: sem trama, um pouco de brilho */
export const photoPrint = perArt((art) => ({ art, color: '#ffffff', roughness: 0.6 }))

export const PHOTO_PRINT = photoPrint()

/** Bordas e verso do papel */
export const PHOTO_PAPER: SurfaceDef = { color: '#f3f1ec', roughness: 0.8 }

/** MDF cru (ambientCG "Paper006", fibra bege salpicada), puxado para o caramelo claro do MDF */
export const MDF: SurfaceDef = {
  color: '#f2d5ae',
  roughness: 1,
  tiled: {
    map: `${TEXTURES}/mdf/paper006_diff_1k.webp`,
    roughnessMap: `${TEXTURES}/mdf/paper006_rough_1k.webp`,
    tile: 0.25,
  },
}

// ─── Madeiras ────────────────────────────────────────────────────────────────

/** Madeira clara do chassi (Poly Haven "ash_veneer", 1 m por repetição), aquecida para o tom do pinus */
export const LIGHT_WOOD: SurfaceDef = {
  color: '#ffe7c2',
  roughness: 1,
  tiled: {
    map: `${TEXTURES}/madeira/ash_veneer_diff_1k.webp`,
    normalMap: `${TEXTURES}/madeira/ash_veneer_nor_gl_1k.webp`,
    roughnessMap: `${TEXTURES}/madeira/ash_veneer_rough_1k.webp`,
    tile: 1,
  },
}

/** Madeira escura das molduras (Poly Haven "flamed_black_veneer", 1 m por repetição) */
export const DARK_WOOD: SurfaceDef = {
  color: '#ffffff',
  roughness: 1,
  tiled: {
    map: `${TEXTURES}/madeira/flamed_black_veneer_diff_1k.webp`,
    normalMap: `${TEXTURES}/madeira/flamed_black_veneer_nor_gl_1k.webp`,
    roughnessMap: `${TEXTURES}/madeira/flamed_black_veneer_rough_1k.webp`,
    tile: 1,
  },
}

// ─── Cores de moldura da loja ────────────────────────────────────────────────

/** As cinco cores de moldura vendidas (as mesmas chaves da página de produto) */
export const FRAME_COLORS = ['preta', 'branca', 'tabaco', 'freijo', 'crua'] as const
export type FrameColor = (typeof FRAME_COLORS)[number]

const ASH_VENEER = {
  map: `${TEXTURES}/madeira/ash_veneer_diff_1k.webp`,
  normalMap: `${TEXTURES}/madeira/ash_veneer_nor_gl_1k.webp`,
  roughnessMap: `${TEXTURES}/madeira/ash_veneer_rough_1k.webp`,
  tile: 1,
}

/**
 * Tons tirados das fotos de close das molduras do site (lateral iluminada de cada uma).
 * Preta e branca são pintadas lisas; tabaco, freijó e crua são madeira com veio. Nas
 * madeiras, a cor multiplica a textura do freixo (mediana #ad957d), calculada no espaço linear
 * para chegar ao tom da foto. A crua é mais clara que a textura: fica só com o relevo e o
 * brilho do veio, na cor da foto.
 */
export const FRAME_FINISHES: Record<FrameColor, SurfaceDef> = {
  preta: { color: '#2b2a2c', roughness: 0.5 },
  branca: { color: '#ecebe7', roughness: 0.5 },
  tabaco: { color: '#e5dbcf', roughness: 1, tiled: ASH_VENEER },
  freijo: { color: '#dab08d', roughness: 1, tiled: ASH_VENEER },
  crua: {
    color: '#cec1a8',
    roughness: 1,
    tiled: { normalMap: ASH_VENEER.normalMap, roughnessMap: ASH_VENEER.roughnessMap, tile: ASH_VENEER.tile },
  },
}

// ─── Vidro e metal ───────────────────────────────────────────────────────────

/**
 * Vidro comum (índice de refração 1,52). Sem cor própria (preto): só o reflexo do ambiente
 * entra, somado por cima da arte, que segue nítida. O HDR da cena é atenuado (~0,22) para a
 * arte não estourar; no vidro o reflexo é reforçado para continuar visível.
 */
export const GLASS: SurfaceDef = { color: '#000000', roughness: 0.02, envIntensity: 2.5, glass: { ior: 1.52 } }

/**
 * Aço galvanizado de grampos e penduradores. Metal puro só reflete o ambiente, e de costas o
 * HDR é escuro: com parte difusa, fica cinza-claro com qualquer luz.
 */
export const STEEL: SurfaceDef = { color: '#cfcfcf', roughness: 0.45, metalness: 0.6 }
