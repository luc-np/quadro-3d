import { useDeferredValue, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { AdditiveBlending, Vector3, type AmbientLight, type DirectionalLight, type Group, type Material, type Mesh, type MeshStandardMaterial, type Object3D, type PerspectiveCamera } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import { easing } from 'maath'
import { Frame } from '@/components/scene/Frame'
import { EXPLODE_SCALE, EXPLODE_YAW, fitDistance, frameExtent } from '@/components/scene/layout'
import type { ModelDef, PartDef } from '@/components/scene/models/types'
import { CAMERA, KEY_LIGHT } from '@/components/scene/Studio'
import { Crate, Guards, PACK } from '@/components/especial/Packaging'
import { AMBIENT, hangHeight, PhotoRoom, photoView, WallShadow } from '@/components/especial/PhotoRoom'
import { fadeRoom, ROOM } from '@/components/especial/Room'
import { StoryValue, type StoryScrollState } from '@/components/especial/scroll'
import { progress, smooth as especialSmooth, STORY, type PackStep } from '@/components/especial/story'
import { FRAME_ORDER } from '@/components/scene/timeline'
import type { Mode } from './modes'
import { furnitureOf, type RoomDef } from './rooms'
import { BASE, momentOf, POSE_KEYS, poseOf, QUESTIONS, smooth, span, weightsOf } from './story'

/** Área do palco coberta pelo HTML (px): o quadro fica no meio do que sobra */
export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

/** Tempo (s) da troca de vista: a cena desliza até a aba escolhida */
const MODE_TIME = 0.45

/** Inclinação na vista de frente: o mouse leva o quadro até estes ângulos; no toque, arrastar gira até `drag` */
const TILT = { yaw: (16 * Math.PI) / 180, pitch: (9 * Math.PI) / 180, time: 0.3, drag: 0.75 }

/** Folga do quadro na área livre, por vista (1 = encostado nas bordas); no celular, bem menor (a tela é pequena) */
const MARGIN = { front: 1.32, exploded: 1.3, side: 1.3 }
const NARROW_MARGIN = { front: 1.12, exploded: 1.08, side: 1.08 }

/** No celular, as peças de um conjunto se afastam menos (a tela estreita deixaria cada uma pequena) */
const NARROW_SPREAD = 0.45

/** Vistas em ângulo (a embalagem, o par das comparações): mais folga no celular, a caixa é maior que o quadro */
const NARROW_ANGLED_MARGIN = 0.32

/** Profundidade: o quadro vira até mostrar a lateral (a espessura da moldura) */
const SIDE_YAW = (-66 * Math.PI) / 180

/** Quanto o quadro sai da parede (m) para abrir em camadas ou virar de lado */
const QUADRO_OFF = 0.4

/** Escala: o enquadramento da sala abre (fração do zoom da vista "Na parede"); no celular, abre menos */
const FAR_ZOOM = 0.62
const NARROW_FAR_ZOOM = 0.8

/** No celular, a foto do ambiente chega mais perto do quadro (o limite da foto continua valendo) */
const NARROW_WALL_ZOOM = 1.22

/** Cotas: distância (m) da linha até o quadro e até o móvel */
const DIM_GAP = 0.05
const FURNITURE_GAP = { top: 0.07, side: 0.1 }

/** Na parede: a luz da janela da foto, pouco reflexo no vidro e a luz de estúdio trocada por uma difusa (como na página especial) */
const ROOM_KEY = 1.9
const ROOM_GLASS = 0.1
const ROOM_LIGHT = { environment: 0.3, fill: 1 }

/** Plano de corte da câmera proporcional à distância (a sala fica longe) */
const NEAR_FRACTION = 0.1

/** Abaixo disto (px), o ambiente é a foto do celular e as camadas se separam menos */
const NARROW_WIDTH = 768

/** De frente (um pouco acima) e, na vista por dentro, de frente-direita como na página especial */
const FRONT_DIRECTION = new Vector3(0, 0.05, 1).normalize()
const ANGLED_DIRECTION = new Vector3(...CAMERA.position).normalize()
const KEY_POSITION = new Vector3(...KEY_LIGHT.position)
const AMBIENT_LIGHT = new Vector3(...AMBIENT.light)

/** Medidas do quadro montado (cm): contorno na parede e profundidade (da frente às costas) */
export function measures(model: ModelDef) {
  const zs = model.parts.flatMap((part) => part.boxes.flatMap((box) => [box.position[2] - box.size[2] / 2, box.position[2] + box.size[2] / 2]))
  const depth = zs.length ? Math.max(...zs) - Math.min(...zs) : 0
  return { width: model.outer.width * 100, height: model.outer.height * 100, depth: depth * 100, front: zs.length ? Math.max(...zs) : 0, back: zs.length ? Math.min(...zs) : 0 }
}

/** Progresso das perguntas (0 = a vitrine; k = a pergunta k no meio da tela): `target` vem da rolagem, `offset` anda até ele */
export interface StoryState {
  target: number
  offset: number
}

/** Os modelos das perguntas de comparação (na medida escolhida, com a arte da 1ª peça) */
export interface AltModels {
  canvas: ModelDef
  paper: ModelDef
  plain: ModelDef
  glazed: ModelDef
}

/** Área coberta pelo HTML na vitrine (cartão, vistas, etiquetas) e durante as perguntas (o texto delas) */
export interface StageInsets {
  vitrine: Insets
  story: Insets
}

interface ImersivoSceneProps {
  /** Uma por peça: duo e trio têm duas ou três, na mesma medida e moldura */
  models: ModelDef[]
  alt: AltModels
  mode: Mode
  keyLightRef: RefObject<DirectionalLight | null>
  insetsRef: RefObject<StageInsets>
  /** Camada das cotas ([data-dim] com [data-dim-line] e [data-dim-label]), por cima do canvas */
  annotationsRef: RefObject<HTMLDivElement | null>
  /** Partes presas na moldura: andam com ela e não ganham "+" */
  attached: string[]
  /** O ambiente das vistas "Na parede" e "Escala" (e das perguntas na parede) */
  room: RoomDef
  storyRef: RefObject<StoryState>
}

/** Distância entre as peças de um conjunto (m): os 4 cm da conta da largura montada */
const KIT_GAP = 0.04

/** Até onde as outras peças vão quando uma fica sozinha (por dentro, de lado, nas costas, na embalagem) */
const SOLO_AWAY = 3.2

/** Distância entre os dois quadros das comparações (m) */
const PAIR_GAP = 0.14

/** Rolagem: o progresso das perguntas alcança a rolagem com este amortecimento (s); a cena, com o seu */
const STORY_DAMP = 0.16
const STORY_TIME = 0.12

/** Trecho da embalagem na história da página especial: das cantoneiras ao tampo fechado */
const PACK_FROM = STORY.corners[0]
const PACK_TO = STORY.lid[0] + STORY.lid[1]

type Weights = Record<(typeof POSE_KEYS)[number] | 'exploded' | 'side' | 'pitch' | 'tilt', number>

/**
 * O quadro em cada vista da página imersiva — de frente (inclina com o mouse), na parede da sala,
 * aberto em camadas, de lado (a espessura) e na parede de longe, com as medidas — e, rolando a
 * página, nas respostas das oito perguntas (story.ts). Trocar de aba leva a cena até a vista nova;
 * a escolha (tamanho, moldura, cor, vidro) troca o quadro na hora.
 */
export function ImersivoScene({ models: chosen, alt: chosenAlt, mode, keyLightRef, insetsRef, annotationsRef, attached, room: chosenRoom, storyRef }: ImersivoSceneProps) {
  // Uma escolha nova pode pedir textura (ou foto do ambiente) que ainda não chegou: enquanto ela
  // baixa, fica o quadro (e o ambiente) anterior
  const models = useDeferredValue(chosen)
  const alt = useDeferredValue(chosenAlt)
  const room = useDeferredValue(chosenRoom)
  const count = models.length
  // A peça que fica sozinha (por dentro, de lado, nas costas, na embalagem): a do meio, no trio
  const soloIndex = Math.floor((count - 1) / 2)
  const model = models[soloIndex]!
  const quadro = useRef<Group>(null)
  const pieceRefs = useRef<(Group | null)[]>([])
  const crate = useRef<Group>(null)
  const materialGroup = useRef<Group>(null)
  const glassGroup = useRef<Group>(null)
  const canvasGroup = useRef<Group>(null)
  const outlet = useRef<Group>(null)
  const outletShadowMaterials = useRef<Material[]>([])
  const shadowGroups = useRef<(Group | null)[]>([])
  const canvasShadowGroup = useRef<Group>(null)
  const roomGroup = useRef<Group>(null)
  const roomMaterials = useRef<Material[]>([])
  const shadowMaterials = useMemo(() => models.map(() => ({ current: [] as Material[] })), [models])
  const canvasShadowMaterials = useRef<Material[]>([])
  const fill = useRef<AmbientLight>(null)
  const environmentBase = useRef<number | null>(null)
  const explode = useRef(0)
  const packStory = useRef<StoryScrollState>({ offset: PACK_FROM - 0.01, target: PACK_FROM - 0.01 })
  const packAnchors = useRef<Partial<Record<PackStep, Object3D>>>({})
  // Pesos de cada vista e pose (0–1) e a inclinação atual: andam até o alvo
  const weights = useRef<Weights>({ ...BASE, exploded: 0, side: 0, pitch: 0, tilt: 0 })
  const pointer = usePointer(mode)
  const invalidate = useThree((state) => state.invalidate)
  const narrow = useThree((state) => state.size.width < NARROW_WIDTH)
  const explodeScale = narrow ? EXPLODE_SCALE.narrow : EXPLODE_SCALE.wide
  const size = useMemo(() => measures(model), [model])
  const canvasSize = useMemo(() => measures(alt.canvas), [alt.canvas])
  const panel = useMemo(() => panelSize(alt.canvas.outer.width, alt.canvas.outer.height), [alt.canvas])
  const [openPart, setOpenPart] = useState<string | null>(null)
  const explained = useMemo(() => model.parts.filter((part) => !attached.includes(part.id)), [model, attached])

  // Trocar de aba fecha a explicação aberta
  const [lastMode, setLastMode] = useState(mode)
  if (lastMode !== mode) {
    setLastMode(mode)
    setOpenPart(null)
  }

  // A rolagem da página pede um frame (a cena só desenha quando algo muda)
  useEffect(() => {
    const onScroll = () => invalidate()
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', onScroll, { capture: true })
  }, [invalidate])

  const work = useMemo(
    () => ({
      front: new Vector3(),
      frontLook: new Vector3(),
      direction: new Vector3(),
      exploded: new Vector3(),
      explodedLook: new Vector3(),
      side: new Vector3(),
      sideLook: new Vector3(),
      wall: new Vector3(),
      wallLook: new Vector3(),
      target: new Vector3(),
      a: new Vector3(),
      b: new Vector3(),
    }),
    [],
  )

  // Antes das animações: o progresso das perguntas alcança a rolagem e a embalagem (pergunta 05)
  // recebe o trecho dela na história da página especial
  useFrame((_, delta) => {
    const story = storyRef.current
    if (!story) return
    easing.damp(story, 'offset', story.target, STORY_DAMP, Math.min(delta, 0.1))
    if (Math.abs(story.offset - story.target) > 1e-4) invalidate()
    const packed = span(momentOf(story.offset, 5), 0.05, 0.55)
    packStory.current.offset = packStory.current.target = lerp(PACK_FROM - 0.01, PACK_TO, packed)
  }, FRAME_ORDER.scroll)

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.1)
    const w = weights.current
    const s = storyRef.current?.offset ?? 0
    const { outer } = model
    const W = outer.width
    const H = outer.height

    // Alvo: a vista da aba (na vitrine) misturada com as poses das perguntas, conforme a rolagem
    const storyWeights = weightsOf(s)
    const storyAmount = 1 - storyWeights[0]!
    const setWidth = count * W + (count - 1) * KIT_GAP
    const pose = { ...BASE }
    if (storyAmount > 0) {
      for (const key of POSE_KEYS) pose[key] = 0
      for (let k = 1; k <= QUESTIONS; k++) {
        const weight = storyWeights[k]!
        if (weight <= 0) continue
        const at = poseOf(k, momentOf(s, k), count, setWidth, W)
        for (const key of POSE_KEYS) pose[key] += (at[key] * weight) / storyAmount
      }
    }
    const solo = mode === 'dentro' ? 1 : 0
    const viewTarget = {
      wall: mode === 'parede' || mode === 'escala' ? 1 : 0,
      far: mode === 'escala' ? 1 : 0,
      exploded: mode === 'dentro' ? 1 : 0,
      // A vista de lado (Profundidade) saiu do seletor; a pose fica, parada em 0
      side: 0,
    }
    const target: Omit<Weights, 'pitch' | 'tilt'> = {
      ...BASE,
      solo,
      exploded: viewTarget.exploded * (1 - storyAmount),
      side: viewTarget.side * (1 - storyAmount),
      lift: QUADRO_OFF * Math.max(viewTarget.exploded, viewTarget.side),
      wall: viewTarget.wall,
      far: viewTarget.far,
    }
    for (const key of POSE_KEYS) target[key] = lerp(target[key], pose[key], storyAmount)
    let moving = false
    const time = storyAmount > 0.02 ? STORY_TIME : MODE_TIME
    for (const key of Object.keys(target) as (keyof typeof target)[]) moving = easing.damp(w, key, target[key], time, step) || moving
    const tilting = mode === 'frente' && storyAmount < 0.05
    moving = easing.damp(w, 'tilt', tilting ? pointer.current.x * TILT.yaw + pointer.current.drag : 0, TILT.time, step) || moving
    moving = easing.damp(w, 'pitch', tilting ? pointer.current.y * TILT.pitch : 0, TILT.time, step) || moving
    explode.current = w.exploded

    // As peças: montadas com 4 cm entre elas; afastadas; ou uma sozinha no meio (as outras saem)
    const spread = w.spread * (narrow ? NARROW_SPREAD : 1)
    const pitch = W + KIT_GAP + spread
    const baseX = (index: number) => (index - (count - 1) / 2) * pitch
    const shiftX = -baseX(soloIndex) * w.solo
    const pieceX = (index: number) => baseX(index) + shiftX + (index === soloIndex ? 0 : Math.sign(index - soloIndex) * SOLO_AWAY * w.solo)
    const show = (amount: number) => smooth((amount - 0.5) * 2)
    const mainShow = show(w.main)
    // Embalagem: o quadro sai para a frente enquanto a caixa aparece atrás e depois entra nela
    const pack = packStory.current.offset
    const packLift = PACK.lift * especialSmooth(progress(pack, STORY.box)) * (1 - especialSmooth(progress(pack, STORY.insert)))
    pieceRefs.current.forEach((piece, index) => {
      if (!piece) return
      piece.position.set(pieceX(index), 0, index === soloIndex ? packLift : 0)
    })
    if (crate.current) crate.current.position.x = pieceX(soloIndex)
    if (quadro.current) {
      quadro.current.rotation.set(w.pitch, w.tilt + EXPLODE_YAW * w.exploded + SIDE_YAW * w.side + w.yaw, 0)
      quadro.current.position.z = w.lift
      quadro.current.scale.setScalar(Math.max(0.0001, mainShow))
      quadro.current.visible = mainShow > 0.001
    }
    // Os quadros das comparações (lado a lado, girados para a luz) e o canvas sozinho da pergunta 08
    for (const [group, amount] of [
      [materialGroup.current, w.material],
      [glassGroup.current, w.glass],
    ] as const) {
      if (!group) continue
      const scale = show(amount)
      group.visible = scale > 0.001
      group.scale.setScalar(Math.max(0.0001, scale))
      group.position.z = w.lift
      // No par, `mirror` gira o segundo quadro para o outro lado (07: abrem como portas)
      group.children.forEach((item, index) => {
        item.rotation.y = w.yaw * (index === 1 ? 1 - 2 * w.mirror : 1)
      })
    }
    const canvasShow = show(w.canvas)
    if (canvasGroup.current) {
      canvasGroup.current.visible = canvasShow > 0.001
      canvasGroup.current.scale.setScalar(Math.max(0.0001, canvasShow))
      canvasGroup.current.position.set(w.slide * W, 0, w.lift)
      canvasGroup.current.rotation.y = w.yaw
    }
    // A caixa só aparece com o canvas já do tamanho final na parede, escondendo ela (crescendo, ele
    // ainda é menor que a caixa)
    const outletOn = canvasShow > 0.98 && w.wall > 0.5
    if (outlet.current) outlet.current.visible = outletOn
    fadeRoom(outletShadowMaterials.current, outletOn ? 1 : 0)

    // O ambiente aparece (foto) com o quadro pendurado; quadros altos ficam acima do móvel
    const hang = hangHeight(H, room.top)
    const drop = hang + ROOM.floorY
    if (roomGroup.current) {
      roomGroup.current.position.y = -drop
      roomGroup.current.visible = w.wall > 0.002
    }
    fadeRoom(roomMaterials.current, w.wall)
    const onWall = 1 - Math.min(1, w.lift / 0.12)
    shadowGroups.current.forEach((group, index) => {
      if (group) group.position.x = pieceX(index)
      fadeRoom(shadowMaterials[index]?.current ?? [], w.wall * onWall * mainShow)
    })
    if (canvasShadowGroup.current) canvasShadowGroup.current.position.x = w.slide * W
    // A sombra tem o tamanho final do canvas: enquanto ele cresce, ela só chega no fim
    fadeRoom(canvasShadowMaterials.current, w.wall * onWall * canvasShow ** 6)

    // Câmera: o quadro no meio da área livre (fora do cartão, das abas, das etiquetas e do texto das perguntas)
    const { size: viewport } = state
    const camera = state.camera as PerspectiveCamera
    const fov = CAMERA.fov
    const areas = insetsRef.current
    const blend = (side: keyof Insets) => lerp(areas?.vitrine[side] ?? 0, areas?.story[side] ?? 0, storyAmount)
    const insets: Insets = { top: blend('top'), right: blend('right'), bottom: blend('bottom'), left: blend('left') }
    const free = { width: Math.max(160, viewport.width - insets.left - insets.right), height: Math.max(160, viewport.height - insets.top - insets.bottom) }
    const centerX = insets.left + free.width / 2
    const centerY = insets.top + free.height / 2
    const margin = narrow ? NARROW_MARGIN : MARGIN

    // De frente (ou de frente-direita): o que estiver à mostra cabe na área livre; as perguntas aproximam e mudam o ponto
    const shown = Math.max(1e-3, w.main + w.material + w.glass + w.canvas)
    const mainWidth = lerp(count * W + (count - 1) * (KIT_GAP + spread), W, w.solo)
    const extentW = (w.main * mainWidth + (w.material + w.glass) * (2 * W + PAIR_GAP) + w.canvas * W) / shown
    work.frontLook.set(w.focusX * extentW, w.focusY * H, w.lift)
    work.direction.copy(FRONT_DIRECTION).lerp(ANGLED_DIRECTION, w.angled).normalize()
    const frontMargin = margin.front * (narrow ? 1 + NARROW_ANGLED_MARGIN * w.angled : 1)
    work.front.copy(work.frontLook).addScaledVector(work.direction, fitDistance([extentW, H], fov, viewport, free, frontMargin) / Math.max(0.2, w.zoom))
    const explodedDistance = fitDistance(frameExtent(model, 1, explodeScale, EXPLODE_YAW), fov, viewport, free, margin.exploded)
    work.explodedLook.set(0, 0, QUADRO_OFF)
    work.exploded.copy(work.explodedLook).addScaledVector(ANGLED_DIRECTION, explodedDistance)
    const yaw = Math.abs(SIDE_YAW)
    const sideExtent: [number, number] = [W * Math.cos(yaw) + (size.depth / 100) * Math.sin(yaw), H]
    work.sideLook.set(0, 0, QUADRO_OFF)
    work.side.copy(work.sideLook).addScaledVector(FRONT_DIRECTION, fitDistance(sideExtent, fov, viewport, free, margin.side))

    const roomPhoto = narrow ? room.narrow : room.wide
    const photo = narrow ? { ...roomPhoto, zoom: roomPhoto.zoom * NARROW_WALL_ZOOM } : roomPhoto
    const quadroTop = hang + H / 2
    // No celular, as etiquetas de cima (dica, migalha) cobrem a parede: o quadro fica abaixo delas
    const reserve = narrow ? Math.min(0.5, insets.top / viewport.height) : 0
    // A imagem vai para o lado (setViewOffset, abaixo) para o quadro ficar no meio da área livre; no
    // celular, também sobe metade do que cobre o pé do palco (as vistas, a faixa das perguntas)
    const shift = (viewport.width / 2 - centerX) / viewport.width
    const wallLiftPx = narrow ? insets.bottom / 2 : 0
    const shiftY = wallLiftPx / viewport.height
    const near = photoView(photo, viewport, quadroTop, reserve, shift, shiftY)
    // (no máximo a foto inteira, com uma folga mínima para a borda dela nunca aparecer)
    const far = photoView({ ...photo, zoom: Math.max(1.02, photo.zoom * (narrow ? NARROW_FAR_ZOOM : FAR_ZOOM)) }, viewport, quadroTop, reserve, shift, shiftY)
    const mixed = { x: lerp(near.x, far.x, w.far), y: lerp(near.y, far.y, w.far), width: lerp(near.width, far.width, w.far), height: lerp(near.height, far.height, w.far) }
    work.wall.set(mixed.x, mixed.y - drop, ROOM.wallZ + fitDistance([mixed.width, mixed.height], fov, viewport, viewport, 1))
    work.wallLook.set(mixed.x, mixed.y - drop, 0)

    camera.position.copy(work.front).lerp(work.exploded, w.exploded).lerp(work.side, w.side).lerp(work.wall, w.wall)
    work.target.copy(work.frontLook).lerp(work.explodedLook, w.exploded).lerp(work.sideLook, w.side).lerp(work.wallLook, w.wall)
    camera.lookAt(work.target)
    const distance = camera.position.distanceTo(work.target)
    camera.near = Math.max(CAMERA.near, distance * NEAR_FRACTION)
    camera.far = distance + CAMERA.far
    camera.updateMatrixWorld()
    // Na parede, a foto já vem composta: só o deslocamento para o lado (fora do cartão)
    camera.setViewOffset(viewport.width, viewport.height, viewport.width / 2 - centerX, (viewport.height / 2 - centerY) * (1 - w.wall) + wallLiftPx * w.wall, viewport.width, viewport.height)

    // Luz: na parede, a da janela da foto e a difusa no lugar do estúdio; o vidro quase não reflete
    if (keyLightRef.current) {
      keyLightRef.current.position.lerpVectors(KEY_POSITION, AMBIENT_LIGHT, w.wall)
      keyLightRef.current.intensity = KEY_LIGHT.intensity * lerp(1, ROOM_KEY, w.wall)
    }
    environmentBase.current ??= state.scene.environmentIntensity
    state.scene.environmentIntensity = environmentBase.current * lerp(1, ROOM_LIGHT.environment, w.wall)
    if (fill.current) fill.current.intensity = ROOM_LIGHT.fill * w.wall
    for (const group of [quadro.current, glassGroup.current]) {
      group?.traverse((object) => {
        const material = (object as Mesh).material as MeshStandardMaterial | undefined
        if (!material || Array.isArray(material) || material.blending !== AdditiveBlending) return
        material.userData.envBase ??= material.envMapIntensity
        material.envMapIntensity = (material.userData.envBase as number) * lerp(1, ROOM_GLASS, w.wall)
      })
    }

    // Cotas
    const root = annotationsRef.current
    const group = quadro.current
    if (root && group) {
      const halfW = W / 2
      const halfH = H / 2
      const toScreen = (vector: Vector3) => {
        vector.project(camera)
        return vector.set(((vector.x + 1) / 2) * viewport.width, ((1 - vector.y) / 2) * viewport.height, 0)
      }
      const project = (object: Object3D, vector: Vector3, x: number, y: number, z: number) => toScreen(object.localToWorld(vector.set(x, y, z)))
      const onPhoto = (vector: Vector3, x: number, y: number) => toScreen(vector.set(x, ROOM.floorY + y - drop, ROOM.wallZ))
      const first = pieceX(0)
      const last = pieceX(count - 1)
      // Na escala (e na pergunta 01): a largura do conjunto e a altura das peças
      placeDim(root, 'w', project(group, work.a, first - halfW, halfH + DIM_GAP, size.front), project(group, work.b, last + halfW, halfH + DIM_GAP, size.front), [0, -16], w.far * mainShow)
      placeDim(root, 'h', project(group, work.a, first - halfW - DIM_GAP, halfH, size.front), project(group, work.b, first - halfW - DIM_GAP, -halfH, size.front), [-26, 0], w.far * mainShow)
      // Profundidade: na lateral que vira para a câmera, no meio da altura, com a medida ao lado
      const soloX = pieceX(soloIndex)
      placeDim(root, 'd', project(group, work.a, soloX + halfW, 0, size.front), project(group, work.b, soloX + halfW, 0, size.back), [44, 0], w.side * mainShow)
      // O móvel de referência — a largura logo acima dele e a altura do piso ao topo, ao lado
      const furniture = furnitureOf(room, narrow ? 'narrow' : 'wide')
      const lineY = furniture.height + FURNITURE_GAP.top
      // Faixa visível do palco (fora das vistas e da etiqueta), em px: as medidas ficam dentro dela
      const visible: [number, number] = [insets.left + 36, viewport.width - insets.right - 36]
      // A parede é vista de frente: x na tela é linear em x na parede
      const screen0 = onPhoto(work.a, 0, lineY).x
      const perMeter = onPhoto(work.b, 1, lineY).x - screen0
      const screenX = (x: number) => screen0 + x * perMeter
      const wallX = (px: number) => (px - screen0) / (perMeter || 1)
      // Altura: à esquerda do móvel; se não aparecer, à direita; se nenhum lado aparecer, na parte visível dele
      const leftSide = furniture.left - FURNITURE_GAP.side
      const rightSide = furniture.right + FURNITURE_GAP.side
      const [sideX, labelSide] =
        screenX(leftSide) >= visible[0] ? [leftSide, -30] : screenX(rightSide) <= visible[1] ? [rightSide, 30] : [wallX(visible[0]), 30]
      placeDim(root, 'fw', onPhoto(work.a, furniture.left, lineY), onPhoto(work.b, furniture.right, lineY), [0, -16], w.far, `${room.furniture} · ${roundCm(furniture.width)} cm`, [visible[0] + 70, visible[1] - 70])
      placeDim(root, 'fh', onPhoto(work.a, sideX, 0), onPhoto(work.b, sideX, furniture.height), [labelSide, 0], w.far, `${roundCm(furniture.height)} cm`)

      // 02 · a medida em cima de cada peça
      const u2 = momentOf(s, 2)
      for (let index = 0; index < 3; index++) {
        const piece = pieceRefs.current[index]
        const opacity = piece && index < count ? storyWeights[2]! * span(u2, 0.3, 0.5) * mainShow : 0
        if (piece) project(piece, work.a, 0, halfH + 0.05, size.front)
        placeDim(root, `p${index}`, work.a, work.a, [0, -12], opacity)
      }
      // 03 · conjunto: o vão entre a 1ª e a 2ª peça; avulso: a folga entre o móvel e a base do quadro
      const u3 = momentOf(s, 3)
      if (count > 1) {
        const gap = Math.round((pieceX(1) - pieceX(0) - W) * 100)
        placeDim(root, 'g', project(group, work.a, first + halfW, -halfH - 0.035, size.front), project(group, work.b, pieceX(1) - halfW, -halfH - 0.035, size.front), [0, 16], storyWeights[3]! * span(u3, 0.35, 0.5), `${gap} cm`)
      } else {
        placeDim(root, 'g', work.a, work.a, [0, 0], 0)
      }
      const gapAbove = hang - halfH - room.top
      placeDim(root, 'v', onPhoto(work.a, -halfW - 0.07, room.top), onPhoto(work.b, -halfW - 0.07, hang - halfH), [-30, 0], count > 1 ? 0 : storyWeights[3]! * w.wall, `${Math.round(gapAbove * 100)} cm`)

      // 06 e 07 · o nome de cada quadro do par, numa etiqueta apontando para ele
      const materialShow = show(w.material)
      const glassShow = show(w.glass)
      const pair = materialShow >= glassShow ? materialGroup.current : glassGroup.current
      const names = materialShow >= glassShow ? ['Canvas', 'Papel fosco'] : ['Sem vidro', 'Com vidro']
      for (let index = 0; index < 2; index++) {
        const item = pair?.children[index]
        // 06: em cima da arte de cada um (a câmera chega perto e passa de um para o outro); 07: na
        // borda de cima, junto ao vão. A etiqueta (24 px + a setinha de 6 px) fica logo acima do ponto
        if (item) {
          if (materialShow >= glassShow) project(item, work.a, 0, halfH * 0.5, size.front)
          else project(item, work.a, (index === 0 ? 1 : -1) * (halfW - 0.07), halfH, 0)
        }
        // Os nomes só com o par perto do tamanho cheio: encolhendo (troca de pergunta), eles somem antes
        placeDim(root, `a${index}`, work.a, work.a, [0, -22], item ? smooth((Math.max(materialShow, glassShow) - 0.7) / 0.3) : 0, names[index])
      }
      // 08 · a caixa de luz atrás do canvas e a profundidade dele
      const reveal = Math.min(1, w.slide / 0.95)
      onPhoto(work.a, 0, hang - panel.height / 2 - 0.012)
      placeDim(root, 'bx', work.a, work.a, [0, 16], canvasShow * w.wall * smooth((reveal - 0.6) / 0.4))
      if (canvasGroup.current) {
        // Na parte de cima da lateral: no meio, a medida caía em cima da caixa de luz
        const depthY = halfH - 0.06
        placeDim(
          root,
          'cd',
          project(canvasGroup.current, work.a, -halfW, depthY, canvasSize.front),
          project(canvasGroup.current, work.b, -halfW, depthY, canvasSize.back),
          [-36, 0],
          canvasShow * smooth((reveal - 0.6) / 0.4),
          `${canvasSize.depth.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} cm`,
        )
      }
    }

    if (moving) state.invalidate()
  })

  const hotspot = (part: PartDef) =>
    attached.includes(part.id) ? null : (
      <Hotspot
        part={part}
        index={explained.indexOf(part)}
        count={explained.length}
        explode={explode}
        open={openPart === part.id}
        onToggle={() => setOpenPart((current) => (current === part.id ? null : part.id))}
        onStep={(step) => setOpenPart(explained[(explained.indexOf(part) + step + explained.length) % explained.length]?.id ?? null)}
      />
    )
  const pairX = (model.outer.width + PAIR_GAP) / 2

  return (
    <StoryValue value={packStory}>
      <group ref={quadro}>
        {models.map((piece, index) => (
          <group
            key={index}
            ref={(element) => {
              pieceRefs.current[index] = element
            }}
          >
            <Frame model={piece} explode={explode} explodeScale={explodeScale} renderMarker={index === soloIndex ? hotspot : undefined} />
            {index === soloIndex && <Guards model={piece} anchorsRef={packAnchors} />}
          </group>
        ))}
        <group ref={crate}>
          <Crate model={model} anchorsRef={packAnchors} />
        </group>
      </group>
      {/* 06 · canvas × papel fosco; 07 · sem × com vidro (lado a lado) */}
      <group ref={materialGroup} visible={false}>
        <group position-x={-pairX}>
          <Frame model={alt.canvas} />
        </group>
        <group position-x={pairX}>
          <Frame model={alt.paper} />
        </group>
      </group>
      <group ref={glassGroup} visible={false}>
        <group position-x={-pairX}>
          <Frame model={alt.plain} />
        </group>
        <group position-x={pairX}>
          <Frame model={alt.glazed} />
        </group>
      </group>
      {/* 08 · o canvas na parede, com a caixa de luz atrás */}
      <group ref={canvasGroup} visible={false}>
        <Frame model={alt.canvas} />
      </group>
      <group ref={outlet} visible={false}>
        <ElectricPanel width={panel.width} height={panel.height} />
        <WallShadow width={panel.width} height={panel.height} materialsRef={outletShadowMaterials} />
      </group>
      <ambientLight ref={fill} intensity={0} color="#fff6ec" />
      <PhotoRoom key={(narrow ? room.narrow : room.wide).src} photo={narrow ? room.narrow : room.wide} group={roomGroup} materialsRef={roomMaterials} />
      {models.map((piece, index) => (
        <group
          key={index}
          ref={(element) => {
            shadowGroups.current[index] = element
          }}
        >
          <WallShadow width={piece.outer.width} height={piece.outer.height} materialsRef={shadowMaterials[index]!} />
        </group>
      ))}
      <group ref={canvasShadowGroup}>
        <WallShadow width={alt.canvas.outer.width} height={alt.canvas.outer.height} materialsRef={canvasShadowMaterials} />
      </group>
    </StoryValue>
  )
}

