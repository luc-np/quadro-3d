import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { CanvasTexture, Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Vector2, type BufferGeometry, type Group, type Object3D, type Texture } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { assetUrl } from '@/components/scene/materials'
import type { ModelDef } from '@/components/scene/models/types'
import { cornerPath, guardProfile, straightPath, sweepGuard } from './foamGuard'
import { softBox } from './softBox'
import { useStory } from './scroll'
import { mix, progress, smooth, STORY, unboxPhases, type PackStep } from './story'

/**
 * Embalagem do quadro (m), como sai da fábrica: cantoneiras de polietileno em perfil U
 * (4 de canto; com vidro, mais 4 laterais) e caixa de MDF com tampo e adesivo.
 */
export const PACK = {
  /** Espessura da espuma das cantoneiras */
  foam: 0.014,
  /** Quanto as abas da cantoneira cobrem a frente e o verso do quadro */
  lip: 0.028,
  /** Comprimento de cada perna da cantoneira de canto */
  corner: 0.1,
  /** Folga entre a cantoneira de canto e a lateral */
  gap: 0.02,
  /** MDF das laterais e da base, e do tampo */
  mdf: 0.006,
  lid: 0.006,
  /** Folga entre as cantoneiras e a caixa */
  clearance: 0.004,
  /** Quanto o quadro sai para a frente enquanto a caixa aparece atrás */
  lift: 0.16,
}

/** Medidas do quadro e da caixa, a partir do modelo (origem no centro do quadro, frente para +z) */
export function packMetrics(model: ModelDef) {
  const zs = model.parts.flatMap((part) => part.boxes.flatMap((box) => [box.position[2] - box.size[2] / 2, box.position[2] + box.size[2] / 2]))
  const front = Math.max(...zs)
  const back = Math.min(...zs)
  const hw = model.outer.width / 2
  const hh = model.outer.height / 2
  const { foam, clearance, mdf } = PACK
  const inner = { hw: hw + foam + clearance, hh: hh + foam + clearance, back: back - foam - clearance, front: front + foam + clearance }
  return {
    hw,
    hh,
    front,
    back,
    inner,
    outer: { width: 2 * (inner.hw + mdf), height: 2 * (inner.hh + mdf), depth: inner.front - inner.back + mdf + PACK.lid },
  }
}

type Metrics = ReturnType<typeof packMetrics>
type Range = [number, number]

/** Caixa de espuma ou MDF entre dois cantos (m), com quinas levemente arredondadas */
function piece([x0, x1]: Range, [y0, y1]: Range, [z0, z1]: Range, radius: number): BufferGeometry {
  const geometry = softBox({ size: [x1 - x0, y1 - y0, z1 - z0], radius, segments: { edge: 2, face: 2 } })
  geometry.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return geometry
}

function merged(pieces: BufferGeometry[]): BufferGeometry {
  const geometry = mergeGeometries(pieces)
  pieces.forEach((part) => part.dispose())
  return geometry
}

/**
 * Cantoneiras desenhadas para o lado de cima/direita (os outros lados são espelhos): cada uma é
 * uma peça só, o perfil U de espuma varrido ao longo da borda, sem emendas entre parede e abas.
 */
function guardGeometries({ hw, hh, front, back }: Metrics) {
  const { foam: t, lip, corner, gap } = PACK
  const profile = guardProfile(front, back, t, lip)
  // Pernas da cantoneira de canto, medidas pela borda do quadro a partir da quina
  const leg = corner - t
  const sideHalf = hh - leg - gap
  const topHalf = hw - leg - gap
  // Pontas em meia-cúpula e curva larga na quina: sem nenhuma aresta viva
  const round = t * 0.45
  const bend = 0.015
  return {
    corner: sweepGuard(profile, cornerPath(hw, hh, leg, bend, round), round),
    side: sideHalf > 0.02 ? sweepGuard(profile, straightPath([hw, -sideHalf], [hw, sideHalf], [1, 0], round, 16), round) : null,
    top: topHalf > 0.02 ? sweepGuard(profile, straightPath([topHalf, hh], [-topHalf, hh], [0, 1], round, 12), round) : null,
  }
}

