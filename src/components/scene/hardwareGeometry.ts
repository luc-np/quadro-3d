import { ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, Path, Shape, Vector2, type BufferGeometry } from 'three'
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { SAWTOOTH_HANGER, SCREW } from './models/hardware'
import type { HardwareKind } from './models/types'

/** Geometria de cada tipo de ferragem, voltada para +z (a rotação do item a orienta na peça) */
export function createHardwareGeometry(kind: HardwareKind): BufferGeometry {
  return kind === 'sawtoothHanger' ? sawtoothHangerGeometry() : screwGeometry()
}

/** Fatias de cada rampa: a dobra vira uma curva suave, e o brilho, um filete (não uma face chapada) */
const RAMP_SEGMENTS = 6

/** Ângulo (rad) até onde as normais são suavizadas: dobras sim, quinas de 90° da chapa não */
const CREASE_ANGLE = Math.PI / 6

/**
 * Plaqueta dente de serra: o contorno visto de cima (pés com furo e pontas arredondadas, ponte
 * com dentes na borda de baixo) extrudado na espessura da chapa e depois dobrado: cada ponto
 * sobe conforme a posição ao longo da plaqueta. Cada trecho (pés, fatias das rampas, ponte) é
 * extrudado à parte, para nenhum triângulo atravessar uma dobra.
 */
function sawtoothHangerGeometry(): BufferGeometry {
  const { length, width, thickness, foot, ramp, rise, holeRadius, cornerRadius, teeth, toothDepth } = SAWTOOTH_HANGER
  const top = width / 2
  const bottom = -width / 2
  // Limites dos trechos ao longo de x
  const x0 = -length / 2
  const x1 = x0 + foot
  const x2 = x1 + ramp
  const x5 = length / 2
  const x4 = x5 - foot
  const x3 = x4 - ramp

  /** Subida suave (0→1) ao longo de uma rampa, sem quina nas pontas */
  const ease = (s: number) => s * s * (3 - 2 * s)

  /** Altura da chapa em cada x: pés no chão, rampas subindo em curva, ponte elevada */
  const lift = (x: number) => {
    if (x <= x1 || x >= x4) return 0
    if (x < x2) return rise * ease((x - x1) / ramp)
    if (x > x3) return rise * ease((x4 - x) / ramp)
    return rise
  }

  /** Pé: pontas arredondadas do lado de fora e o furo do parafuso no meio */
  const footShape = (outerX: number, innerX: number) => {
    const out = Math.sign(outerX - innerX)
    const shape = new Shape()
    shape.moveTo(innerX, bottom)
    shape.lineTo(outerX - out * cornerRadius, bottom)
    shape.quadraticCurveTo(outerX, bottom, outerX, bottom + cornerRadius)
    shape.lineTo(outerX, top - cornerRadius)
    shape.quadraticCurveTo(outerX, top, outerX - out * cornerRadius, top)
    shape.lineTo(innerX, top)
    shape.closePath()
    const hole = new Path()
    hole.absarc((outerX + innerX) / 2, 0, holeRadius, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    return shape
  }

  const strip = (from: number, to: number) => {
    const shape = new Shape()
    shape.moveTo(from, bottom)
    shape.lineTo(to, bottom)
    shape.lineTo(to, top)
    shape.lineTo(from, top)
    shape.closePath()
    return shape
  }

  /** Ponte: borda de cima reta, borda de baixo em dente de serra (pontas para baixo) */
  const bridge = () => {
    const pitch = (x3 - x2) / teeth
    const shape = new Shape()
    shape.moveTo(x2, bottom + toothDepth)
    for (let i = 0; i < teeth; i++) {
      shape.lineTo(x2 + (i + 0.5) * pitch, bottom)
      shape.lineTo(x2 + (i + 1) * pitch, bottom + toothDepth)
    }
    shape.lineTo(x3, top)
    shape.lineTo(x2, top)
    shape.closePath()
    return shape
  }

  /** Uma rampa fatiada: os vértices ficam só nas bordas de cada fatia, onde a curva é calculada */
  const rampSlices = (from: number) =>
    Array.from({ length: RAMP_SEGMENTS }, (_, i) =>
      strip(from + (i * ramp) / RAMP_SEGMENTS, from + ((i + 1) * ramp) / RAMP_SEGMENTS),
    )

  const shapes = [footShape(x0, x1), ...rampSlices(x1), bridge(), ...rampSlices(x3), footShape(x5, x4)]
  const pieces = shapes.map((shape) => {
    const piece = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 })
    const position = piece.getAttribute('position')
    for (let i = 0; i < position.count; i++) position.setZ(i, position.getZ(i) + lift(position.getX(i)))
    return piece
  })

  const merged = mergeGeometries(pieces)
  pieces.forEach((piece) => piece.dispose())
  // As rampas foram dobradas depois da extrusão: as normais precisam ser refeitas
  const hanger = toCreasedNormals(merged, CREASE_ANGLE)
  merged.dispose()
  return hanger
}

/**
 * Cabeça abaulada do parafuso: um perfil girado em torno do eixo. UV plana vista de cima, em
 * metros e com o centro no meio, para a textura da cruz Phillips (tile = diâmetro da cabeça).
 */
function screwGeometry(): BufferGeometry {
  const { headRadius: r, headHeight: h } = SCREW
  const profile = [
    [0, 0],
    [r, 0],
    [r, h * 0.3],
    [r * 0.92, h * 0.62],
    [r * 0.72, h * 0.86],
    [r * 0.4, h * 0.98],
    [0, h],
  ].map(([radius, height]) => new Vector2(radius, height))

  const head = new LatheGeometry(profile, 24)
  // O torno gira em torno de y; a cabeça precisa apontar para +z
  head.rotateX(Math.PI / 2)

  const position = head.getAttribute('position')
  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = position.getX(i) + r
    uv[i * 2 + 1] = position.getY(i) + r
  }
  head.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return head
}