/**
 * Medida do quadro de distribuição atrás do canvas (m): a tampa na proporção dos de embutir
 * (≈ 1,27 : 1), 70% da largura do canvas, entre 20 e 36 cm, sempre com folga para ele esconder
 */
function panelSize(canvasWidth: number, canvasHeight: number) {
  const width = Math.min(0.36, Math.max(0.2, canvasWidth * 0.7))
  return { width, height: Math.min(width / 1.27, canvasHeight * 0.7) }
}

/** O quanto a tampa sai da parede (m): o canvas tem 3,8 cm de profundidade e passa por cima */
const PANEL_DEPTH = 0.025

/**
 * Quadro de distribuição (a caixa de luz que o canvas esconde), na parede atrás do quadro: a
 * tampa branca de plástico com cantos arredondados e os dois vincos que dividem a frente em três
 * faixas, com a marca em relevo no canto de baixo
 */
function ElectricPanel({ width, height }: { width: number; height: number }) {
  const front = PANEL_DEPTH / 2 + 0.0002
  return (
    <group position-z={ROOM.wallZ + PANEL_DEPTH / 2}>
      <RoundedBox args={[width, height, PANEL_DEPTH]} radius={0.007} smoothness={4}>
        <meshStandardMaterial color="#f2f0eb" roughness={0.42} />
      </RoundedBox>
      {/* Os vincos: a linha funda e, logo abaixo, a borda que pega luz */}
      {[0.27, 0.7].map((at) => (
        <group key={at} position={[0, height / 2 - at * height, front]}>
          <mesh>
            <planeGeometry args={[width - 0.014, 0.0014]} />
            <meshBasicMaterial color="#c9c3b9" />
          </mesh>
          <mesh position-y={-0.0013}>
            <planeGeometry args={[width - 0.014, 0.0009]} />
            <meshBasicMaterial color="#fbfaf7" />
          </mesh>
        </group>
      ))}
      <mesh position={[-width / 2 + 0.026, -height / 2 + 0.028, front]}>
        <planeGeometry args={[0.022, 0.01]} />
        <meshBasicMaterial color="#e4dfd6" />
      </mesh>
    </group>
  )
}

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

