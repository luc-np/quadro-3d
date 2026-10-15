import Image from 'next/image'
import { ARTWORK } from './models/surfaces'
import type { ModelDef } from './models/types'
import { PartsLegend } from './PartsLegend'
import { SCENE_BACKGROUND } from './theme'

/** Cor da moldura na versão estática (o tom médio da madeira escura) */
const FRAME_COLOR = '#2b2724'

/** Sem WebGL, ou se a cena falhar: a arte no contorno do modelo e as explicações, estáticas. */
export function StaticFrame({ model }: { model: ModelDef }) {
  const { outer, window: visible } = model
  // Recuo da área visível da arte dentro do contorno, em % (horizontal da largura, vertical da altura)
  const insetX = ((outer.width - visible.width) / 2 / outer.width) * 100
  const insetY = ((outer.height - visible.height) / 2 / outer.height) * 100

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-8 overflow-auto p-6 md:flex-row md:gap-16"
      style={{ background: SCENE_BACKGROUND }}
    >
      <div
        className="relative h-[55dvh] shrink-0 shadow-xl md:h-[80dvh]"
        style={{ aspectRatio: `${outer.width} / ${outer.height}`, background: FRAME_COLOR }}
      >
        <div className="absolute" style={{ inset: `${insetY}% ${insetX}%` }}>
          <Image
            src={ARTWORK.src}
            alt={ARTWORK.alt}
            fill
            sizes="(min-width: 48rem) 50vw, 90vw"
            priority
            className="object-cover"
          />
        </div>
      </div>
      <PartsLegend parts={model.parts} revealed className="max-w-sm" />
    </div>
  )
}