/** Espuma de polietileno: branca, fosca, com a textura de bolhas miúdas */
function useFoamMaterial() {
  const normal = useTexture(assetUrl('/textures/sala/curly_teddy_natural_nor_gl_512.webp'))
  const material = useMemo(() => {
    // Cópia: a textura original é a da almofada da sala, com outra repetição
    const bubbles = normal.clone()
    bubbles.wrapS = bubbles.wrapT = RepeatWrapping
    bubbles.repeat.setScalar(1 / 0.05)
    bubbles.needsUpdate = true
    // Branco puxado para o quente: o branco puro fica azulado sob a luz de estúdio
    return new MeshStandardMaterial({ color: '#f4efe6', roughness: 0.9, normalMap: bubbles, normalScale: new Vector2(0.35, 0.35) })
  }, [normal])
  useEffect(
    () => () => {
      material.normalMap?.dispose()
      material.dispose()
    },
    [material],
  )
  return material
}

const SIDES: { sx: number; sy: number }[] = [
  { sx: 1, sy: 1 },
  { sx: -1, sy: 1 },
  { sx: -1, sy: -1 },
  { sx: 1, sy: -1 },
]

/** Ordem de entrada de cada uma de n peças dentro do trecho (uma depois da outra, com sobreposição) */
function staggered(t: number, index: number, count: number): number {
  const span = 0.55
  const start = ((1 - span) * index) / Math.max(1, count - 1)
  return smooth(Math.min(1, Math.max(0, (t - start) / span)))
}

interface GuardsProps {
  model: ModelDef
  /** Pontos das peças onde chegam as linhas das etiquetas */
  anchorsRef: RefObject<Partial<Record<PackStep, Object3D>>>
}

/** As cantoneiras: chegam voando de fora e encaixam nas pontas (e, com vidro, nas bordas). Ficam no grupo do quadro. */
export function Guards({ model, anchorsRef }: GuardsProps) {
  const storyRef = useStory()
  const metrics = useMemo(() => packMetrics(model), [model])
  const glass = model.parts.some((part) => part.id === 'vidro')
  const material = useFoamMaterial()
  const geometries = useMemo(() => guardGeometries(metrics), [metrics])
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry?.dispose()), [geometries])
  const corners = useRef<(Group | null)[]>([])
  const edges = useRef<(Group | null)[]>([])

  useFrame(() => {
    const cornersIn = progress(storyRef.current.offset, STORY.corners)
    const edgesIn = glass ? progress(storyRef.current.offset, STORY.edges) : 0
    // Ao abrir a caixa, as cantoneiras soltam pelo mesmo caminho por onde chegaram
    const { guardsOff } = unboxPhases(storyRef.current.offset)
    corners.current.forEach((group, index) => {
      if (!group) return
      const t = staggered(cornersIn, index, SIDES.length)
      const away = Math.max(1 - t, guardsOff)
      group.visible = t > 0 && guardsOff < 1
      group.position.set(SIDES[index].sx * away * 0.35, SIDES[index].sy * away * 0.35, away * 0.3)
      group.rotation.z = away * 0.8 * SIDES[index].sx
    })
    edges.current.forEach((group, index) => {
      if (!group) return
      const t = staggered(edgesIn, index, 4)
      const away = Math.max(1 - t, guardsOff)
      group.visible = t > 0 && guardsOff < 1
      // Lado de cada perfil: direita, cima, esquerda, baixo
      const [dx, dy] = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ][index]
      group.position.set(dx * away * 0.3, dy * away * 0.3, away * 0.25)
    })
  })

  const { hw, hh, front } = metrics
  const t = PACK.foam
  return (
    <group>
      {SIDES.map(({ sx, sy }, index) => (
        <group
          key={`corner${index}`}
          ref={(group) => {
            corners.current[index] = group
          }}
          visible={false}
        >
          <mesh geometry={geometries.corner} material={material} scale={[sx, sy, 1]} castShadow receiveShadow />
          {/* A linha da etiqueta chega na cantoneira de cima, à esquerda */}
          {sx === -1 && sy === 1 && (
            <group
              position={[-(hw + t), hh + t, front + t]}
              ref={(anchor) => {
                anchorsRef.current.corners = anchor ?? undefined
              }}
            />
          )}
        </group>
      ))}
      {glass &&
        [
          { geometry: geometries.side, scale: [1, 1, 1] },
          { geometry: geometries.top, scale: [1, 1, 1] },
          { geometry: geometries.side, scale: [-1, 1, 1] },
          { geometry: geometries.top, scale: [1, -1, 1] },
        ].map(({ geometry, scale }, index) =>
          geometry ? (
            <group
              key={`edge${index}`}
              ref={(group) => {
                edges.current[index] = group
              }}
              visible={false}
            >
              <mesh geometry={geometry} material={material} scale={scale as [number, number, number]} castShadow receiveShadow />
              {index === 2 && (
                <group
                  position={[-(hw + t), -hh * 0.2, front + t]}
                  ref={(anchor) => {
                    anchorsRef.current.edges = anchor ?? undefined
                  }}
                />
              )}
            </group>
          ) : null,
        )}
    </group>
  )
}