/** Medida do móvel (m) em cm: inteiro até 1 m, de 5 em 5 acima (a foto não dá mais precisão que isso) */
const roundCm = (meters: number) => (meters < 1 ? Math.round(meters * 100) : Math.round(meters * 20) * 5)

/**
 * Uma cota no HTML por cima do canvas: a linha de `a` até `b` (px) e a medida no meio, afastada
 * `offset` px da linha (`text` troca a medida). Some com `opacity` 0.
 */
function placeDim(root: HTMLElement, key: string, a: Vector3, b: Vector3, offset: [number, number], opacity: number, text?: string, labelRange?: [number, number]) {
  const element = root.querySelector<HTMLElement>(`[data-dim="${key}"]`)
  if (!element) return
  element.style.opacity = String(opacity)
  if (opacity < 0.01) return
  const line = element.querySelector<HTMLElement>('[data-dim-line]')
  const label = element.querySelector<HTMLElement>('[data-dim-label]')
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const angle = Math.atan2(b.y - a.y, b.x - a.x)
  if (line) {
    // Sem comprimento é só o rótulo (nome ou medida solta): sem a linha nem os tracinhos das pontas
    line.style.display = length < 1 ? 'none' : ''
    line.style.width = `${length}px`
    line.style.transform = `translate(${a.x}px, ${a.y}px) rotate(${angle}rad)`
  }
  if (label) {
    if (text !== undefined && label.textContent !== text) label.textContent = text
    // A medida fica no meio da linha (ou, com `labelRange`, na parte dela que aparece)
    const middle = (a.x + b.x) / 2
    const x = labelRange ? Math.min(Math.max(middle, Math.max(labelRange[0], Math.min(a.x, b.x))), Math.min(labelRange[1], Math.max(a.x, b.x))) : middle
    label.style.transform = `translate(${x + offset[0]}px, ${(a.y + b.y) / 2 + offset[1]}px) translate(-50%, -50%)`
  }
}

