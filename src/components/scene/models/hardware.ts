import { STEEL, TEXTURES } from './surfaces'
import { definePart, type HardwareItem, type PartDef, type Shape, type Size2, type SurfaceDef, type Vec3 } from './types'

/** Grampos de fixação: comprimento × largura × espessura, e espaçamento ao longo de cada lado */
export const STAPLE = { long: 0.012, short: 0.006, thick: 0.0008, spacing: 0.15 }

/** Posições, ao longo de um lado de comprimento `span`, distribuídas por igual */
export function spread(span: number): number[] {
  const count = Math.max(2, Math.round(span / STAPLE.spacing))
  return Array.from({ length: count }, (_, i) => -span / 2 + ((i + 0.5) * span) / count)
}

/** Grampos no verso do MDF, rente à borda, cravados na parede interna da moldura */
export function staples(width: number, height: number, z: number): Shape[] {
  const { long, short, thick } = STAPLE
  const y = height / 2 - short / 2
  const x = width / 2 - short / 2
  return [
    ...spread(width).flatMap((px): Shape[] => [
      { size: [long, short, thick], position: [px, y, z] },
      { size: [long, short, thick], position: [px, -y, z] },
    ]),
    ...spread(height).flatMap((py): Shape[] => [
      { size: [short, long, thick], position: [x, py, z] },
      { size: [short, long, thick], position: [-x, py, z] },
    ]),
  ]
}

/**
 * Pendurador dente de serra, como nas fotos de referência: plaqueta de aço com um pé plano
 * furado em cada ponta, rampas e uma ponte elevada no meio, com dentes na borda de baixo.
 * Medidas em metros; x ao longo da plaqueta, y na largura, z saindo da superfície.
 */
export const SAWTOOTH_HANGER = {
  length: 0.045,
  width: 0.009,
  thickness: 0.0006,
  /** Comprimento de cada pé, onde vai o parafuso */
  foot: 0.0095,
  /** Comprimento de cada rampa */
  ramp: 0.0035,
  /** Altura da ponte em relação aos pés */
  rise: 0.0025,
  holeRadius: 0.0018,
  /** Raio dos cantos das pontas */
  cornerRadius: 0.0025,
  teeth: 7,
  toothDepth: 0.0017,
}

/** Parafuso Phillips de cabeça abaulada: só a cabeça aparece */
export const SCREW = { headRadius: 0.0028, headHeight: 0.0014 }

/** Latão dos parafusos; a textura (a cruz Phillips) cobre a cabeça inteira */
const BRASS_SCREW: SurfaceDef = {
  color: '#c9a660',
  roughness: 0.35,
  metalness: 0.6,
  tiled: { map: `${TEXTURES}/ferragens/phillips.webp`, tile: 2 * SCREW.headRadius },
}

/** Onde ficam os penduradores: distância da quina e da borda de cima até a plaqueta */
const HANGER_PLACEMENT = { cornerInset: 0.015, edgeInset: 0.002 }

/** Meia volta em y: a peça, modelada voltada para +z, fica voltada para trás, saindo das costas */
const FACING_BACK: Vec3 = [0, Math.PI, 0]

type HangerSurface = 'aco' | 'latao'

/** Um pendurador perto de cada ponta de cima do contorno `outer`, aparafusado na face traseira em `back` */
function hangerItems(outer: Size2, back: number): HardwareItem<HangerSurface>[] {
  const { length, width, thickness, foot } = SAWTOOTH_HANGER
  const y = outer.height / 2 - HANGER_PLACEMENT.edgeInset - width / 2
  const screwOffset = length / 2 - foot / 2

  return [1, -1].flatMap((side): HardwareItem<HangerSurface>[] => {
    const x = side * (outer.width / 2 - HANGER_PLACEMENT.cornerInset - length / 2)
    return [
      { kind: 'sawtoothHanger', position: [x, y, back], rotation: FACING_BACK, surface: 'aco' },
      // Um parafuso em cada pé, com a cabeça apoiada sobre a plaqueta
      ...[1, -1].map(
        (end): HardwareItem<HangerSurface> => ({
          kind: 'screw',
          position: [x + end * screwOffset, y, back - thickness],
          rotation: FACING_BACK,
          surface: 'latao',
        }),
      ),
    ]
  })
}

/** Os penduradores como parte própria: na vista explodida, saem das costas da moldura */
export function hangerPart(outer: Size2, back: number, explode: number): PartDef {
  const hardware = hangerItems(outer, back)
  return definePart<HangerSurface>({
    id: 'penduradores',
    label: 'Penduradores',
    description: 'Plaquetas dente de serra presas com dois parafusos nas costas da moldura, uma em cada ponta de cima.',
    explode,
    // O pendurador da direita: as camadas do fundo ficam à direita na vista explodida
    marker: hardware[0].position,
    surfaces: { aco: STEEL, latao: BRASS_SCREW },
    baseSurface: 'aco',
    shadows: { cast: false, receive: false },
    boxes: [],
    hardware,
  })
}