// ─── Caixa e tampo ───────────────────────────────────────────────────────────

/** MDF cru da caixa: o mesmo do fundo do quadro (ambientCG "Paper006"), em cópia com a repetição da caixa */
function useMdfMaterial() {
  const [map, roughnessMap] = useTexture([assetUrl('/textures/mdf/paper006_diff_1k.webp'), assetUrl('/textures/mdf/paper006_rough_1k.webp')])
  const material = useMemo(() => {
    const own = (texture: Texture, color: boolean) => {
      const copy = texture.clone()
      copy.wrapS = copy.wrapT = RepeatWrapping
      copy.repeat.setScalar(1 / 0.25)
      copy.anisotropy = 8
      if (color) copy.colorSpace = SRGBColorSpace
      copy.needsUpdate = true
      return copy
    }
    // A textura sozinha sai marrom: a cor acima de 1 (linear) clareia para o caramelo claro do MDF das fotos
    const color = new Color().setRGB(1.5, 1.3, 1.08)
    return new MeshStandardMaterial({ color, roughness: 1, map: own(map, true), roughnessMap: own(roughnessMap, false) })
  }, [map, roughnessMap])
  useEffect(
    () => () => {
      material.map?.dispose()
      material.roughnessMap?.dispose()
      material.dispose()
    },
    [material],
  )
  return material
}

interface CrateProps {
  model: ModelDef
  anchorsRef: RefObject<Partial<Record<PackStep, Object3D>>>
}

/**
 * A caixa de MDF sem tampo (sobe de baixo, atrás do quadro) e o tampo com o adesivo (fecha pela frente).
 * Fica num grupo com o mesmo giro do quadro, mas sem o avanço dele: o quadro é que entra na caixa.
 */