/**
 * Ponteiro sobre o canvas: com mouse, a posição (−1 a 1) inclina o quadro de frente; com o dedo,
 * arrastar na horizontal gira (o arrasto vertical continua rolando a página: touch-action pan-y).
 * Trocar de aba volta o giro do dedo para o meio.
 */
function usePointer(mode: Mode) {
  const element = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  const pointer = useRef({ x: 0, y: 0, drag: 0 })
  useEffect(() => {
    pointer.current.drag = 0
    invalidate()
  }, [mode, invalidate])
  useEffect(() => {
    let from: number | null = null
    const clamp = (value: number) => Math.max(-1, Math.min(1, value))
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') {
        const box = element.getBoundingClientRect()
        pointer.current.x = clamp(((event.clientX - box.left) / box.width) * 2 - 1)
        pointer.current.y = clamp(((event.clientY - box.top) / box.height) * 2 - 1)
        invalidate()
      } else if (from !== null) {
        pointer.current.drag = Math.max(-TILT.drag, Math.min(TILT.drag, pointer.current.drag + (event.clientX - from) * 0.008))
        from = event.clientX
        invalidate()
      }
    }
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') from = event.clientX
    }
    const up = () => {
      from = null
    }
    const leave = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      pointer.current.x = 0
      pointer.current.y = 0
      invalidate()
    }
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerdown', down)
    element.addEventListener('pointerleave', leave)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerdown', down)
      element.removeEventListener('pointerleave', leave)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [element, invalidate])
  return pointer
}

