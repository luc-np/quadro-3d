import { useDeferredValue, useEffect, useMemo, useRef, type RefObject } from 'react'
import { AdditiveBlending, Vector3, type AmbientLight, type DirectionalLight, type Group, type Material, type Mesh, type MeshStandardMaterial, type Object3D, type PerspectiveCamera } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Frame } from '@/components/scene/Frame'
import { EXPLODE_SCALE, EXPLODE_YAW, fitDistance, frameExtent } from '@/components/scene/layout'
import type { ModelDef, Vec3 } from '@/components/scene/models/types'
import { CAMERA, KEY_LIGHT } from '@/components/scene/Studio'
import { CHOICES, type ChoiceKey } from './labels'
import { Crate, Guards, PACK, packMetrics } from './Packaging'
import { AMBIENT, hangHeight, PhotoRoom, photoView, WallShadow } from './PhotoRoom'
import { fadeRoom, Room, ROOM } from './Room'
import { useStory } from './scroll'
import { mix, PACK_STEPS, packReveal, partReveal, phraseReveal, progress, smooth, STORY, unboxPhases, type PackStep } from './story'

/** No topo, o quadro levemente de lado: mostra a lateral da moldura, de onde sai a linha "Moldura" */
const HERO_YAW = (-25 * Math.PI) / 180

/** No começo da rolagem o quadro vira até este ângulo (quase de frente) e chega `HERO_NEAR` m mais perto */
const HERO_TURNED_YAW = (-9 * Math.PI) / 180
const HERO_NEAR = 0.05

/** Folga do enquadramento no topo: o quadro ocupa pouco mais da metade, as escolhas ficam em volta */
const HERO_MARGIN = 1.9

/**
 * Celular (abaixo do `md`). No topo, o quadro fica no espaço livre entre o título e a bandeja
 * das opções, à esquerda das etiquetas (medido no DOM a cada frame; `gap` px de folga).
 * Na sala 3D, a câmera enquadra o sofá (`roomWidth`, m) e a cena desce (`roomDrop`).
 */
export const NARROW = { maxWidth: 768, margin: 1.06, gap: 14, roomWidth: 2.5, roomDrop: 0.1, explodedMargin: 1.1, packMargin: 1.12 }

/**
 * Plano de corte da câmera proporcional à distância. Na sala, no celular, a câmera fica a ~9 m:
 * com o corte fixo em 1 cm a profundidade não separa o papel (0,3 mm) do MDF e a arte "briga"
 * com o fundo (faixas piscando). A 10% da distância, a precisão sobra.
 */
const NEAR_FRACTION = 0.1

/** Folga da vista "por dentro" (a camada da frente chega perto da câmera) */
const EXPLODED_MARGIN = 1.7

/** No computador, a vista por dentro fica à direita do título (fração da largura) */
const EXPLODED_SHIFT = 0.13

/** Quanto o quadro sai da parede (m): ao girar, antes de ser pendurado, e ao ir para a vista por dentro */
const QUADRO_Z = { turning: 0.18, off: 0.4 }

/**
 * Reflexo do vidro com o quadro na parede do ambiente (fração do normal): o do estúdio é uma faixa
 * clara e dura, a sala real reflete pouco e espalhado. Só o vidro: a arte e a moldura não escurecem.
 */
const ROOM_GLASS = 0.1

/** Luz da janela (a principal) na parede do ambiente: a arte fica clara como a parede da foto */
const ROOM_KEY = 1.9

/**
 * Na parede, a luz de estúdio (rebatedores que aparecem refletidos no papel e na tela como uma
 * faixa clara) cai para `environment` e uma luz difusa uniforme (`fill`) entra no lugar
 */
const ROOM_LIGHT = { environment: 0.3, fill: 1 }

/** Quanto a sala está abaixo (entrando) ou acima (saindo) da posição dela (m) */
const ROOM_TRAVEL = 3.5

/**
 * Vitrine da compra, no fim da história: o quadro quase de frente (`yaw`), à frente da caixa
 * que desce (`lift`, m). No computador ocupa a metade da esquerda; no celular, a parte de cima
 * (`top`, fração da altura onde fica o centro). Arrastar gira até `drag` rad para cada lado.
 */
const SHOWCASE = { yaw: (-14 * Math.PI) / 180, lift: 0.25, margin: 1.45, narrowMargin: 1.12, top: 0.27, narrowHeight: 0.46, drag: 1.1 }