export function Crate({ model, anchorsRef }: CrateProps) {
  const storyRef = useStory()
  const metrics = useMemo(() => packMetrics(model), [model])
  const mdf = useMdfMaterial()
  const sticker = useSticker()
  const box = useRef<Group>(null)
  const lid = useRef<Group>(null)

  const geometries = useMemo(() => {
    const { inner } = metrics
    const { mdf: m, lid: lt } = PACK
    const r = 0.0015
    const wall: Range = [inner.back, inner.front]
    const lidSize = { width: 2 * (inner.hw + m), height: 2 * (inner.hh + m) }
    return {
      box: merged([
        // Base, laterais em volta dela e topo/fundo entre as laterais (como as caixas da fábrica)
        piece([-inner.hw - m, inner.hw + m], [-inner.hh - m, inner.hh + m], [inner.back - m, inner.back], r),
        piece([inner.hw, inner.hw + m], [-inner.hh - m, inner.hh + m], wall, r),
        piece([-inner.hw - m, -inner.hw], [-inner.hh - m, inner.hh + m], wall, r),
        piece([-inner.hw, inner.hw], [inner.hh, inner.hh + m], wall, r),
        piece([-inner.hw, inner.hw], [-inner.hh - m, -inner.hh], wall, r),
      ]),
      lid: piece([-lidSize.width / 2, lidSize.width / 2], [-lidSize.height / 2, lidSize.height / 2], [inner.front, inner.front + lt], r),
      lidSize,
    }
  }, [metrics])
  useEffect(
    () => () => {
      geometries.box.dispose()
      geometries.lid.dispose()
    },
    [geometries],
  )

  useFrame(() => {
    const boxIn = smooth(progress(storyRef.current.offset, STORY.box))
    // Fecha com o tampo e, no fim, abre de novo: o tampo sai pelo mesmo caminho e a caixa desce
    const { lidOff, boxDown } = unboxPhases(storyRef.current.offset)
    const lidIn = smooth(progress(storyRef.current.offset, STORY.lid)) * (1 - lidOff)
    if (box.current) {
      box.current.visible = boxIn > 0 && boxDown < 1
      box.current.position.y = mix(-1.1, 0, boxIn) - 1.1 * boxDown
    }
    if (lid.current) {
      lid.current.visible = lidIn > 0
      lid.current.position.set(0, mix(0.35, 0, lidIn), mix(0.5, 0, lidIn))
      lid.current.rotation.x = mix(-0.7, 0, lidIn)
    }
  })

  const { inner } = metrics
  const stickerWidth = geometries.lidSize.width * 0.84
  const stickerHeight = stickerWidth / STICKER.aspect
  return (
    <group>
      <group ref={box} visible={false}>
        <mesh geometry={geometries.box} material={mdf} castShadow receiveShadow />
        <group
          position={[-inner.hw - PACK.mdf, -inner.hh * 0.55, inner.front]}
          ref={(anchor) => {
            anchorsRef.current.box = anchor ?? undefined
          }}
        />
      </group>
      <group ref={lid} visible={false}>
        <mesh geometry={geometries.lid} material={mdf} castShadow receiveShadow />
        <mesh position={[0, 0, inner.front + PACK.lid + 0.0006]} material={sticker}>
          <planeGeometry args={[stickerWidth, stickerHeight]} />
        </mesh>
        <group
          position={[-stickerWidth * 0.42, 0, inner.front + PACK.lid]}
          ref={(anchor) => {
            anchorsRef.current.lid = anchor ?? undefined
          }}
        />
      </group>
    </group>
  )
}

// ─── Adesivo ─────────────────────────────────────────────────────────────────

/** Adesivo vinho do tampo (o da fábrica): FRÁGIL nas pontas, CUIDADO VIDRO no meio, PRODUTO RASTREADO embaixo */
const STICKER = { width: 1600, height: 640, aspect: 1600 / 640, red: '#8a1c3a', white: '#ffffff' }

/** O adesivo desenhado num canvas com a fonte da página (redesenhado quando a fonte termina de carregar) */
function useSticker() {
  const element = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  const sticker = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = STICKER.width
    canvas.height = STICKER.height
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    // Vinil: um pouco de brilho
    const material = new MeshStandardMaterial({ map: texture, roughness: 0.45 })
    return {
      material,
      draw(family: string) {
        drawSticker(canvas, family)
        texture.needsUpdate = true
      },
      dispose() {
        texture.dispose()
        material.dispose()
      },
    }
  }, [])
  useEffect(() => {
    const family = getComputedStyle(element).getPropertyValue('--font-especial').trim() || 'Arial, sans-serif'
    const draw = () => {
      sticker.draw(family)
      invalidate()
    }
    draw()
    document.fonts.load(`800 100px ${family}`).then(draw, () => undefined)
    return () => sticker.dispose()
  }, [sticker, element, invalidate])
  return sticker.material
}

