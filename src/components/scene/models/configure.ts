import { CANVAS_SPEC, canvasModel } from './canvas'
import { framedModel } from './framed'
import { placaModel } from './placa'
import { BOARD, CAIXA, FILETE, GLASS_THICKNESS } from './presets'
import { FRAME_FINISHES, type FrameColor } from './surfaces'
import type { ModelDef } from './types'

/** Acabamentos vendidos na loja (as chaves da página de produto; placa = sem moldura) */
export const FINISHES = ['canvas', 'filete', 'caixa', 'placa'] as const
export type Finish = (typeof FINISHES)[number]

/** Uma peça como o cliente montou na página de produto */
export interface Configuration {
  finish: Finish
  /** Só filete e caixa levam vidro; nos outros é ignorado */
  glass: boolean
  /** Cor da moldura; a placa não tem moldura e ignora */
  color: FrameColor
  /** Largura e altura da arte como fica na parede (m) */
  width: number
  height: number
  /** Arte impressa (URL) */
  art?: string
}

/** O modelo 3D da peça configurada: mesmas regras de produção dos modelos fixos, nas medidas pedidas */
export function configureModel({ finish, glass, color, width, height, art }: Configuration): ModelDef {
  const frameSurface = FRAME_FINISHES[color]
  switch (finish) {
    case 'canvas':
      return canvasModel({ ...CANVAS_SPEC, width, height, art, frameSurface })
    case 'placa':
      return placaModel({ ...BOARD, width, height, art })
    case 'filete':
    case 'caixa':
      return framedModel({
        ...(finish === 'filete' ? FILETE : CAIXA),
        ...BOARD,
        width,
        height,
        art,
        frameSurface,
        glass: glass ? GLASS_THICKNESS : 0,
      })
  }
}
