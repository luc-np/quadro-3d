import type { ModelDef, Size2 } from './models/types'

/** Mesmo ponto do breakpoint `md` do Tailwind (48rem): a legenda sai de baixo e vai para a esquerda */
export const WIDE_QUERY = '(min-width: 48rem)'

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Inclinação do grupo com as camadas separadas: dá perspectiva entre elas */
export const EXPLODE_YAW = (-28 * Math.PI) / 180

/** Separação das camadas: no layout estreito, menos, para a vista explodida caber na largura */
export const EXPLODE_SCALE = { wide: 1, narrow: 0.6 }

/** Folga em volta do quadro: ele ocupa ~75% da área livre */
export const FIT_MARGIN = 1.33

/** Quanto a camada da frente cresce na tela ao se aproximar da câmera (por metro de avanço) */
const PERSPECTIVE_GROWTH = 0.65

/**
 * Largura e altura (m) que o quadro ocupa de frente para a câmera. Separado, a largura cresce
 * com a profundidade entre a primeira e a última camada vista em ângulo, e a altura com a
 * camada da frente mais perto da câmera.
 */
export function frameExtent(model: ModelDef, spread: number, explodeScale: number, yaw: number): [number, number] {
  const { width, height } = model.outer
  const offsets = model.parts.map((part) => part.explode * explodeScale * spread)
  const depth = Math.max(...offsets) - Math.min(...offsets)
  const angle = Math.abs(yaw) * spread
  const nearGrowth = 1 + Math.max(...offsets) * PERSPECTIVE_GROWTH

  return [(width * Math.cos(angle) + depth * Math.sin(angle)) * nearGrowth, height * nearGrowth]
}

/**
 * Distância da câmera para `extent` (m) caber na área livre `free` (px) do `viewport`,
 * com fov vertical em graus. Vale o limite mais apertado entre altura e largura.
 * `margin` é a folga (1 = encostado nas bordas).
 */
export function fitDistance(
  [width, height]: [number, number],
  fov: number,
  viewport: Size2,
  free: Size2,
  margin = FIT_MARGIN,
): number {
  const tanHalf = Math.tan((fov * Math.PI) / 360)
  const aspect = viewport.width / viewport.height
  const byHeight = (height * margin * (viewport.height / free.height)) / (2 * tanHalf)
  const byWidth = (width * margin * (viewport.width / free.width)) / (2 * tanHalf * aspect)
  return Math.max(byHeight, byWidth)
}
