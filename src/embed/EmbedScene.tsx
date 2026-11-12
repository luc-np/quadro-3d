import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { NeutralToneMapping, Vector3, type Group, type Object3D } from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { easing } from 'maath'
import { Frame } from '@/components/scene/Frame'
import { EXPLODE_YAW, fitDistance, frameExtent } from '@/components/scene/layout'
import { configureModel, type ModelFinish } from '@/components/scene/models/configure'
import type { FrameColor } from '@/components/scene/models/surfaces'
import type { PartDef } from '@/components/scene/models/types'
import { BACK_LIGHT, CAMERA, GRAZING_LIGHT, KEY_LIGHT, SHADOW, StudioLight } from '@/components/scene/Studio'
import { FRAME_ORDER } from '@/components/scene/timeline'

/** O que a página de produto escolheu: o mesmo para todas as peças do kit */
export interface ViewerConfig {
  finish: ModelFinish
  glass: boolean
  color: FrameColor
  /** Largura e altura de cada peça como fica na parede (cm) */
  width: number
  height: number
  /** Uma arte por peça (URLs com CORS liberado); o número de artes é o número de peças */
  arts: string[]
  /** Vista "por dentro": as camadas separadas, com um "+" em cada parte */
  exploded?: boolean
}

/** Comandos que o tema chama de fora (botões de zoom e de voltar à vista inicial) */
export interface ViewerControls {
  zoom: (factor: number) => void
  reset: () => void
}

/** Vão entre as peças de um kit (m): o mesmo da página de produto */
const KIT_GAP = 0.04

/**
 * Folga do enquadramento: na galeria da loja o quadro ocupa ~90% da área (a landing deixa
 * ~75%, para caber a legenda). Com o giro inicial de ~17° ainda sobra margem para a lateral.
 */
const FIT_MARGIN = 1.1

/** Na vista "por dentro" a camada da frente chega perto da câmera: mais folga, como na landing */
const EXPLODED_FIT_MARGIN = 1.45

/** Zoom: perto até 35% da distância de enquadramento, longe até 180% */
const ZOOM_LIMITS = { min: 0.35, max: 1.8 }

/** Não deixa a câmera passar por cima ou por baixo do quadro: só girar em volta e inclinar um pouco */
const POLAR_LIMITS = { min: 0.18 * Math.PI, max: 0.82 * Math.PI }

/** Folga da câmera de sombra em volta do conjunto (m) */
const SHADOW_MARGIN = 0.1

/** Tempo (s) da animação entre montado e "por dentro" (camadas, giro, peças do kit e câmera) */
const MODE_TIME = 0.45

/** Os "+" aparecem no fim da separação, entre estes progressos */
const HOTSPOT_REVEAL = { from: 0.7, to: 1 }

/** Ao abrir o "+" de uma parte, a câmera chega a esta fração da distância da vista geral */
const FOCUS_DISTANCE = 0.45

/** Pontos de cada parte (o "+") no mundo, por id: a câmera mira neles ao abrir a explicação */
type Anchors = Map<string, Object3D>

const CAMERA_DIRECTION = new Vector3(...CAMERA.position).normalize()
/** Ângulo vertical da vista inicial: no modo "só horizontal" a câmera fica presa nele */
const OVERVIEW_POLAR = Math.acos(CAMERA_DIRECTION.y)

/**
 * Passo máximo (s) das animações por frame. A cena só desenha quando algo muda: o primeiro
 * frame depois de um tempo parada chega com o intervalo inteiro e a animação pularia direto
 * para o fim.
 */
const MAX_STEP = 1 / 30

interface EmbedSceneProps {
  config: ViewerConfig
  background: string
  controlsRef: RefObject<ViewerControls | null>
  onReady?: () => void
  /** Só gira na horizontal; o arrasto vertical rola a página (ver MountOptions) */
  horizontalOnly?: boolean
}

