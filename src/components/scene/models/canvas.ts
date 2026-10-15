import { cm } from './format'
import { hangerPart } from './hardware'
import { outwardFace, plate, ring, withFace } from './shapes'
import { canvasEdge, canvasPrint, DARK_WOOD, LIGHT_WOOD, RAW_COTTON, type EdgeFinish } from './surfaces'
import { definePart, type Box, type ModelDef, type SurfaceDef } from './types'

/** Canvas: tecido impresso esticado num chassi de madeira, dentro de uma moldura flutuante. */
export interface CanvasSpec {
  /** Largura da tela (m) */
  width: number
  /** Altura da tela (m) */
  height: number
  /** Profundidade total do chassi com a tela */
  canvasDepth: number
  /** Espessura do tecido */
  fabric: number
  /** Largura das ripas do chassi */
  slat: number
  /** Vão entre a tela e a moldura */
  gap: number
  /** Largura da moldura vista de frente */
  frameFront: number
  /** Profundidade (lateral) da moldura */
  frameDepth: number
  /** Espessura do apoio traseiro da moldura (onde a tela assenta) */
  lip: number
  /** Quanto o apoio avança para dentro, por baixo do chassi */
  lipWidth: number
  edge: EdgeFinish
  /** Arte impressa (URL); sem ela, a arte de exemplo */
  art?: string
  /** Acabamento da moldura; sem ele, a madeira escura */
  frameSurface?: SurfaceDef
}

export const CANVAS_SPEC: CanvasSpec = {
  // Retrato 2:3, a mesma proporção da arte: o cover não precisa cortar nada
  width: 0.4,
  height: 0.6,
  canvasDepth: 0.03,
  fabric: 0.002,
  slat: 0.035,
  gap: 0.008,
  frameFront: 0.01,
  frameDepth: 0.038,
  lip: 0.006,
  lipWidth: 0.02,
  edge: 'stretch',
}

/** Telas largas levam uma travessa central, recuada (fração da profundidade) para não marcar o tecido */
const BRACE = { minWidth: 0.5, depthRatio: 0.7 }

type CanvasSurface = 'arte' | 'borda' | 'verso'

function buildTela({ width: W, height: H, canvasDepth: D, fabric: t }: CanvasSpec): Box<CanvasSurface>[] {
  const sideDepth = D - t
  // Laterais: o tecido dobra por cima do chassi
  const sides = ring(W - 2 * t, H - 2 * t, t, sideDepth, -t - sideDepth / 2)

  return [
    // Face frontal, onde vai a arte; o avesso fica com a base ('verso')
    {
      ...plate(W, H, t, -t / 2),
      faces: { pz: 'arte', px: 'borda', nx: 'borda', py: 'borda', ny: 'borda' },
    },
    // Só a face de fora das laterais é vista; por dentro é avesso
    ...sides.map((side) => withFace(side, outwardFace(side.position), 'borda')),
  ]
}

function buildChassi({ width: W, height: H, canvasDepth: D, fabric: t, slat: b }: CanvasSpec) {
  const depth = D - t
  const inner = { width: W - 2 * t - 2 * b, height: H - 2 * t - 2 * b }
  const boxes = ring(inner.width, inner.height, b, depth, -t - depth / 2)

  if (W > BRACE.minWidth) {
    const braceDepth = depth * BRACE.depthRatio
    boxes.push({ size: [b, inner.height, braceDepth], position: [0, 0, -D + braceDepth / 2] })
  }
  return boxes
}

/** Fundo da moldura: atrás do chassi e do apoio. A frente fica `frameDepth` adiante. */
function frameBack({ canvasDepth: D, lip }: CanvasSpec) {
  return -D - lip
}

function buildMoldura(spec: CanvasSpec) {
  const { width: W, height: H, canvasDepth: D, gap: g, frameFront: m, frameDepth, lip, lipWidth } = spec
  const back = frameBack(spec)
  // O apoio vai da parede interna até lipWidth para dentro da tela
  const lipSpan = g + lipWidth

  return [
    // Paredes
    ...ring(W + 2 * g, H + 2 * g, m, frameDepth, back + frameDepth / 2),
    // Apoio traseiro (perfil em L)
    ...ring(W + 2 * g - 2 * lipSpan, H + 2 * g - 2 * lipSpan, lipSpan, lip, -D - lip / 2),
  ]
}

export function canvasModel(spec: CanvasSpec): ModelDef {
  const { width: W, height: H, fabric: t, slat: b, gap: g, frameFront: m, frameDepth } = spec
  const border = 2 * (g + m)
  const outer = { width: W + border, height: H + border }

  return {
    name: 'Canvas',
    art: { width: W, height: H },
    window: { width: W, height: H },
    outer,
    // Da frente para trás
    parts: [
      definePart<CanvasSurface>({
        id: 'tela',
        label: 'Tela em canvas',
        description: 'Tecido de algodão impresso, esticado e grampeado no chassi.',
        explode: 0.18,
        // Canto superior esquerdo da frente, perto da legenda
        marker: [-W / 2 + 0.04, H / 2 - 0.05, 0],
        surfaces: { arte: canvasPrint(spec.art), borda: canvasEdge(spec.edge, spec.art), verso: RAW_COTTON },
        baseSurface: 'verso',
        // Projeta no apoio da moldura e recebe a sombra da parede no vão
        shadows: { cast: true, receive: true },
        boxes: buildTela(spec),
      }),
      definePart({
        id: 'chassi',
        label: 'Chassi de madeira',
        description: 'Estrutura de pinus que mantém a tela esticada.',
        explode: 0,
        // Ripa direita: com o grupo inclinado, é o trecho do chassi que a tela não cobre
        marker: [W / 2 - t - b / 2, H * 0.25, -t],
        surfaces: { madeira: LIGHT_WOOD },
        baseSurface: 'madeira',
        // Fica escondido entre a tela e a moldura: a sombra dele cairia onde ninguém vê
        shadows: { cast: false, receive: false },
        boxes: buildChassi(spec),
      }),
      definePart({
        id: 'moldura',
        label: 'Moldura flutuante',
        description: `Perfil em L com ${cm(m)} de frente e ${cm(frameDepth)} de lateral; cria um vão de sombra ao redor da tela.`,
        explode: -0.2,
        // Frente da parede direita
        marker: [W / 2 + g + m / 2, H * 0.05, frameBack(spec) + frameDepth],
        surfaces: { madeira: spec.frameSurface ?? DARK_WOOD },
        baseSurface: 'madeira',
        // A parede desenha o vão de sombra; o apoio recebe a sombra da tela
        shadows: { cast: true, receive: true },
        boxes: buildMoldura(spec),
      }),
      // Atrás de tudo: pregados nas costas da moldura
      hangerPart(outer, frameBack(spec), -0.27),
    ],
  }
}