const CAMERA_DIRECTION = new Vector3(...CAMERA.position).normalize()
const KEY_POSITION = new Vector3(...KEY_LIGHT.position)
const AMBIENT_LIGHT = new Vector3(...AMBIENT.light)

type Layout = 'wide' | 'narrow'

/**
 * Pontos de onde saem as linhas das escolhas, no espaço do quadro: a lateral da moldura,
 * a face da moldura (a cor), a superfície da frente (o vidro) e a borda de baixo (o tamanho).
 * No computador as caixas ficam dos dois lados; no celular as etiquetas ficam à direita.
 */
function choiceAnchors(model: ModelDef): Record<Layout, Record<ChoiceKey, Vec3>> {
  const zs = model.parts.flatMap((part) => part.boxes.flatMap((box) => [box.position[2] - box.size[2] / 2, box.position[2] + box.size[2] / 2]))
  const front = Math.max(...zs)
  const back = Math.min(...zs)
  const { outer, art } = model
  const band = Math.max(0.004, (outer.width - art.width) / 2)
  return {
    wide: {
      moldura: [outer.width / 2, outer.height * 0.22, (front + back) / 2],
      cor: [-outer.width / 2 + band / 2, outer.height / 2 - band / 2, front],
      vidro: [-art.width * 0.22, -art.height * 0.28, front],
      tamanho: [outer.width * 0.3, -outer.height / 2, front],
    },
    narrow: {
      moldura: [outer.width / 2, outer.height * 0.3, (front + back) / 2],
      cor: [outer.width / 2 - band / 2, -outer.height * 0.02, front],
      vidro: [art.width * 0.2, -art.height * 0.3, front],
      tamanho: [outer.width / 2, -outer.height * 0.46, (front + back) / 2],
    },
  }
}

interface StoryProps {
  model: ModelDef
  /** HTML por cima da cena: a animação acha os elementos pelos atributos data-* */
  overlayRef: RefObject<HTMLDivElement | null>
  /** Luz principal do Studio: no ambiente em foto, vem do lado da luz da foto */
  keyLightRef: RefObject<DirectionalLight | null>
}

/**
 * A história em 3D, conduzida pela rolagem: o quadro no topo com as escolhas, a volta, a parede,
 * a vista por dentro, a embalagem e, no fim, a vitrine da compra.
 */
