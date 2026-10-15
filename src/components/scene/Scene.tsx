'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { Vector3, type Group, type PerspectiveCamera } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { ScrollControls, useScroll } from '@react-three/drei'
import { easing } from 'maath'
import { Frame } from './Frame'
import { EXPLODE_SCALE, EXPLODE_YAW, fitDistance, frameExtent, REDUCED_MOTION_QUERY, WIDE_QUERY } from './layout'
import type { ModelDef, Size2 } from './models/types'
import { PartsLegend } from './PartsLegend'
import { CAMERA, Studio } from './Studio'
import { calloutReveal, FRAME_ORDER, SCROLL_PAGES, TIMELINE } from './timeline'
import { useMediaQuery } from './useMediaQuery'

const DEG = Math.PI / 180

/**
 * Pico da virada, no meio do trecho `rotate`: a lateral direita (madeira) aparece
 * e a luz principal fica rasante na tela, revelando a trama.
 */
const TURN_YAW = -50 * DEG

/** Tempo (s) para o quadro alcançar o scroll. É a única suavização: o ScrollControls usa damping 0. */
const SMOOTH_TIME = 0.25

/** Quanto (px) cada item da legenda sobe enquanto aparece */
const LEGEND_RISE = 12

const CAMERA_DIRECTION = new Vector3(...CAMERA.position).normalize()

/** Cena da landing: o quadro reage ao scroll e, separado, cada parte ganha sua explicação. */
export default function Scene({ model }: { model: ModelDef }) {
  const legend = useRef<HTMLOListElement>(null)
  const wide = useMediaQuery(WIDE_QUERY)
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)

  return (
    <div className="relative h-full w-full">
      <Studio>
        <ScrollControls pages={SCROLL_PAGES} damping={0}>
          <ScrollFrame model={model} legend={legend} wide={wide} reducedMotion={reducedMotion} />
        </ScrollControls>
      </Studio>
      {/* Por cima do canvas, sem capturar o ponteiro: o scroll continua indo para o ScrollControls.
          Estreito: embaixo, ocupando a largura. Largo (md): coluna à esquerda. */}
      <PartsLegend
        parts={model.parts}
        ref={legend}
        className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-6 md:inset-x-auto md:top-1/2 md:bottom-auto md:left-0 md:w-[min(21rem,30vw)] md:-translate-y-1/2 md:pr-0 md:pb-0 md:pl-[max(1.5rem,5vw)]"
      />
    </div>
  )
}

interface ScrollFrameProps {
  model: ModelDef
  legend: RefObject<HTMLOListElement | null>
  /** Layout largo: legenda à esquerda e separação completa */
  wide: boolean
  /** prefers-reduced-motion: sem animação, só os estados montado e separado */
  reducedMotion: boolean
}

/**
 * O quadro dirigido pelo scroll. Os alvos vêm só do offset (rolar para cima desfaz);
 * o damp apenas suaviza o caminho até eles. Nada passa pelo estado do React:
 * cena, câmera e legenda são atualizadas direto, a cada frame, e só enquanto algo se move.
 */
function ScrollFrame({ model, legend, wide, reducedMotion }: ScrollFrameProps) {
  const group = useRef<Group>(null)
  const explode = useRef(0)
  const legendSize = useRef<Size2>({ width: 0, height: 0 })
  const scroll = useScroll()
  const invalidate = useThree((state) => state.invalidate)
  const explodeScale = wide ? EXPLODE_SCALE.wide : EXPLODE_SCALE.narrow

  // A área da legenda (muda com o layout e com o texto) é a que o quadro precisa liberar
  useEffect(() => {
    const element = legend.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const [box] = entry.borderBoxSize
      legendSize.current = { width: box.inlineSize, height: box.blockSize }
      invalidate()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [legend, invalidate])

  useFrame((state, delta) => {
    if (!group.current) return

    const smoothTime = reducedMotion ? 0 : SMOOTH_TIME
    const turn = reducedMotion ? 0 : scroll.curve(...TIMELINE.rotate)
    const range = scroll.range(...TIMELINE.explode)
    // Com movimento reduzido, dois estados fixos: montado até a metade do trecho, separado depois
    const spread = reducedMotion ? Math.round(range) : range

    const turning = easing.dampE(group.current.rotation, [0, TURN_YAW * turn + EXPLODE_YAW * spread, 0], smoothTime, delta)
    const spreading = easing.damp(explode, 'current', spread, smoothTime, delta)
    if (turning || spreading) invalidate()

    const progress = explode.current
    frameCamera(state.camera, model, state.size, legendSize.current, progress, explodeScale, wide)

    const items = legend.current?.querySelectorAll(':scope > li') ?? []
    items.forEach((item, index) => {
      if (!(item instanceof HTMLElement)) return
      const reveal = calloutReveal(progress, index, items.length)
      item.style.opacity = String(reveal)
      item.style.transform = `translateY(${(1 - reveal) * LEGEND_RISE}px)`
    })
  }, FRAME_ORDER.scroll)

  return (
    <>
      <group ref={group}>
        {/* Os números ficam na camada fixa do ScrollControls; no container que rola, subiriam com o scroll */}
        <Frame model={model} explode={explode} explodeScale={explodeScale} markerLayer={scroll.fixed} />
      </group>
    </>
  )
}

/**
 * Enquadra o quadro na área que a legenda deixa livre. Conforme as camadas se separam,
 * a legenda entra (à esquerda ou embaixo): a câmera recua para caber o quadro aberto e
 * o centro da imagem desliza para o meio da área livre.
 */
function frameCamera(
  camera: Pick<PerspectiveCamera, 'position' | 'setViewOffset'>,
  model: ModelDef,
  viewport: Size2,
  legendSize: Size2,
  progress: number,
  explodeScale: number,
  wide: boolean,
) {
  const legendWidth = wide ? legendSize.width * progress : 0
  const legendHeight = wide ? 0 : legendSize.height * progress
  const free = { width: viewport.width - legendWidth, height: viewport.height - legendHeight }

  const extent = frameExtent(model, progress, explodeScale, EXPLODE_YAW)
  camera.position.copy(CAMERA_DIRECTION).multiplyScalar(fitDistance(extent, CAMERA.fov, viewport, free))
  // Desloca a imagem: para a direita da legenda (largo) ou para cima dela (estreito)
  camera.setViewOffset(viewport.width, viewport.height, -legendWidth / 2, legendHeight / 2, viewport.width, viewport.height)
}