/**
 * Cena do visualizador da loja: o conjunto montado, para girar, ou a vista "por dentro" de
 * uma peça, com as camadas separadas e a explicação de cada parte.
 */
export function EmbedScene({ config, background, controlsRef, onReady, horizontalOnly = false }: EmbedSceneProps) {
  const { finish, glass, color, width, height, arts } = config
  const exploded = Boolean(config.exploded)
  const artKey = arts.join('|')
  const pieces = useMemo(() => {
    const list = artKey ? artKey.split('|') : [undefined]
    return list.map((art) => configureModel({ finish, glass, color, width: width / 100, height: height / 100, art }))
  }, [finish, glass, color, width, height, artKey])

  // Só um "+" aberto por vez; fecha ao trocar de modo, de configuração ou ao clicar fora
  const [openPart, setOpenPart] = useState<string | null>(null)
  const [lastScene, setLastScene] = useState({ exploded, pieces })
  if (lastScene.exploded !== exploded || lastScene.pieces !== pieces) {
    setLastScene({ exploded, pieces })
    setOpenPart(null)
  }
  const anchors = useRef<Anchors>(new Map())

  const outer = pieces[0].outer
  const assembledWidth = pieces.length * outer.width + (pieces.length - 1) * KIT_GAP
  const explodedExtent = frameExtent(pieces[0], 1, 1, EXPLODE_YAW)
  const shadowExtent = Math.max(SHADOW.extent, Math.max(assembledWidth, outer.height) / 2 + SHADOW_MARGIN)

  return (
    <Canvas
      frameloop="demand"
      shadows="percentage"
      gl={{ toneMapping: NeutralToneMapping }}
      dpr={[1, 2]}
      camera={CAMERA}
      onPointerMissed={() => setOpenPart(null)}
    >
      <color attach="background" args={[background]} />
      <directionalLight
        {...KEY_LIGHT}
        castShadow
        shadow-mapSize={[SHADOW.mapSize, SHADOW.mapSize]}
        shadow-bias={SHADOW.bias}
        shadow-normalBias={SHADOW.normalBias}
      >
        <orthographicCamera
          key={shadowExtent}
          attach="shadow-camera"
          args={[-shadowExtent, shadowExtent, shadowExtent, -shadowExtent, SHADOW.near, SHADOW.far]}
        />
      </directionalLight>
      <directionalLight {...GRAZING_LIGHT} />
      <directionalLight {...BACK_LIGHT} />

      <Suspense fallback={null}>
        <StudioLight />
        <Assembly
          pieces={pieces}
          exploded={exploded}
          openPart={openPart}
          onSelectPart={setOpenPart}
          anchors={anchors}
        />
        <Ready onReady={onReady} />
      </Suspense>

      <Rig
        assembled={[assembledWidth, outer.height]}
        explodedExtent={explodedExtent}
        exploded={exploded}
        focusPart={exploded ? openPart : null}
        anchors={anchors}
        onReset={() => setOpenPart(null)}
        controlsRef={controlsRef}
        horizontalOnly={horizontalOnly}
      />
    </Canvas>
  )
}

interface AssemblyProps {
  pieces: ReturnType<typeof configureModel>[]
  exploded: boolean
  openPart: string | null
  /** Abre a explicação de uma parte (null fecha) */
  onSelectPart: (id: string | null) => void
  anchors: RefObject<Anchors>
}

/** Peça do kit que abre na vista "por dentro": a do meio (no duo, a primeira) */
function openedPiece(count: number): number {
  return Math.floor((count - 1) / 2)
}

/**
 * As peças lado a lado (kit) e a animação para "por dentro": as camadas de uma peça se separam
 * e ela inclina; as outras saem pelas laterais, a da esquerda para a esquerda e a da direita
 * para a direita, e voltam do mesmo jeito (a construção é a mesma, e três peças abertas se
 * sobreporiam). Tudo derivado de `exploded`, suavizado a cada frame.
 */
