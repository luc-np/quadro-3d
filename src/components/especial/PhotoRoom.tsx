import { useEffect, useLayoutEffect, useMemo, type RefObject } from 'react'
import { CanvasTexture, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Group, type Material, type Texture } from 'three'
import { useTexture } from '@react-three/drei'
import { assetUrl } from '@/components/scene/materials'
import type { Vec3 } from '@/components/scene/models/types'
import { ROOM } from './Room'

/**
 * Foto de um ambiente tirada de frente para a parede, com a parede livre. Calibrada pelas linhas
 * do piso e do teto na parede: a distância entre elas é o pé-direito (AMBIENT.ceiling).
 */
export interface AmbientPhoto {
  src: string
  /** Tamanho da imagem (px) */
  width: number
  height: number
  /** y (px) de onde a parede encontra o piso e o teto */
  floorLine: number
  ceilingLine: number
  /** x (px) do eixo da parede livre: o centro do quadro fica nele */
  axis: number
  /** Quanto aproximar além de "cobrir a tela" (1 = a maior parte da foto que cabe) */
  zoom: number
  /** Altura (m, a partir do piso) do centro do enquadramento */
  viewHeight: number
  /**
   * Camada da frente (mesmo tamanho da foto, transparente fora dos objetos): planta, abajur, vaso e
   * cortina, desenhados por cima do quadro — um conjunto largo passa por trás deles
   */
  front?: string
}

/**
 * O ambiente em foto, no lugar da sala 3D (null = usa a sala 3D). Uma foto para o computador
 * e outra, vertical, para o celular. A luz principal vai para o lado da luz da foto enquanto
 * o quadro está na parede, e a sombra dele na parede cai para o lado oposto, como a dos móveis.
 */
export const AMBIENT: {
  ceiling: number
  /** Altura do encosto do sofá (m) e a folga entre ele e a base do quadro (regra de decoração: 20–25 cm) */
  sofaTop: number
  hangGap: number
  light: Vec3
  wide: AmbientPhoto | null
  narrow: AmbientPhoto | null
} = {
  ceiling: 2.8,
  sofaTop: 0.89,
  hangGap: 0.22,
  // Janela à esquerda, luz difusa: as sombras dos móveis caem de leve para a direita
  light: [-2.5, 1.2, 2],
  // Medidas nas fotos (px). Computador: teto e piso na parede (pé-direito de 2,80 m, encosto do
  // sofá dá 0,89 m). Celular: o teto não aparece, a escala vem do encosto do sofá (586 px = 0,89 m),
  // e a "linha do teto" é calculada (3257 − 2,8 × 658 px/m).
  // Zoom: o quadro aparece grande o bastante para ver a arte, com o sofá dando a escala; os
  // tamanhos grandes abrem o enquadramento sozinhos (photoView)
  wide: { src: '/ambiente/computador.webp', width: 3840, height: 2160, floorLine: 1824, ceilingLine: 163, axis: 1920, zoom: 1.95, viewHeight: 1.15 },
  narrow: { src: '/ambiente/celular.webp', width: 2160, height: 3840, floorLine: 3257, ceilingLine: 1414, axis: 1080, zoom: 2.05, viewHeight: 1.5 },
}

/** Folga (m) entre o topo do quadro e a borda de cima da tela, no ambiente */
const TOP_MARGIN = 0.18
/** Folga (m) de cada lado do conjunto, quando ele é largo para o enquadramento */
const SIDE_MARGIN = 0.3
/** Quanto do móvel (fração da altura, a partir do topo) fica à mostra embaixo do quadro */
const FURNITURE_SHOWN = 0.65

/**
 * Altura (m, do piso) do centro do quadro na parede: 1,45 m (a altura dos olhos), subindo o
 * que for preciso para a base ficar `hangGap` acima do encosto do sofá. Um 100×150 não desce
 * atrás do sofá; ele sobe e fica com a base logo acima dele, como se pendura de verdade.
 */
export function hangHeight(quadroHeight: number, furnitureTop = AMBIENT.sofaTop): number {
  return Math.max(-ROOM.floorY, furnitureTop + AMBIENT.hangGap + quadroHeight / 2)
}

/** Folga (m) entre o topo do quadro e o alto da foto: a de cima da tela (TOP_MARGIN) e a faixa das pílulas */
const WALL_ROOM = 0.4

/**
 * `hangHeight` dentro da parede que a foto mostra. Com a escala da largura do móvel, a foto de um móvel
 * estreito cobre pouca parede (o aparador de 0,90 m vai só até 1,84 m do piso): o quadro desce até o
 * topo ficar `WALL_ROOM` abaixo do alto da foto, sem a base chegar a menos de `hangGap` do móvel. Onde a
 * parede sobra, é o `hangHeight` (12/11/2026).
 */
