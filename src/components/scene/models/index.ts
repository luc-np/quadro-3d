import { CANVAS_SPEC, canvasModel } from './canvas'
import { framedModel } from './framed'
import { placaModel } from './placa'
import { BOARD, CAIXA, FILETE, GLASS_THICKNESS } from './presets'
import type { ModelDef } from './types'

/** 40 × 60 cm: a proporção da arte (2:3) */
const SIZE = { width: 0.4, height: 0.6 }

/** Cada id vira as rotas /<id> (landing com scroll) e /<id>/360 (visualização livre) */
export const MODEL_IDS = ['canvas', 'caixa', 'caixa-vidro', 'filete', 'filete-vidro', 'placa-mdf'] as const
export type ModelId = (typeof MODEL_IDS)[number]

export const MODELS: Record<ModelId, ModelDef> = {
  canvas: canvasModel({ ...CANVAS_SPEC, ...SIZE }),
  caixa: framedModel({ ...CAIXA, ...SIZE, ...BOARD }),
  'caixa-vidro': framedModel({ ...CAIXA, ...SIZE, ...BOARD, glass: GLASS_THICKNESS }),
  filete: framedModel({ ...FILETE, ...SIZE, ...BOARD }),
  'filete-vidro': framedModel({ ...FILETE, ...SIZE, ...BOARD, glass: GLASS_THICKNESS }),
  'placa-mdf': placaModel({ ...SIZE, ...BOARD }),
}

export function isModelId(value: string): value is ModelId {
  return MODEL_IDS.some((id) => id === value)
}
