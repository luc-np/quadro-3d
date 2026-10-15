import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three'

/** Ponto do perfil: u = distância para fora da borda do quadro (m), v = profundidade (z, m) */
type ProfilePoint = [number, number]

/**
 * Perfil da cantoneira (corte transversal), um U de espuma que abraça a borda do quadro:
 * parede do lado de fora (u de 0 a t) e abas sobre a frente e o verso (até u = −lip). Tudo
 * arredondado: quinas de fora com raio grande, pontas das abas em meia-lua e as faces de fora
 * levemente estufadas, como espuma. Sentido anti-horário.
 */
export function guardProfile(front: number, back: number, t: number, lip: number): ProfilePoint[] {
  const points: ProfilePoint[] = []
  const arc = (cu: number, cv: number, radius: number, from: number, to: number, steps: number) => {
    for (let i = 0; i <= steps; i++) {
      const angle = ((from + ((to - from) * i) / steps) * Math.PI) / 180
      points.push([cu + radius * Math.cos(angle), cv + radius * Math.sin(angle)])
    }
  }
  /** Face reta de a até b (sem as pontas), estufada para fora em `bulge` no meio */
  const face = (a: ProfilePoint, b: ProfilePoint, bulge: number, steps: number) => {
    const [du, dv] = [b[0] - a[0], b[1] - a[1]]
    const length = Math.hypot(du, dv)
    // Normal de fora de um contorno anti-horário: a direita do sentido do contorno
    const [nu, nv] = [dv / length, -du / length]
    for (let i = 1; i < steps; i++) {
      const f = i / steps
      const out = bulge * Math.sin(Math.PI * f)
      points.push([a[0] + du * f + nu * out, a[1] + dv * f + nv * out])
    }
  }
  const outer = t * 0.95
  const tip = t / 2
  const bulge = t * 0.08
  // Faces que encostam no quadro: aba da frente, lateral, aba de trás (retas: ficam escondidas)
  points.push([-lip, front], [-lip * 0.5, front], [0, front], [0, (front + back) / 2], [0, back], [-lip * 0.5, back])
  // Ponta da aba de trás, fundo, quina, parede de fora, quina, frente e ponta da aba da frente
  arc(-lip, back - tip, tip, 90, 270, 12)
  face([-lip, back - t], [t - outer, back - t], bulge, 6)
  arc(t - outer, back - t + outer, outer, 270, 360, 10)
  face([t, back - t + outer], [t, front + t - outer], bulge, 6)
  arc(t - outer, front + t - outer, outer, 0, 90, 10)
  face([t - outer, front + t], [-lip, front + t], bulge, 6)
  arc(-lip, front + tip, tip, 90, 270, 12)
  // A meia-lua da frente termina no ponto inicial: tira a repetição
  points.pop()
  return points
}

/**
 * Caminho de cada ponto do perfil ao longo da peça: recebe o u do ponto e a fração de cada
 * amostra (mais densas nas pontas, que são arredondadas) e devolve [x, y].
 */
export interface GuardPath {
  /** Frações (0–1) das amostras ao longo da peça */
  samples: number[]
  at: (u: number, sample: number) => [number, number]
}

/** Frações de 0 a 1 com amostras juntas nas duas pontas (`end`, fração do comprimento) para o arredondado */
function endDense(end: number, steps: number, tail = 6): number[] {
  const ends = Array.from({ length: tail }, (_, k) => end * (1 - Math.cos(((k / tail) * Math.PI) / 2)))
  const middle = Array.from({ length: steps + 1 }, (_, k) => end + ((1 - 2 * end) * k) / steps)
  return [...ends, ...middle, ...ends.map((f) => 1 - f).reverse()]
}

/** Peça reta ao longo de uma borda: de `from` a `to` (pontos da borda) com a normal de fora `out` */
export function straightPath(from: [number, number], to: [number, number], out: [number, number], round: number, steps = 12): GuardPath {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1])
  return {
    samples: endDense(Math.min(0.45, round / length), steps),
    at: (u, f) => [from[0] + (to[0] - from[0]) * f + out[0] * u, from[1] + (to[1] - from[1]) * f + out[1] * u],
  }
}

/**
 * Cantoneira de canto (canto de cima, à direita, em (hw, hh)): sobe pela borda direita a partir
 * de hh − leg, contorna a quina e segue pela borda de cima até hw − leg. A curva da quina tem
 * centro recuado em `bend` para dentro: a parede de fora faz uma curva larga e as abas também
 * arredondam perto da quina (longe dela, se encontram em esquadria).
 */