function Assembly({ pieces, exploded, openPart, onSelectPart, anchors }: AssemblyProps) {
  const pieceGroups = useRef<(Group | null)[]>([])
  const explode = useRef(0)
  const invalidate = useThree((state) => state.invalidate)
  const step = pieces[0].outer.width + KIT_GAP
  const opened = openedPiece(pieces.length)
  // Para fora da tela: com a câmera enquadrando uma peça só, isto passa da borda com folga
  const offscreen = (pieces.length + 1) * step
  const assembledX = (index: number) => (index - (pieces.length - 1) / 2) * step

  useFrame((_, frameDelta) => {
    const delta = Math.min(frameDelta, MAX_STEP)
    let moving = easing.damp(explode, 'current', exploded ? 1 : 0, MODE_TIME, delta)
    pieceGroups.current.forEach((piece, index) => {
      if (!piece) return
      const side = Math.sign(index - opened)
      const target = exploded ? (side === 0 ? 0 : assembledX(index) + side * offscreen) : assembledX(index)
      moving = easing.damp(piece.position, 'x', target, MODE_TIME, delta) || moving
      // Só a peça que abre inclina: girar o conjunto traria a peça da direita para a frente da câmera
      piece.rotation.y = index === opened ? EXPLODE_YAW * explode.current : 0
    })
    if (moving) invalidate()
  }, FRAME_ORDER.scroll)

  return (
    <group>
      {pieces.map((model, index) => (
        <group
          key={index}
          ref={(element) => {
            pieceGroups.current[index] = element
          }}
          position={[assembledX(index), 0, 0]}
        >
          <Frame
            model={model}
            // As peças que saem continuam montadas
            explode={index === opened ? explode : 0}
            renderMarker={
              index === opened
                ? (part, partIndex) => {
                    // As setas do balão percorrem as partes da frente para trás, em volta
                    const at = (offset: number) => model.parts[(partIndex + offset + model.parts.length) % model.parts.length].id
                    return (
                      <Hotspot
                        part={part}
                        position={partIndex + 1}
                        count={model.parts.length}
                        explode={explode}
                        open={openPart === part.id}
                        onToggle={() => onSelectPart(openPart === part.id ? null : part.id)}
                        onPrevious={() => onSelectPart(at(-1))}
                        onNext={() => onSelectPart(at(1))}
                        anchors={anchors}
                      />
                    )
                  }
                : undefined
            }
          />
        </group>
      ))}
    </group>
  )
}

interface HotspotProps {
  part: PartDef
  /** Posição da parte na lista (1 = a da frente) e total, para "2 de 7" */
  position: number
  count: number
  explode: { readonly current: number }
  open: boolean
  onToggle: () => void
  onPrevious: () => void
  onNext: () => void
  anchors: RefObject<Anchors>
}

/**
 * O "+" de uma parte e o balão com o nome e a explicação. HTML de verdade (botão com
 * aria-expanded), por cima do canvas; o visual vem do tema (classes gq3d-hotspot*, lado do
 * balão em data-side). Some com o quadro montado.
 */
