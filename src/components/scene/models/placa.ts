import { mdfPart, printPart, type BoardSpec } from './board'
import type { ModelDef } from './types'

/** Placa MDF: só a arte em papel fotográfico colada na placa, sem moldura. */
export function placaModel(spec: BoardSpec): ModelDef {
  const { width: W, height: H, paper: p } = spec
  return {
    name: 'Placa MDF',
    art: { width: W, height: H },
    window: { width: W, height: H },
    outer: { width: W, height: H },
    // Da frente para trás
    parts: [
      printPart(spec, { explode: 0.08, marker: [-W / 2 + 0.04, H / 2 - 0.05, 0], receiveShadow: false }),
      mdfPart(spec, {
        description: 'A própria peça: a borda de MDF fica à vista, sem moldura.',
        explode: 0,
        marker: [W / 2 - 0.03, H * 0.2, -p],
        receiveShadow: false,
      }),
    ],
  }
}