export function Story({ model: chosen, overlayRef, keyLightRef }: StoryProps) {
  // Uma escolha nova pode pedir textura que ainda não chegou: enquanto ela baixa, fica o quadro anterior
  const model = useDeferredValue(chosen)
  const storyRef = useStory()
  const quadro = useRef<Group>(null)
  const room = useRef<Group>(null)
  const roomMaterials = useRef<Material[]>([])
  const wallShadowMaterials = useRef<Material[]>([])
  // Embalagem: a caixa e o tampo ficam num grupo com o giro do quadro, mas sem o avanço dele
  const crate = useRef<Group>(null)
  const packAnchors = useRef<Partial<Record<PackStep, Object3D>>>({})
  const pack = useMemo(() => packMetrics(model), [model])
  const explode = useRef(0)
  const anchors = useRef<Record<Layout, Partial<Record<ChoiceKey, Object3D>>>>({ wide: {}, narrow: {} })
  const anchorPoints = useMemo(() => choiceAnchors(model), [model])
  const dragRef = useDragYaw()
  // No celular as camadas se separam menos: a vista por dentro cabe maior na largura da tela
  const explodeScale = useThree((state) => (state.size.width < NARROW.maxWidth ? EXPLODE_SCALE.narrow : EXPLODE_SCALE.wide))
  // Ponto de cada parte (o marcador do modelo, que acompanha a parte ao abrir): onde chega a linha da explicação
  const partAnchors = useRef<Record<string, Object3D | undefined>>({})
  // Luz difusa do ambiente e a intensidade original da luz de estúdio (lida no primeiro frame)
  const fill = useRef<AmbientLight>(null)
  const environmentBase = useRef<number | null>(null)

  // Vetores de trabalho, reaproveitados a cada frame
  const work = useMemo(
    () => ({
      hero: new Vector3(),
      room: new Vector3(),
      roomLook: new Vector3(),
      exploded: new Vector3(),
      show: new Vector3(),
      showLook: new Vector3(),
      target: new Vector3(),
      look: new Vector3(),
      point: new Vector3(),
    }),
    [],
  )

  useFrame((state) => {
    const offset = storyRef.current.offset
    const heroOut = progress(offset, STORY.heroOut)
    const heroTurn = smooth(progress(offset, STORY.heroTurn))
    const spin = smooth(progress(offset, STORY.spin))
    const heroYaw = mix(HERO_YAW, HERO_TURNED_YAW, heroTurn)
    const roomIn = smooth(progress(offset, STORY.roomIn))
    const roomOut = smooth(progress(offset, STORY.roomOut))
    const exploded = smooth(progress(offset, STORY.explode))
    const assembled = smooth(progress(offset, STORY.assemble))
    const boxIn = smooth(progress(offset, STORY.box))
    const inserted = smooth(progress(offset, STORY.insert))
    const unbox = unboxPhases(offset)
    const showcase = smooth(progress(offset, STORY.showcase))
    const { size } = state
    // A câmera do estado do frame (a do useThree não pode ser alterada: regra do React Compiler)
    const camera = state.camera as PerspectiveCamera

    // O quadro: de lado no topo, uma volta até ficar de frente, pendurado, depois sai e abre;
    // na embalagem entra na caixa e, no fim, sai dela para a vitrine (onde arrastar gira)
    let z = mix(HERO_NEAR * heroTurn, QUADRO_Z.turning, spin)
    z = mix(z, 0, roomIn)
    z = mix(z, QUADRO_Z.off, roomOut)
    const quadroZ = z + PACK.lift * boxIn * (1 - inserted) + SHOWCASE.lift * unbox.quadroOut
    if (quadro.current) {
      quadro.current.rotation.y = mix(heroYaw, Math.PI * 2, spin) + EXPLODE_YAW * exploded + (SHOWCASE.yaw - EXPLODE_YAW + dragRef.current.yaw) * showcase
      quadro.current.position.z = quadroZ
    }
    if (crate.current && quadro.current) {
      crate.current.rotation.y = mix(heroYaw, Math.PI * 2, spin) + EXPLODE_YAW * exploded
      crate.current.position.z = z
    }
    // As camadas se separam e, na embalagem, voltam ao lugar
    explode.current = exploded * (1 - assembled)
    dragRef.current.enabled = showcase > 0.98

    // A sala sobe do chão e, depois, continua subindo até sumir. Quadros altos ficam mais acima
    // do piso (base acima do encosto do sofá): em vez de subir o quadro, a sala desce
    const roomOpacity = roomIn * (1 - roomOut)
    const hang = hangHeight(model.outer.height)
    const drop = hang + ROOM.floorY
    if (room.current) {
      room.current.position.y = -drop + mix(-ROOM_TRAVEL, 0, roomIn) + mix(0, ROOM_TRAVEL, roomOut)
      room.current.visible = roomOpacity > 0.002
    }
    fadeRoom(roomMaterials.current, roomOpacity)

    // Câmera: de frente-direita no topo, de frente para a parede na sala, de novo de lado aberto
    const fov = CAMERA.fov
    const narrow = size.width < NARROW.maxWidth
    // No celular, o quadro do topo ocupa a faixa livre entre o título, as etiquetas e a bandeja
    const band = narrow && roomIn < 1 ? heroBand(overlayRef.current) : null
    const heroFree = band ? { width: band.right - band.left, height: band.bottom - band.top } : size
    const heroDistance = fitDistance([model.outer.width, model.outer.height], fov, size, heroFree, narrow ? NARROW.margin : HERO_MARGIN)
    work.hero.copy(CAMERA_DIRECTION).multiplyScalar(heroDistance)
    // Sala: a foto do ambiente (de frente, sem inclinar a câmera) ou a sala 3D
    const photo = narrow ? AMBIENT.narrow : AMBIENT.wide
    if (photo) {
      // No celular a frase fica em cima, sobre a parede: o quadro fica abaixo dela
      const reserve = narrow ? phraseReserve(overlayRef.current, size.height) : 0
      const view = photoView(photo, size, hang + model.outer.height / 2, reserve)
      work.room.set(view.x, view.y - drop, ROOM.wallZ + fitDistance([view.width, view.height], fov, size, size, 1))
      work.roomLook.set(view.x, view.y - drop, 0)
    } else {
      const roomDistance = fitDistance([narrow ? NARROW.roomWidth : ROOM.view.width, ROOM.view.height], fov, size, size, 1)
      work.room.set(0, ROOM.view.centerY + ROOM.eyeLift - drop, roomDistance)
      work.roomLook.set(0, ROOM.view.centerY - drop, 0)
    }
    if (photo && keyLightRef.current) {
      keyLightRef.current.position.lerpVectors(KEY_POSITION, AMBIENT_LIGHT, roomOpacity)
      keyLightRef.current.intensity = KEY_LIGHT.intensity * mix(1, ROOM_KEY, roomOpacity)
    }
    // Na parede, a luz de estúdio dá lugar à difusa (sem faixa refletida no papel)
    environmentBase.current ??= state.scene.environmentIntensity
    state.scene.environmentIntensity = environmentBase.current * mix(1, ROOM_LIGHT.environment, roomOpacity)
    if (fill.current) fill.current.intensity = ROOM_LIGHT.fill * roomOpacity
    // e o reflexo do vidro quase some (o vidro é o material com mistura aditiva)
    quadro.current?.traverse((object) => {
      const material = (object as Mesh).material as MeshStandardMaterial | undefined
      if (!material || Array.isArray(material) || material.blending !== AdditiveBlending) return
      material.userData.envBase ??= material.envMapIntensity
      material.envMapIntensity = (material.userData.envBase as number) * mix(1, ROOM_GLASS, roomOpacity)
    })
    // A sombra pintada na parede: inteira com o quadro encostado, some quando ele se afasta
    const onWall = 1 - smooth(Math.min(1, quadroZ / 0.12))
    fadeRoom(wallShadowMaterials.current, roomOpacity * onWall)
    // No celular, a vista por dentro fica abaixo do título "Por dentro do quadro"
    const explodedBand = narrow && roomOut > 0 ? belowElement(overlayRef.current, '[data-explode-hint]', size.height) : null
    const explodedFree = explodedBand ? { width: size.width, height: explodedBand.bottom - explodedBand.top } : size
    const explodedMargin = explodedBand ? NARROW.explodedMargin : EXPLODED_MARGIN
    const explodedDistance = fitDistance(frameExtent(model, 1, explodeScale, EXPLODE_YAW), fov, size, explodedFree, explodedMargin)
    // Na embalagem, a câmera enquadra a caixa (vista no mesmo ângulo)
    const yaw = Math.abs(EXPLODE_YAW)
    const crateExtent: [number, number] = [pack.outer.width * Math.cos(yaw) + pack.outer.depth * Math.sin(yaw), pack.outer.height]
    const packDistance = fitDistance(crateExtent, fov, size, explodedFree, explodedBand ? NARROW.packMargin : explodedMargin * 0.9)
    work.exploded.set(0, 0, QUADRO_Z.off).addScaledVector(CAMERA_DIRECTION, mix(explodedDistance, packDistance, assembled))
    // Vitrine: o quadro na metade da esquerda (computador) ou na parte de cima (celular)
    const showFree = narrow ? { width: size.width, height: size.height * SHOWCASE.narrowHeight } : { width: size.width / 2, height: size.height }
    const showDistance = fitDistance([model.outer.width, model.outer.height], fov, size, showFree, narrow ? SHOWCASE.narrowMargin : SHOWCASE.margin)
    work.showLook.set(0, 0, quadroZ)
    work.show.copy(work.showLook).addScaledVector(CAMERA_DIRECTION, showDistance)

    camera.position.copy(work.hero).lerp(work.room, roomIn).lerp(work.exploded, roomOut).lerp(work.show, showcase)
    work.target.set(0, 0, 0).lerp(work.roomLook, roomIn).lerp(work.look.set(0, 0, QUADRO_Z.off), roomOut).lerp(work.showLook, showcase)
    camera.lookAt(work.target)
    const distance = camera.position.distanceTo(work.target)
    camera.near = Math.max(CAMERA.near, distance * NEAR_FRACTION)
    camera.far = distance + CAMERA.far
    camera.updateMatrixWorld()
    // Celular, no topo: a imagem vai para o centro da faixa livre (some com o giro)
    const heroWeight = 1 - Math.max(spin, roomIn)
    const bandX = band ? (size.width / 2 - (band.left + band.right) / 2) * heroWeight : 0
    const bandY = band ? (size.height / 2 - (band.top + band.bottom) / 2) * heroWeight : 0
    const explodedY = explodedBand ? (size.height / 2 - (explodedBand.top + explodedBand.bottom) / 2) * roomOut : 0
    // Na sala 3D do celular, a cena desce para a frase caber em cima; a foto já vem composta
    const roomDrop = photo ? 0 : NARROW.roomDrop
    const showY = size.height * (0.5 - SHOWCASE.top)
    const shift = narrow ? bandY - size.height * roomDrop * roomIn * (1 - roomOut) + mix(explodedY, showY, showcase) : 0
    // No computador: aberto, à direita do título; na vitrine, no meio da metade da esquerda
    const side = narrow ? bandX : mix(-size.width * EXPLODED_SHIFT * exploded, size.width / 4, showcase)
    // setViewOffset também refaz a projeção (vale o near/far novos)
    camera.setViewOffset(size.width, size.height, side, shift, size.width, size.height)

    if (overlayRef.current) {
      updateOverlay(overlayRef.current, anchors.current[narrow ? 'narrow' : 'wide'], packAnchors.current, partAnchors.current, camera, size, work.point, {
        heroOut,
        offset,
        exploded,
        assembled,
        packOut: unbox.lidOff,
        showcase,
      })
    }
  })

  return (
    <>
      <group ref={quadro}>
        <Frame
          model={model}
          explode={explode}
          explodeScale={explodeScale}
          renderMarker={(part) => (
            <group
              position={part.marker}
              ref={(anchor) => {
                partAnchors.current[part.id] = anchor ?? undefined
              }}
            />
          )}
        />
        {(['wide', 'narrow'] as const).flatMap((layout) =>
          CHOICES.map((key) => (
            <group
              key={`${layout}-${key}`}
              position={anchorPoints[layout][key]}
              ref={(anchor) => {
                anchors.current[layout][key] = anchor ?? undefined
              }}
            />
          )),
        )}
        <Guards model={model} anchorsRef={packAnchors} />
      </group>
      <group ref={crate}>
        <Crate model={model} anchorsRef={packAnchors} />
      </group>
      <ambientLight ref={fill} intensity={0} color="#fff6ec" />
      <AmbientRoom group={room} materialsRef={roomMaterials} />
      <PhotoShadow width={model.outer.width} height={model.outer.height} materialsRef={wallShadowMaterials} />
    </>
  )
}