function Hotspot({ part, position, count, explode, open, onToggle, onPrevious, onNext, anchors }: HotspotProps) {
  const element = useRef<HTMLDivElement>(null)
  const canvas = useThree((state) => state.gl.domElement)
  const invalidate = useThree((state) => state.invalidate)
  useFrame(() => {
    const { from, to } = HOTSPOT_REVEAL
    const reveal = Math.min(1, Math.max(0, (explode.current - from) / (to - from)))
    const node = element.current
    if (!node) return
    node.style.opacity = String(reveal)
    node.style.pointerEvents = reveal > 0.5 ? 'auto' : 'none'
    // O balão abre para o lado com mais espaço: botão na metade esquerda da área, balão à direita
    if (open) {
      const button = node.getBoundingClientRect()
      const area = canvas.getBoundingClientRect()
      node.dataset.side = button.left + button.width / 2 - area.left < area.width / 2 ? 'right' : 'left'
    }
  })

  // Cada botão do balão pede um frame: a câmera e o lado do balão são decididos nele
  const press = (action: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    action()
    invalidate()
  }

  return (
    <group
      position={part.marker}
      ref={(anchor) => {
        if (anchor) anchors.current.set(part.id, anchor)
        else anchors.current.delete(part.id)
      }}
    >
    <Html center zIndexRange={[30, 10]}>
      {/* data-side fica fora do React (o frame decide o lado); sem ele, o balão abre à direita */}
      <div
        // O Html do drei desenha isto num React próprio, às vezes depois do último frame da
        // animação: ao entrar na página, pede um frame para a visibilidade ser aplicada.
        ref={(node) => {
          element.current = node
          if (node) invalidate()
        }}
        className="gq3d-hotspot"
        data-open={open ? '' : undefined}
        style={{ opacity: 0 }}
      >
        <button
          type="button"
          className="gq3d-hotspot__btn"
          aria-expanded={open}
          aria-label={`${part.label}: ${open ? 'fechar' : 'ver'} explicação`}
          onClick={press(onToggle)}
        >
          +
        </button>
        {open && (
          <div className="gq3d-hotspot__tip" role="note">
            <b>{part.label}</b>
            <span>{part.description}</span>
            {count > 1 && (
              <span className="gq3d-hotspot__nav">
                <button type="button" aria-label="Parte anterior" onClick={press(onPrevious)}>
                  ‹
                </button>
                <span>
                  {position} de {count}
                </span>
                <button type="button" aria-label="Próxima parte" onClick={press(onNext)}>
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

/** Avisa quem montou a cena quando o conteúdo (texturas e luz) terminou de carregar */
function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => onReady?.(), [onReady])
  return null
}

interface RigProps {
  /** Largura e altura do conjunto montado (m) */
  assembled: [number, number]
  /** Largura e altura que a peça ocupa separada e inclinada (m) */
  explodedExtent: [number, number]
  exploded: boolean
  /** Parte com a explicação aberta (vista "por dentro"): a câmera chega perto dela */
  focusPart: string | null
  anchors: RefObject<Anchors>
  /** O botão de voltar à vista inicial também fecha a explicação aberta */
  onReset: () => void
  horizontalOnly: boolean
  controlsRef: RefObject<ViewerControls | null>
}

/** Para onde a câmera vai: posição e ponto que ela mira (o centro do giro e do zoom) */
interface Flight {
  position: Vector3
  target: Vector3
  /** Mirando uma parte: a posição é recalculada a cada frame (a parte ainda pode estar se movendo) */
  anchor?: Object3D
}

const ORIGIN = new Vector3()

/**
 * Câmera e controles. O enquadramento cabe o conjunto na tela e muda com o tamanho escolhido;
 * a direção de onde a pessoa olha é mantida (trocar a moldura não desfaz o giro). Ao trocar
 * entre montado e "por dentro", a câmera volta ao ângulo inicial, que é o que mostra as camadas.
 * Por dentro não gira (só aproxima); abrir o "+" de uma parte leva a câmera até ela.
 */
function Rig({ assembled, explodedExtent, exploded, focusPart, anchors, onReset, controlsRef, horizontalOnly }: RigProps) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const orbit = useThree((state) => state.controls) as OrbitControlsImpl | null
  const extent = exploded ? explodedExtent : assembled
  const margin = exploded ? EXPLODED_FIT_MARGIN : FIT_MARGIN
  const distance = size.width && size.height ? fitDistance(extent, CAMERA.fov, size, size, margin) : 1

  // Animação da câmera em curso; null = parada (a pessoa está no controle)
  const flight = useRef<Flight | null>(null)
  const lastMode = useRef(exploded)
  const overview = useCallback(
    (): Flight => ({ position: CAMERA_DIRECTION.clone().multiplyScalar(distance), target: ORIGIN.clone() }),
    [distance],
  )

  useLayoutEffect(() => {
    if (lastMode.current !== exploded) {
      lastMode.current = exploded
      flight.current = overview()
    } else if (!flight.current) {
      // Mudou só o tamanho: mesma direção de onde a pessoa olha, na nova distância
      const target = orbit?.target ?? ORIGIN
      const offset = camera.position.clone().sub(target)
      const direction = offset.lengthSq() > 0 ? offset.normalize() : CAMERA_DIRECTION.clone()
      camera.position.copy(target).addScaledVector(direction, distance)
      orbit?.update()
    } else if (!flight.current.anchor) {
      flight.current = overview()
    }
    invalidate()
  }, [camera, distance, exploded, orbit, overview, invalidate])

  // Abrir o "+" de uma parte leva a câmera até ela; fechar devolve a vista geral
  const lastFocus = useRef<string | null>(null)
  useEffect(() => {
    if (focusPart === lastFocus.current) return
    lastFocus.current = focusPart
    const anchor = focusPart ? anchors.current.get(focusPart) : undefined
    if (anchor) flight.current = { position: new Vector3(), target: new Vector3(), anchor }
    else if (exploded) flight.current = overview()
    invalidate()
  }, [focusPart, anchors, exploded, overview, invalidate])

  // Só horizontal: o navegador cuida do arrasto vertical (rola a página) e o 3D recebe só o
  // horizontal. O OrbitControls põe touch-action: none ao conectar; aqui volta para pan-y.
  useEffect(() => {
    if (!orbit || !horizontalOnly) return
    const element = orbit.domElement
    if (element) element.style.touchAction = 'pan-y'
  }, [orbit, horizontalOnly])

  // Se a pessoa começar a arrastar durante a animação, ela manda
  useEffect(() => {
    if (!orbit) return
    const stop = () => {
      flight.current = null
    }
    orbit.addEventListener('start', stop)
    return () => orbit.removeEventListener('start', stop)
  }, [orbit])

  useFrame((_, frameDelta) => {
    const delta = Math.min(frameDelta, MAX_STEP)
    const current = flight.current
    if (!current) return
    if (current.anchor) {
      current.anchor.getWorldPosition(current.target)
      current.position.copy(current.target).addScaledVector(CAMERA_DIRECTION, distance * FOCUS_DISTANCE)
    }
    let moving = easing.damp3(camera.position, current.position, MODE_TIME, delta)
    if (orbit) moving = easing.damp3(orbit.target, current.target, MODE_TIME, delta) || moving
    orbit?.update()
    if (moving) invalidate()
    else flight.current = null
  }, FRAME_ORDER.scroll)

  // Zoom pelos botões: aproxima do ponto que a câmera mira (a parte aberta, ou o centro)
  const zoom = useCallback(
    (factor: number) => {
      flight.current = null
      const target = orbit?.target ?? ORIGIN
      const offset = camera.position.clone().sub(target)
      const length = Math.min(distance * ZOOM_LIMITS.max, Math.max(distance * ZOOM_LIMITS.min, offset.length() * factor))
      camera.position.copy(target).add(offset.setLength(length))
      orbit?.update()
      invalidate()
    },
    [camera, distance, orbit, invalidate],
  )

  useEffect(() => {
    controlsRef.current = {
      zoom,
      reset() {
        flight.current = overview()
        onReset()
        invalidate()
      },
    }
  }, [controlsRef, zoom, overview, onReset, invalidate])

  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      // Por dentro, as camadas ficam no ângulo que as mostra: sem girar, só aproximar
      enableRotate={!exploded}
      // Rolagem (e pinça no celular) dentro da área aproxima; fora dela, a página rola normal
      enableZoom
      minDistance={distance * ZOOM_LIMITS.min}
      maxDistance={distance * ZOOM_LIMITS.max}
      minPolarAngle={horizontalOnly ? OVERVIEW_POLAR : POLAR_LIMITS.min}
      maxPolarAngle={horizontalOnly ? OVERVIEW_POLAR : POLAR_LIMITS.max}
    />
  )
}
