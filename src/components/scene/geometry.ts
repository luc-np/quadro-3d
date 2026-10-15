import { BoxGeometry, Float32BufferAttribute } from 'three'
import type { Box, Vec3 } from './models/types'

type Axis = 0 | 1 | 2
const AXES: Axis[] = [0, 1, 2]

/** Canal de UV da projeção frontal da arte (o canal 0 é o das texturas que repetem) */
export const ART_UV_CHANNEL = 1

/** Eixo da maior dimensão da peça: é por ele que corre o veio da madeira */
export function grainAxis(size: Vec3): Axis {
  return AXES.reduce((best, axis) => (size[axis] > size[best] ? axis : best))
}

/**
 * BoxGeometry com dois conjuntos de UV, ambos em metros no espaço da parte:
 * - uv (canal 0): cada face mapeada no próprio plano, com u ao longo do veio da peça.
 *   Com repeat = 1 / tile, a textura fica na mesma escala em todas as peças.
 * - uv1 (canal 1): projeção frontal (x, y), usada pela arte. Nas laterais,
 *   x ou y é constante, então a borda da arte estica ao longo da profundidade.
 */
export function createBoxGeometry({ size, position }: Box): BoxGeometry {
  const geometry = new BoxGeometry(...size)
  const vertices = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const grain = grainAxis(size)
  const uv = new Float32Array(vertices.count * 2)
  const uv1 = new Float32Array(vertices.count * 2)

  for (let i = 0; i < vertices.count; i++) {
    const p: Vec3 = [
      vertices.getX(i) + position[0],
      vertices.getY(i) + position[1],
      vertices.getZ(i) + position[2],
    ]
    const n: Vec3 = [normals.getX(i), normals.getY(i), normals.getZ(i)]
    const facing = AXES.reduce((best, axis) => (Math.abs(n[axis]) > Math.abs(n[best]) ? axis : best))
    const [a, b] = AXES.filter((axis) => axis !== facing)
    // u segue o veio; nas faces de topo (veio perpendicular à face) a ordem tanto faz
    const [u, v] = grain === b ? [b, a] : [a, b]

    uv.set([p[u], p[v]], i * 2)
    uv1.set([p[0], p[1]], i * 2)
  }

  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setAttribute('uv1', new Float32BufferAttribute(uv1, 2))
  return geometry
}