export function hangOnPhoto(quadroHeight: number, furnitureTop: number, photo: AmbientPhoto): number {
  const wallTop = (photo.floorLine * AMBIENT.ceiling) / (photo.floorLine - photo.ceilingLine)
  const lowest = furnitureTop + AMBIENT.hangGap + quadroHeight / 2
  return Math.max(lowest, Math.min(hangHeight(quadroHeight, furnitureTop), wallTop - WALL_ROOM - quadroHeight / 2))
}

/** Escala da foto (m por px) e onde ela fica na cena: o eixo em x = 0 e o piso em ROOM.floorY */
function placement(photo: AmbientPhoto) {
  const meters = AMBIENT.ceiling / (photo.floorLine - photo.ceilingLine)
  const width = photo.width * meters
  const height = photo.height * meters
  const x = (photo.width / 2 - photo.axis) * meters
  const y = ROOM.floorY + (photo.floorLine - photo.height / 2) * meters
  return { meters, width, height, x, y }
}

/**
 * O que a câmera mostra da foto: um retângulo com a proporção da tela, o maior que cabe
 * dentro dela dividido pelo zoom, centrado no eixo e na altura pedida (sem sair da foto).
 * `quadroTop` (m, do piso): o enquadramento abre (e, no limite da foto, sobe) até o topo do quadro
 * caber com folga abaixo de `reserve` (fração da altura, em cima, ocupada pela frase no celular).
 * `shift`: quanto a imagem é deslocada para o lado depois (fração da largura, positivo = a janela
 * vai para a direita, como no setViewOffset): o limite da foto vale para a janela deslocada.
 * `shiftY`: o mesmo na vertical (positivo = a janela desce, o conteúdo sobe; ex.: uma faixa
 * cobrindo o pé da tela no celular).
 * O enquadramento nunca é maior que a foto (zoom abaixo de 1 vale 1).
 * A câmera fica de frente, sem inclinar: inclinada, entortaria a perspectiva da foto.
 * Coordenadas da sala (o piso em ROOM.floorY).
 */
export function photoView(
  photo: AmbientPhoto,
  viewport: { width: number; height: number },
  quadroTop = 0,
  reserve = 0,
  shift = 0,
  shiftY = 0,
  /** Largura do conjunto e topo do móvel (m): com eles, o enquadramento abre para o conjunto inteiro e o móvel à mostra */
  scene: { setWidth?: number; furnitureTop?: number } = {},
) {
  const place = placement(photo)
  const aspect = viewport.width / viewport.height
  const fit = Math.min(place.width, place.height * aspect)
  let width = fit / Math.max(1, photo.zoom)
  let height = width / aspect
  const needed = ROOM.floorY + quadroTop + TOP_MARGIN
  // Mantém a base do enquadramento (o sofá à mostra) e abre até o quadro caber abaixo da reserva;
  // no máximo, a foto inteira na largura
  const bottom = ROOM.floorY + photo.viewHeight - height / 2
  const free = 1 - reserve - shiftY
  if (bottom + height * free < needed) {
    height = Math.min((needed - bottom) / free, fit / aspect)
    width = height * aspect
  }
  // Quadros grandes e conjuntos largos: abre até caber o conjunto na largura (com folga dos lados) e o
  // alto do móvel embaixo dele; antes o duo passava da borda e o sofá saía de cena
  const { setWidth = 0, furnitureTop = 0 } = scene
  const low = ROOM.floorY + furnitureTop * (1 - FURNITURE_SHOWN)
  const minHeight = Math.max(setWidth > 0 ? (setWidth + 2 * SIDE_MARGIN) / aspect : 0, furnitureTop > 0 ? (needed - low) / free : 0)
  if (height < minHeight) {
    height = Math.min(minHeight, fit / aspect)
    width = height * aspect
  }
  const topCenter = needed - height * (0.5 - reserve) + shiftY * height
  let center = Math.max(ROOM.floorY + photo.viewHeight, topCenter)
  if (furnitureTop > 0) center = Math.max(topCenter, Math.min(center, low + height / 2 + shiftY * height))
  const clamp = (value: number, center: number, span: number, size: number) =>
    Math.min(center + span / 2 - size / 2, Math.max(center - span / 2 + size / 2, value))
  return {
    x: clamp(shift * width, place.x, place.width, width) - shift * width,
    // O centro que deixa o topo do quadro logo abaixo da reserva (ou o pedido, se for mais alto)
    y: clamp(center - shiftY * height, place.y, place.height, height) + shiftY * height,
    width,
    height,
  }
}

interface PhotoRoomProps {
  photo: AmbientPhoto
  group: RefObject<Group | null>
  /** Recebe os materiais (foto e sombra): quem anima a cena muda a opacidade deles */
  materialsRef: RefObject<Material[]>
}