export function cornerPath(hw: number, hh: number, leg: number, bend: number, round: number): GuardPath {
  // Fração do caminho: 0–⅓ perna da direita, ⅓–⅔ curva, ⅔–1 perna de cima
  const head = endDense(Math.min(0.45, round / leg), 8)
    .filter((f) => f < 0.5)
    .map((f) => f * 2)
  const arcSteps = 16
  const samples = [
    ...head.map((f) => f / 3),
    ...Array.from({ length: arcSteps + 1 }, (_, k) => 1 / 3 + k / (arcSteps * 3)),
    ...head.map((f) => 1 - f / 3).reverse(),
  ]
  return {
    samples,
    at: (u, f) => {
      // Centro e raio da curva deste ponto do perfil (raio zero = esquadria)
      const inset = Math.min(u, -bend)
      const radius = Math.max(0, u + bend)
      const [cx, cy] = [hw + inset, hh + inset]
      if (f <= 1 / 3) {
        const g = f * 3
        return [hw + u, hh - leg + (cy - (hh - leg)) * g]
      }
      if (f < 2 / 3) {
        const angle = (f - 1 / 3) * 3 * (Math.PI / 2)
        return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
      }
      const g = (f - 2 / 3) * 3
      return [cx + (hw - leg - cx) * g, hh + u]
    },
  }
}

/**
 * Varre o perfil pelo caminho: uma malha contínua (sem emendas entre parede e abas). As pontas
 * são arredondadas: nos últimos `round` metros o perfil encolhe em arco, como a ponta de uma
 * espuma; a tampa que sobra é pequena. UVs em metros (comprimento × contorno do perfil).
 */
export function sweepGuard(profile: ProfilePoint[], path: GuardPath, round: number): BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const rows = path.samples.length
  const columns = profile.length

  // Normal de fora de cada ponto do perfil (anti-horário: a direita do sentido do contorno)
  const normals = profile.map((_, j) => {
    const [a, b] = [profile[(j - 1 + columns) % columns], profile[(j + 1) % columns]]
    const [du, dv] = [b[0] - a[0], b[1] - a[1]]
    const length = Math.hypot(du, dv) || 1
    return [dv / length, -du / length] as const
  })
  // Contorno do perfil acumulado (v da UV) e comprimento do caminho pela parede de fora (u da UV)
  const around = [0]
  for (let j = 1; j < columns; j++) {
    const [a, b] = [profile[j - 1], profile[j]]
    around.push(around[j - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const outerU = Math.max(...profile.map(([u]) => u))
  const along = [0]
  for (let i = 1; i < rows; i++) {
    const [a, b] = [path.at(outerU, path.samples[i - 1]), path.at(outerU, path.samples[i])]
    along.push(along[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const total = along[rows - 1]

  /** Perfil da amostra i: encolhido perto das pontas (arco de raio `round`) */
  const rowProfile = (i: number): ProfilePoint[] => {
    const fromEnd = Math.min(along[i], total - along[i])
    const shrink = fromEnd >= round ? 0 : round - Math.sqrt(Math.max(0, round * round - (round - fromEnd) ** 2))
    const inset = Math.min(shrink, round * 0.92)
    return profile.map(([u, v], j) => [u - normals[j][0] * inset, v - normals[j][1] * inset])
  }

  const ends: ProfilePoint[][] = []
  for (let i = 0; i < rows; i++) {
    const shape = rowProfile(i)
    if (i === 0 || i === rows - 1) ends.push(shape)
    for (let j = 0; j < columns; j++) {
      const [u, v] = shape[j]
      const [x, y] = path.at(u, path.samples[i])
      positions.push(x, y, v)
      uvs.push(along[i], around[j])
    }
  }
  // Perfil fechado: a última coluna liga de volta na primeira (normais suaves em volta toda)
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < columns; j++) {
      const a = i * columns + j
      const b = (i + 1) * columns + j
      const c = i * columns + ((j + 1) % columns)
      const d = (i + 1) * columns + ((j + 1) % columns)
      indices.push(a, b, c, b, d, c)
    }
  }

  // Tampas (pequenas, no fim do arredondado), com vértices próprios
  ends.forEach((shape, end) => {
    const row = end === 0 ? 0 : rows - 1
    const contour = shape.map(([u, v]) => new Vector2(u, v))
    const start = positions.length / 3
    for (const [u, v] of shape) {
      const [x, y] = path.at(u, path.samples[row])
      positions.push(x, y, v)
      uvs.push(u, v)
    }
    for (const [a, b, c] of ShapeUtils.triangulateShape(contour, [])) {
      // Anti-horário no perfil = tampa virada para trás (início); no fim, ao contrário
      const area = (contour[b].x - contour[a].x) * (contour[c].y - contour[a].y) - (contour[b].y - contour[a].y) * (contour[c].x - contour[a].x)
      const keep = area > 0 !== (end === 1)
      indices.push(start + a, ...(keep ? [start + b, start + c] : [start + c, start + b]))
    }
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
