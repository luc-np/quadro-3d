import { mdfPart, printPart, type BoardSpec } from './board'
import { cm, mm } from './format'
import { hangerPart, spread, STAPLE, staples } from './hardware'
import { plate, ring } from './shapes'
import { DARK_WOOD, GLASS, LIGHT_WOOD, STEEL } from './surfaces'
import { definePart, type ModelDef, type PartDef, type SurfaceDef, type Vec3 } from './types'

/**
 * Moldura caixa e filete: o mesmo processo. O papel fotográfico fosco é colado numa placa de
 * MDF, que entra por trás da moldura e é grampeada nela. A borda da moldura cobre o contorno
 * da arte (ela "fica na arte", não flutua).
 * Sem vidro: só os grampos (no acabamento, uma fita kraft os cobre; não é modelada).
 * Com vidro: vidro entre a moldura e a arte, e um chassi de madeira por cima dos grampos.
 */
export interface FramedSpec extends BoardSpec {
  /** Estilo da moldura, usado nos textos (ex.: 'caixa') */
  style: string
  /** Largura da moldura vista de frente */
  frameFront: number
  /** Profundidade (lateral) da moldura */
  frameDepth: number
  /** Quanto a borda da moldura cobre do contorno da arte */
  overlap: number
  /** Espessura da aba da frente, que segura a arte */
  lipThickness: number
  /** Espessura do vidro; 0 = sem vidro */
  glass: number
  /** Acabamento da moldura; sem ele, a madeira escura */
  frameSurface?: SurfaceDef
}

/** Chassi dos modelos com vidro: largura das ripas e quanto ficam recuadas das costas da moldura */
const CHASSIS = { width: 0.015, recess: 0.002 }

export function framedModel(spec: FramedSpec): ModelDef {
  const { width: W, height: H, frameFront: F, frameDepth: P, overlap: O, lipThickness: T } = spec
  const { mdf: m, paper: p, glass: g } = spec
  const wall = F - O
  const outer = { width: W + 2 * wall, height: H + 2 * wall }
  // A frente da moldura fica à frente do vidro (se houver) pela espessura da aba
  const front = g + T
  const back = front - P
  // Regra de produção: quem tem vidro leva chassi
  const hasChassis = g > 0

  const stapleZ = -p - m - STAPLE.thick / 2
  // O grampo mais alto da coluna direita: com o grupo inclinado, é a que fica à vista
  const stapleMarker: Vec3 = [W / 2 - STAPLE.short / 2, Math.max(...spread(H)), stapleZ]

  // O chassi assenta sobre os grampos e vai até perto das costas da moldura
  const chassisFront = -p - m - STAPLE.thick
  const chassisDepth = chassisFront - (back + CHASSIS.recess)

  const glassParts: PartDef[] = g > 0
    ? [
        definePart({
          id: 'vidro',
          label: 'Vidro',
          description: `Vidro de ${mm(g)} entre a moldura e a arte: protege a impressão.`,
          explode: 0.07,
          // Canto inferior esquerdo: o trecho do vidro que aparece entre a moldura e a arte
          marker: [-W / 2 + 0.03, -H * 0.38, g],
          surfaces: { vidro: GLASS },
          baseSurface: 'vidro',
          // Transparente: não projeta sombra
          shadows: { cast: false, receive: false },
          boxes: [plate(W, H, g, g / 2)],
        }),
      ]
    : []

  const chassisParts: PartDef[] = hasChassis
    ? [
        definePart({
          id: 'chassi',
          label: 'Chassi de madeira',
          description: 'Ripas de pinus por cima dos grampos, preenchendo o fundo da moldura: firmam o vidro e a arte.',
          explode: -0.15,
          // Ripa direita: a camada mais ao fundo, a mais à direita na tela
          marker: [W / 2 - CHASSIS.width / 2, -H * 0.3, chassisFront],
          surfaces: { madeira: LIGHT_WOOD },
          baseSurface: 'madeira',
          shadows: { cast: false, receive: false },
          boxes: ring(W - 2 * CHASSIS.width, H - 2 * CHASSIS.width, CHASSIS.width, chassisDepth, chassisFront - chassisDepth / 2),
        }),
      ]
    : []

  return {
    name: `Moldura ${spec.style}${g > 0 ? ' com vidro' : ''}`,
    art: { width: W, height: H },
    window: { width: W - 2 * O, height: H - 2 * O },
    outer,
    // Da frente para trás
    parts: [
      definePart({
        id: 'moldura',
        label: `Moldura ${spec.style}`,
        description: `Perfil de madeira com ${cm(F)} de frente e ${cm(P)} de profundidade; a borda cobre ${mm(O)} da arte.`,
        explode: 0.14,
        // Frente da parede esquerda: a moldura é a camada mais à frente, a mais à esquerda na tela
        marker: [-W / 2 - wall / 2, H * 0.1, front],
        surfaces: { madeira: spec.frameSurface ?? DARK_WOOD },
        baseSurface: 'madeira',
        // A borda projeta sombra no contorno da arte
        shadows: { cast: true, receive: true },
        boxes: [
          // Paredes, de ponta a ponta da profundidade
          ...ring(W, H, wall, P, back + P / 2),
          // Aba da frente, por cima do contorno da arte
          ...ring(W - 2 * O, H - 2 * O, O, T, front - T / 2),
        ],
      }),
      ...glassParts,
      printPart(spec, { explode: 0, marker: [-W / 2 + 0.04, H / 2 - 0.05, 0], receiveShadow: true }),
      mdfPart(spec, {
        description: 'Base rígida da arte: entra por trás da moldura e é grampeada nela.',
        explode: -0.05,
        marker: [W / 2 - 0.03, -H * 0.15, -p],
        receiveShadow: false,
      }),
      definePart({
        id: 'grampos',
        label: 'Grampos',
        description: hasChassis
          ? 'Cravados na moldura, prendem a placa de MDF por trás; o chassi vai por cima deles.'
          : 'Cravados na moldura, prendem a placa de MDF por trás. No acabamento, uma fita kraft os cobre.',
        explode: -0.1,
        marker: stapleMarker,
        surfaces: { aco: STEEL },
        baseSurface: 'aco',
        shadows: { cast: false, receive: false },
        boxes: staples(W, H, stapleZ),
      }),
      ...chassisParts,
      // Atrás de tudo: pregados nas costas da moldura
      hangerPart(outer, back, hasChassis ? -0.2 : -0.15),
    ],
  }
}
