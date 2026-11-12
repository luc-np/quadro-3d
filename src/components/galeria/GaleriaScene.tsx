import { Suspense, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { AdditiveBlending, CubeCamera, DoubleSide, HalfFloatType, Mesh, MeshBasicMaterial, PlaneGeometry, Scene, Vector3, WebGLCubeRenderTarget, type AmbientLight, type DirectionalLight, type Group, type Material, type MeshStandardMaterial, type PerspectiveCamera } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { Frame } from '@/components/scene/Frame'
import { fitDistance } from '@/components/scene/layout'
import type { ModelDef } from '@/components/scene/models/types'
import { BACK_LIGHT, CAMERA, ENVIRONMENT_INTENSITY, GRAZING_LIGHT, KEY_LIGHT, SHADOW } from '@/components/scene/Studio'
import { AMBIENT, hangOnPhoto, PhotoRoom, photoView, WallShadow } from '@/components/especial/PhotoRoom'
import { fadeRoom, ROOM } from '@/components/especial/Room'
import { furnitureOf, type RoomDef } from '@/components/imersivo/rooms'

/**
 * As vistas da galeria da página de produto: o quadro em 3D (de frente, inclina com o mouse e gira
 * arrastando), pendurado na parede de um ambiente em foto e a escala (a parede de longe, com as
 * medidas do quadro e do móvel). A troca entre elas é a da página imersiva: a câmera vai até a
 * parede e o ambiente aparece.
 */
export type GaleriaMode = 'frente' | 'parede' | 'escala'

/** Área do palco coberta pelo HTML do tema (px): o quadro fica no meio do que sobra */
export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

/** Tempo (s) da troca de vista (o mesmo da página imersiva) */
const MODE_TIME = 0.45

/**
 * De frente: o mouse leva o quadro até estes ângulos (como na imersiva). Segurando o botão (ou com
 * o dedo), arrastar gira o quadro inteiro, sem limite na horizontal; na vertical (só o mouse), até `pitch`.
 */
const TILT = { yaw: (16 * Math.PI) / 180, pitch: (9 * Math.PI) / 180, time: 0.3 }
const DRAG = { yawPerPx: 0.011, pitchPerPx: 0.006, pitch: (28 * Math.PI) / 180, time: 0.08 }

/** Ao ficar pronto, o quadro vira um pouco e volta: mostra que é 3D (sem isso com "reduzir movimento") */
const INTRO = { delay: 0.35, duration: 1.5, yaw: (24 * Math.PI) / 180 }

/** Folga do quadro na área livre (1 = encostado nas bordas); na vitrine pequena (celular), menor */
const FRONT_MARGIN = { wide: 1.28, narrow: 1.14 }
/** Abaixo desta largura (px) a vitrine é a do celular: o quadro ocupa mais dela */
const COMPACT_WIDTH = 560

/** Escala: o enquadramento da sala abre (fração do zoom da vista "Na parede"); no celular, abre menos */
const FAR_ZOOM = 0.62
const NARROW_FAR_ZOOM = 0.8

/** No celular, a foto do ambiente chega mais perto do quadro */
const NARROW_WALL_ZOOM = 1.22

/** Cotas: distância (m) da linha até o quadro e até o móvel */
const DIM_GAP = 0.05
const FURNITURE_GAP = { top: 0.07, side: 0.1 }

/** Na parede: a luz da janela da foto, pouco reflexo no vidro e a luz de estúdio trocada por uma difusa */
const ROOM_KEY = 1.9
const ROOM_GLASS = 0.1
const ROOM_LIGHT = { environment: 0.3, fill: 1 }

/** Plano de corte da câmera proporcional à distância (a sala fica longe) */
const NEAR_FRACTION = 0.1

/** Abaixo disto (px de tela), o módulo usa as texturas leves (embed/galeria.tsx) */
export const NARROW_WIDTH = 768

/** Distância entre as peças de um conjunto (m) */
const KIT_GAP = 0.04

const FRONT_DIRECTION = new Vector3(0, 0.05, 1).normalize()
const KEY_POSITION = new Vector3(...KEY_LIGHT.position)
const AMBIENT_LIGHT = new Vector3(...AMBIENT.light)
const TURN = Math.PI * 2

interface GaleriaSceneProps {
  /** Uma por peça: duo e trio têm duas ou três, na mesma medida e moldura */
  models: ModelDef[]
  mode: GaleriaMode
  room: RoomDef
  /** Monta a foto do ambiente (baixa ela): ao ir para a parede ou quando o tema pede, depois do 3D pronto */
  roomOn: boolean
  insets: Insets
  background: string
  /** Camada das cotas (.gq3g-dim[data-dim] com [data-dim-line] e [data-dim-label]), por cima do canvas */
  annotationsRef: RefObject<HTMLDivElement | null>
  onReady?: () => void
  /** A foto do ambiente terminou de baixar (a troca para a parede espera por ela) */
  onRoomReady?: () => void
}

/**
 * O conteúdo do canvas da galeria (o tema monta o canvas: embed/galeria.tsx): as luzes, a luz de
 * estúdio (feita na cena, sem arquivo para baixar), o quadro e, quando pedido, o ambiente
 */
export function GaleriaStage(props: GaleriaSceneProps) {
  const keyLight = useRef<DirectionalLight>(null)
  // Celular: sombra com metade da resolução (a galeria é pequena e a GPU é fraca)
  const [mapSize] = useState(() => (window.innerWidth < NARROW_WIDTH ? SHADOW.mapSize / 2 : SHADOW.mapSize))
  // Câmera de sombra justa no conjunto (como no visualizador): a folga contra "acne" cresce com ela
  const outer = props.models[0]!.outer
  const setWidth = props.models.length * outer.width + (props.models.length - 1) * KIT_GAP
  const shadowExtent = Math.max(SHADOW.extent, Math.max(setWidth, outer.height) / 2 + 0.1)
  useStudioEnvironment()
  return (
    <>
      <color attach="background" args={[props.background]} />
      <directionalLight
        ref={keyLight}
        {...KEY_LIGHT}
        castShadow
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={SHADOW.bias}
        shadow-normalBias={SHADOW.normalBias * (shadowExtent / SHADOW.extent) * (SHADOW.mapSize / mapSize)}
      >
        <orthographicCamera key={shadowExtent} attach="shadow-camera" args={[-shadowExtent, shadowExtent, shadowExtent, -shadowExtent, SHADOW.near, SHADOW.far]} />
      </directionalLight>
      <directionalLight {...GRAZING_LIGHT} />
      <directionalLight {...BACK_LIGHT} />
      <Suspense fallback={null}>
        <GaleriaScene {...props} keyLightRef={keyLight} />
        <Ready onReady={props.onReady} />
      </Suspense>
    </>
  )
}

/**
 * A luz de estúdio do visualizador da loja (StudioLight: um softbox na frente e acima, rebatedores
 * nas laterais, o chão claro), feita uma vez num cubo de 256 px sem o Environment do drei (que traz
 * os leitores de HDR/EXR junto)
 */
const LIGHTFORMERS = [
  { intensity: 3, position: [0.6, 1.6, 3], scale: [4, 2.5] },
  { intensity: 1.2, position: [-3, 0.3, 1], scale: [2, 3] },
  { intensity: 0.8, position: [3, 0.3, -0.5], scale: [2, 3] },
  { intensity: 0.5, position: [0, -2.5, 0.5], scale: [6, 6], color: '#f2e8dc' },
  { intensity: 0.6, position: [0, 0.5, -3], scale: [5, 3] },
] as const

function useStudioEnvironment() {
  const get = useThree((state) => state.get)
  useLayoutEffect(() => {
    const { gl, scene } = get()
    const studio = new Scene()
    const plane = new PlaneGeometry(1, 1)
    const materials = LIGHTFORMERS.map(({ intensity, position, scale, ...rest }) => {
      const material = new MeshBasicMaterial({ color: 'color' in rest ? rest.color : 'white', side: DoubleSide, toneMapped: false })
      material.color.multiplyScalar(intensity)
      const mesh = new Mesh(plane, material)
      mesh.position.set(position[0], position[1], position[2])
      mesh.scale.set(scale[0], scale[1], 1)
      mesh.lookAt(0, 0, 0)
      studio.add(mesh)
      return material
    })
    const target = new WebGLCubeRenderTarget(256)
    target.texture.type = HalfFloatType
    const autoClear = gl.autoClear
    gl.autoClear = true
    new CubeCamera(1, 1000, target).update(gl, studio)
    gl.autoClear = autoClear
    plane.dispose()
    materials.forEach((material) => material.dispose())
    scene.environment = target.texture
    scene.environmentIntensity = ENVIRONMENT_INTENSITY * 4
    return () => {
      scene.environment = null
      target.dispose()
    }
  }, [get])
}

/** Avisa quando o conteúdo (texturas e luz) terminou de carregar */
function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => onReady?.(), [onReady])
  return null
}

