import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Vec3 } from './models/types'
import { calloutReveal, readExplode, type ExplodeValue } from './timeline'

interface PartMarkerProps {
  /** Número da parte na legenda (1 = a da frente) */
  number: number
  /** Quantas partes o modelo tem: define o ritmo em que os números aparecem */
  count: number
  position: Vec3
  explode: ExplodeValue
  /** Elemento HTML onde o número é desenhado */
  layer: HTMLElement
}

/**
 * Número ancorado na parte, que liga a peça ao item da legenda. É decorativo (aria-hidden):
 * o conteúdo acessível está na legenda.
 */
export function PartMarker({ number, count, position, explode, layer }: PartMarkerProps) {
  const badge = useRef<HTMLSpanElement>(null)
  const portal = useMemo(() => ({ current: layer }), [layer])

  useFrame(() => {
    if (badge.current) badge.current.style.opacity = String(calloutReveal(readExplode(explode), number - 1, count))
  })

  return (
    <Html position={position} portal={portal} center pointerEvents="none">
      <span
        ref={badge}
        aria-hidden
        className="flex size-6 items-center justify-center rounded-full bg-neutral-900 font-sans text-xs font-semibold text-white opacity-0 shadow-md ring-2 ring-white"
      >
        {number}
      </span>
    </Html>
  )
}