interface HotspotProps {
  part: PartDef
  /** Posição na lista das partes explicadas (0 = a da frente) */
  index: number
  count: number
  explode: { readonly current: number }
  open: boolean
  onToggle: () => void
  onStep: (step: 1 | -1) => void
}

/**
 * O "+" de uma parte na vista por dentro e o balão com o nome e a explicação (como na página de
 * produto). Aparece com as camadas abertas; o balão abre para o lado com mais espaço.
 */
function Hotspot({ part, index, count, explode, open, onToggle, onStep }: HotspotProps) {
  const element = useRef<HTMLDivElement>(null)
  const anchor = useRef<Object3D>(null)
  const canvas = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  useFrame(() => {
    const node = element.current
    if (!node) return
    const reveal = Math.min(1, Math.max(0, (explode.current - 0.6) / 0.35))
    node.style.opacity = String(reveal)
    node.style.pointerEvents = reveal > 0.5 ? 'auto' : 'none'
    if (open) {
      const button = node.getBoundingClientRect()
      const area = canvas.getBoundingClientRect()
      node.dataset.side = button.left + button.width / 2 - area.left < area.width / 2 ? 'right' : 'left'
    }
  })
  const press = (action: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    action()
    invalidate()
  }
  return (
    <group position={part.marker} ref={anchor}>
      <Html center zIndexRange={[30, 10]}>
        <div
          ref={(node) => {
            element.current = node
            if (node) invalidate()
          }}
          className="group relative"
          data-open={open ? '' : undefined}
          style={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${part.label}: ${open ? 'fechar' : 'ver'} explicação`}
            onClick={press(onToggle)}
            className="flex size-8 items-center justify-center rounded-full bg-white text-lg leading-none font-medium text-[#2a2520] shadow-[0_4px_14px_rgba(42,37,32,0.25)] ring-1 ring-black/5 transition hover:scale-110 group-data-[open]:bg-[#2a2520] group-data-[open]:text-white"
          >
            <span className="transition group-data-[open]:rotate-45">+</span>
          </button>
          {open && (
            <div
              role="note"
              className="absolute top-1/2 left-full ml-3 w-64 -translate-y-1/2 rounded-2xl bg-white p-4 text-left text-[13px] leading-relaxed text-[#5a534e] shadow-[0_18px_40px_-18px_rgba(42,37,32,0.45)] group-data-[side=left]:right-full group-data-[side=left]:left-auto group-data-[side=left]:mr-3 group-data-[side=left]:ml-0"
            >
              <b className="mb-1 block text-sm font-semibold text-[#2a2520]">{part.label}</b>
              <span>{part.description}</span>
              {count > 1 && (
                <span className="mt-3 flex items-center justify-between text-xs text-[#8a7d6c]">
                  <button type="button" aria-label="Parte anterior" onClick={press(() => onStep(-1))} className="size-7 rounded-full border border-[#e4dccf] text-[#2a2520]">
                    ‹
                  </button>
                  <span>
                    {index + 1} de {count}
                  </span>
                  <button type="button" aria-label="Próxima parte" onClick={press(() => onStep(1))} className="size-7 rounded-full border border-[#e4dccf] text-[#2a2520]">
                    ›
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}