type Weights = { wall: number; far: number; tilt: number; pitch: number; spin: number }

function GaleriaScene({ models: chosen, mode, room: chosenRoom, roomOn, insets, annotationsRef, onRoomReady, keyLightRef }: GaleriaSceneProps & { keyLightRef: RefObject<DirectionalLight | null> }) {
  // Uma escolha nova pode pedir textura que ainda não chegou: enquanto ela baixa, fica o quadro anterior
  const models = useDeferredValue(chosen)
  const room = useDeferredValue(chosenRoom)
  const count = models.length
  const model = models[0]!
  const quadro = useRef<Group>(null)
  const pieceRefs = useRef<(Group | null)[]>([])
  const shadowGroups = useRef<(Group | null)[]>([])
  const shadowMaterials = useMemo(() => models.map(() => ({ current: [] as Material[] })), [models])
  const roomGroup = useRef<Group>(null)
  const roomMaterials = useRef<Material[]>([])
  const roomReady = useRef(false)
  const fill = useRef<AmbientLight>(null)
  const environmentBase = useRef<number | null>(null)
  const weights = useRef<Weights>({ wall: 0, far: 0, tilt: 0, pitch: 0, spin: 0 })
  const pointer = usePointer(mode)
  const invalidate = useThree((state) => state.invalidate)
  // A foto do ambiente segue o formato da vitrine (a do computador tem menos de 768 px de largura):
  // em pé, a foto vertical (a do celular da imersiva); deitada, a horizontal
  const narrow = useThree((state) => state.size.height > state.size.width)
  const compact = useThree((state) => state.size.width < COMPACT_WIDTH)
  // A foto chegou: a troca para a parede (que espera por ela) já pode acontecer
  const roomLoaded = useCallback(() => {
    roomReady.current = true
    onRoomReady?.()
    invalidate()
  }, [onRoomReady, invalidate])
  const intro = useRef<number | null>(null)
  // Frente do quadro (m): as cotas da escala ficam nela
  const depthFront = useMemo(() => model.parts.reduce((max, part) => Math.max(max, ...part.boxes.map((box) => box.position[2] + box.size[2] / 2)), 0), [model])

  const work = useMemo(() => ({ front: new Vector3(), frontLook: new Vector3(), wall: new Vector3(), wallLook: new Vector3(), target: new Vector3(), a: new Vector3(), b: new Vector3() }), [])

  // O giro de apresentação começa quando a cena aparece (o primeiro frame com o quadro)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    intro.current = -1
    invalidate()
  }, [invalidate])

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.1)
    const w = weights.current
    const W = model.outer.width
    const H = model.outer.height
    const front = mode === 'frente'
    // A parede espera a foto do ambiente: sem ela, o quadro fica de frente
    const wallOn = !front && roomReady.current

    let moving = easing.damp(w, 'wall', wallOn ? 1 : 0, MODE_TIME, step)
    moving = easing.damp(w, 'far', wallOn && mode === 'escala' ? 1 : 0, MODE_TIME, step) || moving
    const p = pointer.current
    // Arrastando, a inclinação do mouse fica onde estava (ele não atualiza x/y) e o arrasto gira por cima
    moving = easing.damp(w, 'tilt', front ? p.x * TILT.yaw : 0, TILT.time, step) || moving
    moving = easing.damp(w, 'pitch', front ? (p.dragging ? p.pitch : p.y * TILT.pitch) : 0, p.dragging ? DRAG.time : TILT.time, step) || moving
    moving = easing.damp(w, 'spin', p.spin, p.dragging ? DRAG.time : MODE_TIME, step) || moving

    // Apresentação: vira até INTRO.yaw e volta, uma vez (a pessoa mexendo, para)
    let introYaw = 0
    if (intro.current !== null) {
      if (intro.current < 0) intro.current = state.clock.elapsedTime
      const t = state.clock.elapsedTime - intro.current - INTRO.delay
      if (p.touched || !front || t > INTRO.duration) intro.current = null
      else {
        if (t > 0) introYaw = INTRO.yaw * Math.sin((Math.PI * t) / INTRO.duration) ** 2
        moving = true
      }
    }

    // As peças: montadas com 4 cm entre elas
    const pitchX = W + KIT_GAP
    pieceRefs.current.forEach((piece, index) => {
      piece?.position.set((index - (count - 1) / 2) * pitchX, 0, 0)
    })
    if (quadro.current) quadro.current.rotation.set(w.pitch, w.tilt + w.spin + introYaw, 0)

    // O ambiente aparece (foto) com o quadro pendurado; quadros altos ficam acima do móvel e, quando a
    // foto acaba antes (móvel estreito na escala da largura dele), descem até caber
    const roomPhoto = narrow ? room.narrow : room.wide
    const hang = hangOnPhoto(H, room.top, roomPhoto)
    const drop = hang + ROOM.floorY
    if (roomGroup.current) {
      roomGroup.current.position.y = -drop
      roomGroup.current.visible = w.wall > 0.002
    }
    fadeRoom(roomMaterials.current, w.wall)
    shadowGroups.current.forEach((group, index) => {
      if (group) group.position.x = (index - (count - 1) / 2) * pitchX
      fadeRoom(shadowMaterials[index]?.current ?? [], w.wall)
    })

    // Câmera: o quadro no meio da área livre
    const { size: viewport } = state
    const camera = state.camera as PerspectiveCamera
    const fov = CAMERA.fov
    const free = { width: Math.max(120, viewport.width - insets.left - insets.right), height: Math.max(120, viewport.height - insets.top - insets.bottom) }
    const centerX = insets.left + free.width / 2
    const centerY = insets.top + free.height / 2
    const setWidth = count * W + (count - 1) * KIT_GAP
    work.frontLook.set(0, 0, 0)
    work.front.copy(work.frontLook).addScaledVector(FRONT_DIRECTION, fitDistance([setWidth, H], fov, viewport, free, compact ? FRONT_MARGIN.narrow : FRONT_MARGIN.wide))

    const photo = narrow ? { ...roomPhoto, zoom: roomPhoto.zoom * NARROW_WALL_ZOOM } : roomPhoto
    const quadroTop = hang + H / 2
    const shift = (viewport.width / 2 - centerX) / viewport.width
    const scene = { setWidth, furnitureTop: room.top }
    const near = photoView(photo, viewport, quadroTop, insets.top / viewport.height, shift, 0, scene)
    const far = photoView({ ...photo, zoom: Math.max(1.02, photo.zoom * (narrow ? NARROW_FAR_ZOOM : FAR_ZOOM)) }, viewport, quadroTop, insets.top / viewport.height, shift, 0, scene)
    const mixed = { x: lerp(near.x, far.x, w.far), y: lerp(near.y, far.y, w.far), width: lerp(near.width, far.width, w.far), height: lerp(near.height, far.height, w.far) }
    work.wall.set(mixed.x, mixed.y - drop, ROOM.wallZ + fitDistance([mixed.width, mixed.height], fov, viewport, viewport, 1))
    work.wallLook.set(mixed.x, mixed.y - drop, 0)

    camera.position.copy(work.front).lerp(work.wall, w.wall)
    work.target.copy(work.frontLook).lerp(work.wallLook, w.wall)
    camera.lookAt(work.target)
    const distance = camera.position.distanceTo(work.target)
    camera.near = Math.max(CAMERA.near, distance * NEAR_FRACTION)
    camera.far = distance + CAMERA.far
    camera.updateMatrixWorld()
    // Na parede, a foto já vem composta: só o deslocamento para o lado
    camera.setViewOffset(viewport.width, viewport.height, viewport.width / 2 - centerX, (viewport.height / 2 - centerY) * (1 - w.wall), viewport.width, viewport.height)

    // Luz: na parede, a da janela da foto e a difusa no lugar do estúdio; o vidro quase não reflete
    if (keyLightRef.current) {
      keyLightRef.current.position.lerpVectors(KEY_POSITION, AMBIENT_LIGHT, w.wall)
      keyLightRef.current.intensity = KEY_LIGHT.intensity * lerp(1, ROOM_KEY, w.wall)
    }
    environmentBase.current ??= state.scene.environmentIntensity
    state.scene.environmentIntensity = environmentBase.current * lerp(1, ROOM_LIGHT.environment, w.wall)
    if (fill.current) fill.current.intensity = ROOM_LIGHT.fill * w.wall
    quadro.current?.traverse((object) => {
      const material = (object as Mesh).material as MeshStandardMaterial | undefined
      if (!material || Array.isArray(material) || material.blending !== AdditiveBlending) return
      material.userData.envBase ??= material.envMapIntensity
      material.envMapIntensity = (material.userData.envBase as number) * lerp(1, ROOM_GLASS, w.wall)
    })

    // Cotas da escala: a largura do conjunto e a altura das peças; o móvel (largura acima dele e altura ao lado)
    const root = annotationsRef.current
    const group = quadro.current
    if (root && group) {
      const halfW = W / 2
      const halfH = H / 2
      const toScreen = (vector: Vector3) => {
        vector.project(camera)
        return vector.set(((vector.x + 1) / 2) * viewport.width, ((1 - vector.y) / 2) * viewport.height, 0)
      }
      const project = (x: number, y: number) => toScreen(group.localToWorld(work.a.set(x, y, depthFront)))
      const projectB = (x: number, y: number) => toScreen(group.localToWorld(work.b.set(x, y, depthFront)))
      const onPhoto = (vector: Vector3, x: number, y: number) => toScreen(vector.set(x, ROOM.floorY + y - drop, ROOM.wallZ))
      const first = -(count - 1) / 2 * pitchX
      const last = (count - 1) / 2 * pitchX
      const show = w.far
      placeDim(root, 'w', project(first - halfW, halfH + DIM_GAP), projectB(last + halfW, halfH + DIM_GAP), [0, -16], show, `${cm(setWidth * 100)} cm`)
      placeDim(root, 'h', project(first - halfW - DIM_GAP, halfH), projectB(first - halfW - DIM_GAP, -halfH), [-26, 0], show, `${cm(H * 100)} cm`)
      const furniture = furnitureOf(room, narrow ? 'narrow' : 'wide')
      const lineY = furniture.height + FURNITURE_GAP.top
      const visible: [number, number] = [insets.left + 30, viewport.width - insets.right - 30]
      const screen0 = onPhoto(work.a, 0, lineY).x
      const perMeter = onPhoto(work.b, 1, lineY).x - screen0
      const screenX = (x: number) => screen0 + x * perMeter
      const wallX = (px: number) => (px - screen0) / (perMeter || 1)
      const leftSide = furniture.left - FURNITURE_GAP.side
      const rightSide = furniture.right + FURNITURE_GAP.side
      const [sideX, labelSide] = screenX(leftSide) >= visible[0] ? [leftSide, -30] : screenX(rightSide) <= visible[1] ? [rightSide, 30] : [wallX(visible[0]), 30]
      placeDim(root, 'fw', onPhoto(work.a, furniture.left, lineY), onPhoto(work.b, furniture.right, lineY), [0, -16], show, `${room.furniture} · ${roundCm(furniture.width)} cm`, [visible[0] + 70, visible[1] - 70])
      placeDim(root, 'fh', onPhoto(work.a, sideX, 0), onPhoto(work.b, sideX, furniture.height), [labelSide, 0], show, `${roundCm(furniture.height)} cm`)
    }

    if (moving) state.invalidate()
  })

  return (
    <>
      <group ref={quadro}>
        {models.map((piece, index) => (
          <group
            key={index}
            ref={(element) => {
              pieceRefs.current[index] = element
            }}
          >
            <Frame model={piece} />
          </group>
        ))}
      </group>
      <ambientLight ref={fill} intensity={0} color="#fff6ec" />
      {roomOn && (
        // Suspense próprio: a foto do ambiente baixa sem esconder o quadro
        <Suspense fallback={null}>
          <PhotoRoom key={(narrow ? room.narrow : room.wide).src} photo={narrow ? room.narrow : room.wide} group={roomGroup} materialsRef={roomMaterials} />
          <RoomLoaded onLoad={roomLoaded} />
        </Suspense>
      )}
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
    </>
  )
}