/** A foto como parede (a sombra do quadro é a WallShadow, abaixo) */
export function PhotoRoom({ photo, group, materialsRef }: PhotoRoomProps) {
  const texture = useTexture(assetUrl(photo.src), configurePhoto)
  // Sem camada da frente, pede a própria foto de novo (fica no cache) e não desenha nada por cima
  const frontTexture = useTexture(assetUrl(photo.front ?? photo.src), configurePhoto)
  const place = useMemo(() => placement(photo), [photo])
  const geometry = useMemo(() => new PlaneGeometry(place.width, place.height), [place])
  useEffect(() => () => geometry.dispose(), [geometry])

  // A foto já tem luz, sombra e cor finais: sem iluminação e sem tone mapping, aparece como foi feita
  const material = useMemo(() => new MeshBasicMaterial({ map: texture, toneMapped: false }), [texture])
  useEffect(() => () => material.dispose(), [material])
  // A frente vai por cima de tudo (sem teste de profundidade, desenhada por último), no plano da foto:
  // assim ela cai exatamente sobre os mesmos objetos da foto, de qualquer ponto da câmera
  const frontMaterial = useMemo(() => {
    if (!photo.front) return null
    const front = new MeshBasicMaterial({ map: frontTexture, toneMapped: false, transparent: true, depthTest: false, depthWrite: false })
    front.userData.alpha = true
    return front
  }, [frontTexture, photo.front])
  useEffect(() => () => frontMaterial?.dispose(), [frontMaterial])
  useLayoutEffect(() => {
    materialsRef.current = frontMaterial ? [material, frontMaterial] : [material]
  }, [material, frontMaterial, materialsRef])

  return (
    <group ref={group}>
      <mesh geometry={geometry} position={[place.x, place.y, ROOM.wallZ]} material={material} />
      {frontMaterial && <mesh geometry={geometry} position={[place.x, place.y, ROOM.wallZ]} material={frontMaterial} renderOrder={20} />}
    </group>
  )
}

/**
 * Sombra do quadro na parede da foto, pintada como nos mockups: uma de contato (justa e escura,
 * o quadro encostado) e uma da luz da foto (larga e macia, deslocada para longe da luz). A sombra
 * calculada pela luz sai dura e deslocada demais perto de uma foto.
 */
const SHADOW_LAYERS = [
  { blur: 0.01, grow: 0.004, distance: 0.006, opacity: 0.45 },
  { blur: 0.04, grow: 0.016, distance: 0.03, opacity: 0.4 },
]

interface WallShadowProps {
  /** Contorno do quadro (m) */
  width: number
  height: number
  /** Recebe os materiais: quem anima muda a opacidade conforme o quadro chega ou sai da parede */
  materialsRef: RefObject<Material[]>
}

export function WallShadow({ width, height, materialsRef }: WallShadowProps) {
  const layers = useMemo(() => {
    const [lx, ly] = AMBIENT.light
    const length = Math.hypot(lx, ly) || 1
    return SHADOW_LAYERS.map(({ blur, grow, distance, opacity }) => {
      const margin = blur * 3
      const material = new MeshBasicMaterial({ color: '#2e2219', alphaMap: softRectTexture(width + grow, height + grow, blur, margin), transparent: true, depthWrite: false })
      material.userData.opacity = opacity
      return {
        material,
        size: [width + grow + margin * 2, height + grow + margin * 2] as const,
        offset: [(-lx / length) * distance, (-ly / length) * distance] as const,
      }
    })
  }, [width, height])
  useEffect(
    () => () =>
      layers.forEach(({ material }) => {
        material.alphaMap?.dispose()
        material.dispose()
      }),
    [layers],
  )
  useLayoutEffect(() => {
    materialsRef.current = layers.map(({ material }) => material)
  }, [layers, materialsRef])

  return layers.map(({ material, size, offset }, index) => (
    <mesh key={index} position={[offset[0], offset[1], ROOM.wallZ + 0.003 + index * 0.0005]} material={material} renderOrder={2}>
      <planeGeometry args={[size[0], size[1]]} />
    </mesh>
  ))
}

/** Retângulo desfocado (alphaMap: branco = sombra), em metros: `margin` de folga para o desfoque */
function softRectTexture(width: number, height: number, blur: number, margin: number): CanvasTexture {
  const scale = 512 / (Math.max(width, height) + margin * 2)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round((width + margin * 2) * scale)
  canvas.height = Math.round((height + margin * 2) * scale)
  const context = canvas.getContext('2d')!
  context.fillStyle = '#000'
  context.fillRect(0, 0, canvas.width, canvas.height)
  // Desenhado fora do canvas: só a sombra (desfocada) dele cai dentro
  context.shadowColor = '#fff'
  context.shadowBlur = blur * scale * 2
  context.shadowOffsetX = canvas.width * 2
  context.fillRect(margin * scale - canvas.width * 2, margin * scale, width * scale, height * scale)
  return new CanvasTexture(canvas)
}

function configurePhoto(texture: Texture) {
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
}
