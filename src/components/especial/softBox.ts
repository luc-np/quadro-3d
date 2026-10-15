import { BoxGeometry, BufferAttribute, Vector3, type BufferGeometry } from 'three'

export interface SoftBoxOptions {
  /** Largura, altura e profundidade (m) */
  size: [number, number, number]
  /** Raio das quinas (m) */
  radius: number
  /**
   * Quanto cada par de faces estufa no meio (m), por eixo: [laterais, topo/base, frente/trás].
   * O estufado some nas bordas da face: uma almofada cheia fica com as pontas "beliscadas".
   */
  puff?: [number, number, number]
  /** Divisões nas quinas e no meio de cada face */
  segments?: { edge: number; face: number }
}

const AXES = [0, 1, 2] as const

/**
 * Caixa de estofado: quinas arredondadas e faces estufadas, para sofá, almofadas e tapete.
 * As UVs ficam em metros (projeção pela face de origem): a textura repete com `repeat = 1 / tamanho do tile`.
 */
export function softBox({ size, radius, puff = [0, 0, 0], segments = { edge: 4, face: 6 } }: SoftBoxOptions): BufferGeometry {
  const half = size.map((value) => value / 2) as [number, number, number]
  const r = Math.min(radius, ...half)
  const count = segments.face + segments.edge * 2
  const geometry = new BoxGeometry(...size, count, count, count)
  const position = geometry.getAttribute('position')
  const faceNormal = geometry.getAttribute('normal')
  const point = new Vector3()
  const core = new Vector3()

  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i)
    // Redistribui os vértices: `edge` divisões em cada quina de raio r, o resto no meio da face
    for (const axis of AXES) {
      const h = half[axis]
      const step = Math.round(((point.getComponent(axis) + h) / (2 * h)) * count)
      const { edge, face } = segments
      let value: number
      if (step <= edge) value = -h + (r * step) / edge
      else if (step >= count - edge) value = h - r + (r * (step - (count - edge))) / edge
      else value = -h + r + ((2 * h - 2 * r) * (step - edge)) / face
      point.setComponent(axis, value)
    }
    // Arredonda: cada vértice fica a r do "miolo" da caixa
    core.set(
      Math.min(Math.max(point.x, -half[0] + r), half[0] - r),
      Math.min(Math.max(point.y, -half[1] + r), half[1] - r),
      Math.min(Math.max(point.z, -half[2] + r), half[2] - r),
    )
    const offset = point.clone().sub(core)
    if (offset.lengthSq() > 0) point.copy(core).addScaledVector(offset.normalize(), r)
    // Estufa: função só da posição, então vértices coincidentes (as emendas das faces) continuam juntos
    const bulge = AXES.map((axis) => {
      const [b, c] = AXES.filter((other) => other !== axis)
      const across = (1 - (point.getComponent(b) / half[b]) ** 2) * (1 - (point.getComponent(c) / half[c]) ** 2)
      return puff[axis] * Math.sign(point.getComponent(axis)) * (Math.abs(point.getComponent(axis)) / half[axis]) ** 4 * Math.max(0, across)
    })
    position.setXYZ(i, point.x + bulge[0], point.y + bulge[1], point.z + bulge[2])
  }

  // UV em metros, projetada pela face de origem do vértice
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)]
    const nx = Math.abs(faceNormal.getX(i))
    const ny = Math.abs(faceNormal.getY(i))
    if (nx > 0.5) uv.setXY(i, z, y)
    else if (ny > 0.5) uv.setXY(i, x, z)
    else uv.setXY(i, x, y)
  }

  smoothNormals(geometry)
  geometry.clearGroups()
  geometry.computeBoundingSphere()
  return geometry
}

/** Normais suaves entre as faces: soma as normais de todos os triângulos que tocam o mesmo ponto */
function smoothNormals(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  if (!index) return
  const key = (i: number) => `${position.getX(i).toFixed(5)},${position.getY(i).toFixed(5)},${position.getZ(i).toFixed(5)}`
  const keys = Array.from({ length: position.count }, (_, i) => key(i))
  const sums = new Map<string, Vector3>()
  const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()]
  for (let t = 0; t < index.count; t += 3) {
    const [ia, ib, ic] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]
    a.fromBufferAttribute(position, ia)
    b.fromBufferAttribute(position, ib)
    c.fromBufferAttribute(position, ic)
    // Produto vetorial sem normalizar: triângulos maiores pesam mais
    const normal = c.sub(b).cross(a.sub(b))
    for (const vertex of [ia, ib, ic]) {
      const sum = sums.get(keys[vertex])
      if (sum) sum.add(normal)
      else sums.set(keys[vertex], normal.clone())
    }
  }
  const normals = new Float32Array(position.count * 3)
  keys.forEach((vertexKey, i) => {
    const normal = sums.get(vertexKey)?.normalize()
    if (normal) normals.set([normal.x, normal.y, normal.z], i * 3)
  })
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
}