function drawSticker(canvas: HTMLCanvasElement, family: string) {
  const { width: W, height: H, red, white } = STICKER
  const context = canvas.getContext('2d')!
  const font = (size: number) => `800 ${size}px ${family}`
  const pad = 22
  const side = 150
  const bottom = 150
  context.fillStyle = red
  context.fillRect(0, 0, W, H)
  context.strokeStyle = white
  context.fillStyle = white
  context.lineWidth = 8
  context.strokeRect(pad, pad, W - pad * 2, H - pad * 2)
  // Colunas das pontas, com FRÁGIL em pé
  context.beginPath()
  context.moveTo(pad + side, pad)
  context.lineTo(pad + side, H - pad)
  context.moveTo(W - pad - side, pad)
  context.lineTo(W - pad - side, H - pad)
  context.moveTo(pad + side, H - pad - bottom)
  context.lineTo(W - pad - side, H - pad - bottom)
  context.stroke()
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const [x, angle] of [
    [pad + side / 2, -Math.PI / 2],
    [W - pad - side / 2, Math.PI / 2],
  ]) {
    context.save()
    context.translate(x, (H - pad * 2) / 2 + pad)
    context.rotate(angle)
    context.font = font(104)
    context.fillText('FRÁGIL', 0, 4)
    context.restore()
  }
  // Faixa de baixo: PRODUTO RASTREADO, com o ícone da caixa e da lupa
  const bandY = H - pad - bottom / 2
  context.font = font(78)
  const label = 'PRODUTO RASTREADO'
  const labelWidth = context.measureText(label).width
  const iconX = W / 2 - labelWidth / 2 - 70
  context.fillText(label, W / 2 + 40, bandY + 4)
  drawTrackIcon(context, iconX, bandY)
  // Bloco do meio: taça trincada, CUIDADO, setas e VIDRO na faixa branca
  const block = { x: pad + side + 26, y: pad + 26, w: W - (pad + side + 26) * 2, h: H - pad * 2 - bottom - 52 }
  context.lineWidth = 6
  context.strokeRect(block.x, block.y, block.w, block.h)
  drawBrokenGlass(context, block.x + 95, block.y + block.h / 2, block.h * 0.8)
  const textX = block.x + 190 + (block.w - 190) / 2
  context.font = font(118)
  context.fillText('CUIDADO', textX, block.y + 82)
  drawChevrons(context, block.x + 230, block.y + 162, block.w - 270, 36)
  const plate = { x: block.x + 220, y: block.y + 210, w: block.w - 250, h: block.h - 232 }
  context.fillRect(plate.x, plate.y, plate.w, plate.h)
  context.fillStyle = red
  context.font = font(132)
  context.fillText('VIDRO', plate.x + plate.w / 2, plate.y + plate.h / 2 + 6)
}

/** Taça branca com uma trinca vinho */
function drawBrokenGlass(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const { red, white } = STICKER
  const top = y - size / 2
  const bowl = size * 0.5
  context.fillStyle = white
  context.beginPath()
  context.moveTo(x - size * 0.2, top)
  context.lineTo(x + size * 0.2, top)
  context.quadraticCurveTo(x + size * 0.22, top + bowl, x + size * 0.03, top + bowl + size * 0.04)
  context.lineTo(x + size * 0.025, y + size * 0.38)
  context.lineTo(x + size * 0.16, y + size * 0.46)
  context.lineTo(x - size * 0.16, y + size * 0.46)
  context.lineTo(x - size * 0.025, y + size * 0.38)
  context.lineTo(x - size * 0.03, top + bowl + size * 0.04)
  context.quadraticCurveTo(x - size * 0.22, top + bowl, x - size * 0.2, top)
  context.fill()
  context.strokeStyle = red
  context.lineWidth = size * 0.025
  context.beginPath()
  context.moveTo(x - size * 0.1, top + size * 0.02)
  context.lineTo(x - size * 0.03, top + size * 0.13)
  context.lineTo(x - size * 0.11, top + size * 0.2)
  context.lineTo(x - size * 0.02, top + size * 0.3)
  context.stroke()
  context.fillStyle = white
  context.strokeStyle = white
}

/** Fileira de setas (») entre CUIDADO e VIDRO */
function drawChevrons(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const step = height * 0.9
  for (let left = x; left + step <= x + width; left += step) {
    context.beginPath()
    context.moveTo(left, y)
    context.lineTo(left + step * 0.45, y)
    context.lineTo(left + step * 0.8, y + height / 2)
    context.lineTo(left + step * 0.45, y + height)
    context.lineTo(left, y + height)
    context.lineTo(left + step * 0.35, y + height / 2)
    context.closePath()
    context.fill()
  }
}

/** Caixinha com uma lupa: "produto rastreado" */
function drawTrackIcon(context: CanvasRenderingContext2D, x: number, y: number) {
  context.lineWidth = 7
  context.strokeRect(x - 44, y - 30, 56, 56)
  context.beginPath()
  context.moveTo(x - 44, y - 12)
  context.lineTo(x + 12, y - 12)
  context.stroke()
  context.beginPath()
  context.arc(x + 22, y + 6, 22, 0, Math.PI * 2)
  context.stroke()
  context.beginPath()
  context.moveTo(x + 38, y + 22)
  context.lineTo(x + 56, y + 40)
  context.stroke()
}
