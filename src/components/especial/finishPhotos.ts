import type { Finish } from '@/components/scene/models/configure'
import type { FrameColor } from '@/components/scene/models/surfaces'

/**
 * Fotos de perto de cada acabamento, por cor: as mesmas das amostras de cor da página de
 * produto atual do tema (assets/gq-pdp.js, FINISH_PHOTOS), na CDN da Vuzi.
 */
const BASE = 'https://cdn.02.vuzi.com.br/goquadros/pdp-mkp/molduras-close/'
const PLACA = 'https://cdn.02.vuzi.com.br/goquadros/pdp-mkp/placa-mdf-detalhe-v1.webp'
const FILE: Partial<Record<Finish, Partial<Record<FrameColor, string>>>> = {
  caixa: { branca: 'caixa-branca-v2.webp' },
}

/** Foto da moldura `finish` na cor `color` (sem moldura: a da placa) */
export function finishPhoto(finish: Finish, color: FrameColor): string {
  if (finish === 'placa') return PLACA
  return BASE + (FILE[finish]?.[color] ?? `${finish}-${color}.webp`)
}

/** Medidas de cada acabamento, como na página de produto atual */
export const FINISH_SPEC: Record<Finish, string> = {
  placa: 'a placa vai direto na parede',
  filete: '0,8 cm frontal · 2 cm de profund.',
  caixa: '2 cm frontal · 3 cm de profund.',
  canvas: '1 cm frontal · 3,8 cm · esconde caixa de energia',
}

/** Ordem dos acabamentos na página de produto atual: do preço base para cima */
export const FINISH_RICH_ORDER: Finish[] = ['placa', 'filete', 'caixa', 'canvas']