/** Avisa uma vez quando a foto do ambiente terminou de baixar */
function RoomLoaded({ onLoad }: { onLoad: () => void }) {
  useEffect(() => onLoad(), [onLoad])
  return null
}

/**
 * Ponteiro sobre o canvas, só na vista 3D. Mouse: a posição (−1 a 1) inclina o quadro; segurando o
 * botão, arrastar gira (sem limite na horizontal, até DRAG.pitch na vertical). Dedo: arrastar na
 * horizontal gira; na vertical a página rola (touch-action: pan-y). Saindo do 3D, o giro volta para
 * a volta inteira mais perto (o quadro fica de frente sem dar voltas para trás).
 */
function usePointer(mode: GaleriaMode) {
  const get = useThree((state) => state.get)
  const invalidate = useThree((state) => state.invalidate)
  const pointer = useRef({ x: 0, y: 0, spin: 0, pitch: 0, dragging: false, touched: false })
  const front = mode === 'frente'
  useEffect(() => {
    const element = get().gl.domElement
    const p = pointer.current
    if (!front) {
      p.spin = Math.round(p.spin / TURN) * TURN
      p.pitch = 0
      p.x = 0
      p.y = 0
      p.dragging = false
    }
    element.style.touchAction = 'pan-y'
    element.style.cursor = front ? 'grab' : ''
    invalidate()
  }, [front, get, invalidate])
  useEffect(() => {
    if (!front) return
    const element = get().gl.domElement
    let from: { x: number; y: number; id: number } | null = null
    const clamp = (value: number, limit = 1) => Math.max(-limit, Math.min(limit, value))
    const p = pointer.current
    const move = (event: PointerEvent) => {
      if (from && event.pointerId === from.id) {
        p.spin += (event.clientX - from.x) * DRAG.yawPerPx
        if (event.pointerType === 'mouse') p.pitch = clamp(p.pitch + (event.clientY - from.y) * DRAG.pitchPerPx, DRAG.pitch)
        from = { x: event.clientX, y: event.clientY, id: event.pointerId }
        invalidate()
      } else if (event.pointerType === 'mouse') {
        const box = element.getBoundingClientRect()
        p.x = clamp(((event.clientX - box.left) / box.width) * 2 - 1)
        p.y = clamp(((event.clientY - box.top) / box.height) * 2 - 1)
        p.touched = true
        invalidate()
      }
    }
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      from = { x: event.clientX, y: event.clientY, id: event.pointerId }
      p.dragging = true
      p.touched = true
      // O mouse começa o arrasto na inclinação em que estava: sem pulo
      if (event.pointerType === 'mouse') {
        p.pitch = p.y * TILT.pitch
        element.setPointerCapture?.(event.pointerId)
        element.style.cursor = 'grabbing'
      }
      invalidate()
    }
    const up = (event: PointerEvent) => {
      if (!from || event.pointerId !== from.id) return
      from = null
      p.dragging = false
      if (event.pointerType === 'mouse') element.style.cursor = 'grab'
      invalidate()
    }
    const leave = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || p.dragging) return
      p.x = 0
      p.y = 0
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
  }, [front, get, invalidate])
  return pointer
}

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

const cm = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: value < 10 ? 1 : 0 })

/** Medida do móvel (m) em cm: inteiro até 1 m, de 5 em 5 acima (a foto não dá mais precisão que isso) */
const roundCm = (meters: number) => (meters < 1 ? Math.round(meters * 100) : Math.round(meters * 20) * 5)

/**
 * Uma cota no HTML por cima do canvas: a linha de `a` até `b` (px) e a medida no meio, afastada
 * `offset` px da linha. Some com `opacity` 0. (A mesma da página imersiva.)
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
    line.style.display = length < 1 ? 'none' : ''
    line.style.width = `${length}px`
    line.style.transform = `translate(${a.x}px, ${a.y}px) rotate(${angle}rad)`
  }
  if (label) {
    if (text !== undefined && label.textContent !== text) label.textContent = text
    const middle = (a.x + b.x) / 2
    const x = labelRange ? Math.min(Math.max(middle, Math.max(labelRange[0], Math.min(a.x, b.x))), Math.min(labelRange[1], Math.max(a.x, b.x))) : middle
    label.style.transform = `translate(${x + offset[0]}px, ${(a.y + b.y) / 2 + offset[1]}px) translate(-50%, -50%)`
  }
}