/**
 * Giro do quadro na vitrine: arrastar na horizontal (no celular o arrasto vertical continua
 * rolando a página: o canvas tem touch-action pan-y). Só vale com a vitrine montada.
 */
function useDragYaw() {
  const element = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  const drag = useRef({ yaw: 0, enabled: false })
  useEffect(() => {
    let from: number | null = null
    const down = (event: PointerEvent) => {
      if (drag.current.enabled) from = event.clientX
    }
    const move = (event: PointerEvent) => {
      if (from === null) return
      drag.current.yaw = Math.max(-SHOWCASE.drag, Math.min(SHOWCASE.drag, drag.current.yaw + (event.clientX - from) * 0.008))
      from = event.clientX
      invalidate()
    }
    const up = () => {
      from = null
    }
    element.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      element.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [element, invalidate])
  return drag
}

/** O ambiente: a foto da tela atual (computador ou celular) ou, sem foto, a sala 3D */
function AmbientRoom({ group, materialsRef }: { group: RefObject<Group | null>; materialsRef: RefObject<Material[]> }) {
  const narrow = useThree((state) => state.size.width < NARROW.maxWidth)
  const photo = narrow ? AMBIENT.narrow : AMBIENT.wide
  return photo ? <PhotoRoom photo={photo} group={group} materialsRef={materialsRef} /> : <Room group={group} materialsRef={materialsRef} />
}

/** Sombra do quadro na parede, só quando o ambiente é uma foto */
function PhotoShadow(props: { width: number; height: number; materialsRef: RefObject<Material[]> }) {
  const narrow = useThree((state) => state.size.width < NARROW.maxWidth)
  return (narrow ? AMBIENT.narrow : AMBIENT.wide) ? <WallShadow {...props} /> : null
}

/** Fração da altura do palco, em cima, ocupada pelas frases do ambiente (a mais alta delas) */
function phraseReserve(root: HTMLElement | null, height: number): number {
  if (!root) return 0
  const top = root.getBoundingClientRect().top
  const bottoms = Array.from(root.querySelectorAll('[data-phrase]')).map((element) => element.getBoundingClientRect().bottom - top)
  return bottoms.length ? Math.min(0.6, (Math.max(...bottoms) + NARROW.gap) / height) : 0
}

/** Faixa livre (px) para o quadro no topo do celular: abaixo do título, acima da bandeja, à esquerda das etiquetas */
function heroBand(root: HTMLElement | null): { left: number; right: number; top: number; bottom: number } | null {
  if (!root) return null
  const box = root.getBoundingClientRect()
  const title = root.querySelector('[data-hero-title]')?.getBoundingClientRect()
  const tray = bottomStackTop(root)
  const tags = Array.from(root.querySelectorAll<HTMLElement>('[data-follow]'))
    .map((tag) => tag.getBoundingClientRect())
    .filter((rect) => rect.width > 0)
  if (!title || tray === null || tags.length === 0) return null
  return {
    left: NARROW.gap,
    // Espaço para o cotovelo das linhas entre o quadro e as etiquetas
    right: Math.min(...tags.map((rect) => rect.left)) - box.left - NARROW.gap * 2.5,
    top: title.bottom - box.top + NARROW.gap,
    bottom: tray - box.top - NARROW.gap,
  }
}

/** Topo (px, na tela) do que fica no pé do topo do celular: a bandeja e, acima dela, o aviso de rolagem */
function bottomStackTop(root: HTMLElement): number | null {
  const tray = root.querySelector('[data-tray]')?.getBoundingClientRect()
  if (!tray || tray.height === 0) return null
  const cue = root.querySelector('[data-scroll-cue]')?.getBoundingClientRect()
  return cue && cue.height > 0 ? Math.min(tray.top, cue.top) : tray.top
}

/**
 * Faixa vertical livre (px) entre a base de um elemento do HTML por cima da cena e o pé da tela,
 * deixando embaixo o lugar do cartão da parte (abrir o cartão não cobre o quadro nem o move)
 */
function belowElement(root: HTMLElement | null, selector: string, height: number): { top: number; bottom: number } | null {
  const element = root?.querySelector(selector)
  if (!root || !element) return null
  const top = element.getBoundingClientRect().bottom - root.getBoundingClientRect().top + NARROW.gap
  return { top, bottom: height - cardReserve(root) }
}

/**
 * Altura (px) reservada embaixo para os cartões do celular (explicação das partes e etapas da
 * embalagem): o mais alto deles, fixo durante a cena (trocar de cartão não mexe no enquadramento)
 */
function cardReserve(root: HTMLElement): number {
  const heights = Array.from(root.querySelectorAll<HTMLElement>('[data-single]'))
    .filter((card) => card.offsetWidth > 0)
    .map((card) => card.offsetHeight)
  // O cartão fica a 16 px do pé; a seta de rolagem vai dentro dele
  return heights.length ? Math.max(...heights) + 16 + NARROW.gap : 160
}

interface OverlayProgress {
  heroOut: number
  offset: number
  exploded: number
  assembled: number
  /** A caixa abrindo: o título e as etapas da embalagem saem */
  packOut: number
  showcase: number
}

/** Posiciona as linhas das escolhas e as frases conforme a câmera e o scroll (direto no DOM, a cada frame) */
function updateOverlay(
  root: HTMLElement,
  anchors: Partial<Record<ChoiceKey, Object3D>>,
  packAnchors: Partial<Record<PackStep, Object3D>>,
  partAnchors: Record<string, Object3D | undefined>,
  camera: Parameters<Vector3['project']>[0],
  size: { width: number; height: number },
  point: Vector3,
  { heroOut, offset, exploded, assembled, packOut, showcase }: OverlayProgress,
) {
  const find = <T extends Element>(selector: string) => root.querySelector<T & Element>(selector)
  const hero = find<HTMLElement>('[data-hero]')
  if (hero) {
    hero.style.opacity = String(1 - heroOut)
    hero.style.visibility = heroOut >= 1 ? 'hidden' : 'visible'
  }
  const box = root.getBoundingClientRect()
  updateScrollCue(root, box, offset)

  if (hero && heroOut < 1) {
    const placed: { key: ChoiceKey; ax: number; ay: number; panel: HTMLElement }[] = []
    for (const key of CHOICES) {
      const anchor = anchors[key]
      // Computador: caixas; celular: etiquetas. Vale a que está à mostra.
      const panel = Array.from(root.querySelectorAll<HTMLElement>(`[data-panel="${key}"]`)).find((element) => element.offsetWidth > 0)
      if (!anchor || !panel) continue
      anchor.getWorldPosition(point).project(camera)
      placed.push({ key, ax: ((point.x + 1) / 2) * size.width, ay: ((1 - point.y) / 2) * size.height, panel })
    }

    // Etiquetas do celular: cada uma na altura do seu ponto, sem encostar nas outras
    const follow = placed.filter((item) => item.panel.dataset.follow !== undefined).sort((a, b) => a.ay - b.ay)
    if (follow.length > 0) {
      const title = find<HTMLElement>('[data-hero-title]')?.getBoundingClientRect()
      const stack = bottomStackTop(root)
      const min = title ? title.bottom - box.top + 8 : 0
      const max = stack !== null ? stack - box.top - 8 : size.height
      let next = min
      follow.forEach((item, index) => {
        const height = item.panel.offsetHeight
        const room = (follow.length - 1 - index) * (height + 8)
        const top = Math.max(next, Math.min(item.ay - height / 2, max - height - room))
        item.panel.style.top = `${top}px`
        next = top + height + 8
      })
    }

    for (const { key, ax, ay, panel } of placed) {
      const line = find<SVGPolylineElement>(`[data-line="${key}"]`)
      const dot = find<SVGCircleElement>(`[data-dot="${key}"]`)
      if (line && dot) drawLeader(line, dot, ax, ay, panel.getBoundingClientRect(), box)
    }
  }

  root.querySelectorAll<HTMLElement>('[data-phrase]').forEach((element) => {
    const reveal = phraseReveal(offset, Number(element.dataset.phrase))
    element.style.opacity = String(reveal)
    element.style.transform = `translateY(${(1 - reveal) * 24}px)`
  })
  const explodeHint = find<HTMLElement>('[data-explode-hint]')
  if (explodeHint) {
    const reveal = smooth(progress(offset, STORY.explodeHint))
    const shown = reveal * Math.min(1, exploded * 1.2) * (1 - assembled)
    explodeHint.style.opacity = String(shown)
    // O botão "Avançar" do computador fica neste bloco: clicável só com ele à mostra
    explodeHint.style.pointerEvents = shown > 0.6 ? 'auto' : 'none'
  }

  // Por dentro: a explicação de cada parte, com linha até ela, uma depois da outra
  const partLeaders = find<SVGSVGElement>('[data-part-leaders]')
  if (partLeaders) {
    const open = (1 - assembled) * Math.min(1, exploded * 1.2)
    partLeaders.style.opacity = open > 0 ? '1' : '0'
    const ids = Array.from(root.querySelectorAll<HTMLElement>('[data-part-leader]')).map((element) => element.dataset.partLeader ?? '')
    ids.forEach((id, index) => {
      const reveal = partReveal(offset, index, ids.length) * open
      const current = reveal * (index + 1 < ids.length ? 1 - partReveal(offset, index + 1, ids.length) : 1)
      let shown: HTMLElement | undefined
      for (const label of root.querySelectorAll<HTMLElement>(`[data-part-label="${id}"]`)) {
        // Computador: as explicações ficam (as anteriores, esmaecidas); celular: só a atual
        const single = label.dataset.single !== undefined
        label.style.opacity = String(single ? current : reveal * mix(0.5, 1, current))
        // Cartões do celular empilhados: só o da vez recebe o toque no "Avançar"
        if (single) label.style.pointerEvents = current > 0.6 ? 'auto' : 'none'
        if (label.offsetWidth > 0) shown = label
      }
      const leader = find<SVGGElement>(`[data-part-leader="${id}"]`)
      const line = find<SVGPolylineElement>(`[data-part-line="${id}"]`)
      const dot = find<SVGCircleElement>(`[data-part-dot="${id}"]`)
      const anchor = partAnchors[id]
      if (!leader || !line || !dot || !anchor || !shown) return
      const single = shown.dataset.single !== undefined
      leader.style.opacity = String(single ? current : reveal * mix(0.35, 1, current))
      if (reveal <= 0) return
      anchor.getWorldPosition(point).project(camera)
      drawLeader(line, dot, ((point.x + 1) / 2) * size.width, ((1 - point.y) / 2) * size.height, shown.getBoundingClientRect(), box)
    })
  }
  const showcaseHint = find<HTMLElement>('[data-showcase-hint]')
  if (showcaseHint) showcaseHint.style.opacity = String(showcase)

  // Embalagem: o título e as etiquetas de cada etapa, ligadas por linha à peça que entra
  const packShown = assembled * (1 - packOut)
  const packTitle = find<HTMLElement>('[data-pack-title]')
  if (packTitle) {
    packTitle.style.opacity = String(packShown)
    packTitle.style.pointerEvents = packShown > 0.6 ? 'auto' : 'none'
  }
  const leaders = find<SVGSVGElement>('[data-pack-leaders]')
  if (!leaders) return
  leaders.style.opacity = packShown > 0 ? '1' : '0'
  // As etapas que existem neste quadro (sem vidro, não há cantoneiras laterais)
  const steps = PACK_STEPS.filter((step) => root.querySelector(`[data-pack-label="${step.key}"]`))
  steps.forEach(({ key }, index) => {
    const labels = Array.from(root.querySelectorAll<HTMLElement>(`[data-pack-label="${key}"]`))
    const reveal = packReveal(offset, key) * (1 - packOut)
    // No celular cabe uma etiqueta por vez: a etapa seguinte substitui a anterior
    const next = steps[index + 1]
    const current = reveal * (next ? 1 - packReveal(offset, next.key) : 1)
    let shown: HTMLElement | undefined
    for (const label of labels) {
      // Computador: as etapas ficam (as já feitas, esmaecidas); celular: só a atual
      const single = label.dataset.single !== undefined
      label.style.opacity = String(single ? current : reveal * mix(0.45, 1, current))
      if (single) label.style.pointerEvents = current > 0.6 ? 'auto' : 'none'
      if (label.offsetWidth > 0) shown = label
    }
    const leader = find<SVGGElement>(`[data-pack-leader="${key}"]`)
    const line = find<SVGPolylineElement>(`[data-pack-line="${key}"]`)
    const dot = find<SVGCircleElement>(`[data-pack-dot="${key}"]`)
    const anchor = packAnchors[key]
    if (!leader || !line || !dot || !anchor || !shown) return
    // Só a linha da etapa atual: as peças das anteriores acabam escondidas dentro da caixa
    leader.style.opacity = String(current)
    if (current <= 0) return
    anchor.getWorldPosition(point).project(camera)
    drawLeader(line, dot, ((point.x + 1) / 2) * size.width, ((1 - point.y) / 2) * size.height, shown.getBoundingClientRect(), box)
  })
}

/** Texto do aviso de rolagem em cada etapa: chamar para a parede, seguir e, no fim, para a compra */
function scrollCueText(offset: number): string {
  if (offset < STORY.roomIn[0]) return 'Role para ver na parede'
  if (offset >= STORY.lid[0] + STORY.lid[1]) return 'Role para comprar'
  return 'Continue rolando'
}

/** O aviso de rolagem fica no pé do palco, logo acima do cartão que estiver à mostra embaixo */
function updateScrollCue(root: HTMLElement, box: DOMRect, offset: number) {
  const cue = root.querySelector<HTMLElement>('[data-scroll-cue]')
  const text = root.querySelector<HTMLElement>('[data-scroll-cue-text]')
  if (!cue || !text) return
  const label = scrollCueText(offset)
  if (text.textContent !== label) text.textContent = label
  let top = box.bottom
  let inCard = false
  for (const card of root.querySelectorAll<HTMLElement>('[data-tray], [data-single]')) {
    if (card.offsetWidth === 0) continue
    // A bandeja some com o topo (o pai dela muda de opacidade); os cartões, cada um com a sua
    const single = card.dataset.single !== undefined
    const opacity = Number(getComputedStyle(single ? card : (card.parentElement ?? card)).opacity)
    if (opacity <= 0.05) continue
    // Com um cartão embaixo (celular), a seta vai dentro dele: sobra espaço para o quadro
    if (single) inCard = true
    else top = Math.min(top, card.getBoundingClientRect().top)
  }
  cue.style.bottom = top < box.bottom ? `${box.bottom - top + 10}px` : ''
  cue.style.opacity = inCard ? '0' : ''
}

/**
 * Linha de um ponto da peça (ax, ay) até a etiqueta: encosta na borda da etiqueta que fica de
 * frente para o ponto, com um cotovelo no meio do caminho
 */
function drawLeader(line: SVGPolylineElement, dot: SVGCircleElement, ax: number, ay: number, rect: DOMRect, box: DOMRect) {
  const left = rect.left - box.left
  const right = rect.right - box.left
  const top = rect.top - box.top
  const middle = top + rect.height / 2
  const reach = (edge: number) => Math.min(46, Math.max(10, Math.abs(edge - ax) * 0.5))
  let points: number[]
  if (left > ax) points = [left - reach(left), middle, left - 8, middle]
  else if (right < ax) points = [right + reach(right), middle, right + 8, middle]
  else points = [(left + right) / 2, top - 40, (left + right) / 2, top - 10]
  line.setAttribute('points', `${ax},${ay} ${points[0]},${points[1]} ${points[2]},${points[3]}`)
  dot.setAttribute('cx', String(ax))
  dot.setAttribute('cy', String(ay))
}
