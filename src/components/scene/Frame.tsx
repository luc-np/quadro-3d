import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { Group } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { createBoxGeometry } from './geometry'
import { createHardwareGeometry } from './hardwareGeometry'
import { boxMaterial, createSurfaceMaterials, disposeSurfaceMaterials, textureUrls } from './materials'
import type { ModelDef, PartDef, Size2 } from './models/types'
import { PartMarker } from './PartMarker'
import { FRAME_ORDER, readExplode, type ExplodeValue } from './timeline'

/** Filtragem anisotrópica máxima: nitidez da trama e do veio em ângulo rasante */
const MAX_ANISOTROPY = 8

interface FrameProps {
  model: ModelDef
  explode?: ExplodeValue
  /** Multiplica a separação das camadas (ex.: menor no celular), sem mudar o progresso */
  explodeScale?: number
  /** Elemento HTML onde desenhar o número de cada parte (par da legenda). Sem ele, não há números. */
  markerLayer?: HTMLElement
  /**
   * Marcador próprio de cada parte, no lugar do número (ex.: o botão "+" do visualizador da
   * loja). Fica dentro do grupo da parte: acompanha a parte quando ela se afasta.
   */
  renderMarker?: (part: PartDef, index: number) => ReactNode
}

/** Renderiza qualquer modelo descrito em models/. Carrega texturas com useTexture: precisa estar dentro de um <Suspense>. */
export function Frame({ model, explode = 0, explodeScale = 1, markerLayer, renderMarker }: FrameProps) {
  return (
    <group>
      {model.parts.map((part, index) => (
        <Part
          key={part.id}
          part={part}
          index={index}
          count={model.parts.length}
          art={model.art}
          explode={explode}
          explodeScale={explodeScale}
          markerLayer={markerLayer}
          marker={renderMarker?.(part, index)}
        />
      ))}
    </group>
  )
}

interface PartProps {
  part: PartDef
  /** Posição na lista de partes: define o número na legenda */
  index: number
  count: number
  /** Área onde a arte é projetada */
  art: Size2
  explode: ExplodeValue
  explodeScale: number
  markerLayer?: HTMLElement
  marker?: ReactNode
}

function Part({ part, index, count, art, explode, explodeScale, markerLayer, marker }: PartProps) {
  // Cada parte desloca em z por part.explode × progresso; lido no frame para acompanhar refs
  const group = useRef<Group>(null)
  useFrame(() => {
    if (group.current) group.current.position.z = part.explode * explodeScale * readExplode(explode)
  }, FRAME_ORDER.parts)

  const geometries = useMemo(() => part.boxes.map(createBoxGeometry), [part])
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries])

  const hardware = useMemo(() => part.hardware ?? [], [part])
  const hardwareGeometries = useMemo(() => hardware.map((item) => createHardwareGeometry(item.kind)), [hardware])
  useEffect(() => () => hardwareGeometries.forEach((geometry) => geometry.dispose()), [hardwareGeometries])

  const urls = useMemo(() => textureUrls(part.surfaces), [part])
  const textures = useTexture(urls)
  const anisotropy = useThree((state) => Math.min(MAX_ANISOTROPY, state.gl.capabilities.getMaxAnisotropy()))

  const materials = useMemo(
    () => createSurfaceMaterials(part.surfaces, { textures, artSize: [art.width, art.height], anisotropy }),
    [part, textures, art, anisotropy],
  )
  useEffect(() => () => disposeSurfaceMaterials(materials), [materials])

  return (
    <group ref={group} name={part.id}>
      {part.boxes.map((box, i) => (
        <mesh
          key={i}
          position={box.position}
          geometry={geometries[i]}
          material={boxMaterial(box, materials, part.baseSurface)}
          castShadow={part.shadows.cast}
          receiveShadow={part.shadows.receive}
        />
      ))}
      {hardware.map((item, i) => (
        <mesh
          key={`ferragem-${i}`}
          position={item.position}
          rotation={item.rotation}
          geometry={hardwareGeometries[i]}
          material={materials[item.surface]}
          castShadow={part.shadows.cast}
          receiveShadow={part.shadows.receive}
        />
      ))}
      {markerLayer && (
        <PartMarker number={index + 1} count={count} position={part.marker} explode={explode} layer={markerLayer} />
      )}
      {marker}
    </group>
  )
}
