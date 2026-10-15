import type { Box, Face, Shape, Vec3 } from './types'

/**
 * Quatro peças em volta de um retângulo `inner` (centrado na origem), com largura `band`:
 * em cima e embaixo de ponta a ponta, nas laterais só entre elas (sem sobrepor nos cantos).
 * Serve para moldura, apoio, chassi e as laterais da tela. Ordem: topo, base, direita, esquerda.
 */
export function ring(innerWidth: number, innerHeight: number, band: number, depth: number, z: number): Shape[] {
  const outerWidth = innerWidth + 2 * band
  const y = innerHeight / 2 + band / 2
  const x = innerWidth / 2 + band / 2
  return [
    { size: [outerWidth, band, depth], position: [0, y, z] },
    { size: [outerWidth, band, depth], position: [0, -y, z] },
    { size: [band, innerHeight, depth], position: [x, 0, z] },
    { size: [band, innerHeight, depth], position: [-x, 0, z] },
  ]
}

/** Placa retangular centrada em x e y */
export function plate(width: number, height: number, depth: number, z: number): Shape {
  return { size: [width, height, depth], position: [0, 0, z] }
}

/** Face que aponta para fora do quadro numa peça lateral, deduzida da posição */
export function outwardFace([x, y]: Vec3): Face {
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'px' : 'nx'
  return y > 0 ? 'py' : 'ny'
}

export function withFace<S extends string>(shape: Shape, face: Face, surface: S): Box<S> {
  const faces: Partial<Record<Face, S>> = {}
  faces[face] = surface
  return { ...shape, faces }
}
