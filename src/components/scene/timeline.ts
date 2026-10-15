/** Trecho do scroll: [início, duração], em frações do scroll total (0–1) */
export type Segment = readonly [from: number, distance: number]

/**
 * Roteiro do scroll da landing, lido com scroll.range() / scroll.curve() do drei.
 * Tudo é derivado do offset atual: rolar para cima desfaz a animação, sem estado extra.
 */
export const TIMELINE = {
  /** O quadro vira até mostrar a lateral e volta de frente */
  rotate: [0, 0.4],
  /** As camadas se separam em z e o grupo inclina para dar perspectiva */
  explode: [0.5, 0.4],
} as const satisfies Record<string, Segment>

/** Altura total do scroll, em telas */
export const SCROLL_PAGES = 3

/**
 * Ordem dos useFrame dentro de um frame (menor roda antes; negativo não desliga o render
 * automático do R3F). Quem decide os alvos vem antes de quem os aplica, e o HTML ancorado
 * (drei <Html>, prioridade 0) por último, já com tudo no lugar. Sem isso, um salto
 * instantâneo (movimento reduzido) deixaria os números congelados um frame atrás.
 */
export const FRAME_ORDER = { scroll: -2, parts: -1 }

/**
 * Progresso do explode: 0 = montado, 1 = separado. Um número fixo, ou um ref
 * atualizado a cada frame (ex.: pelo scroll) sem re-renderizar o React.
 */
export type ExplodeValue = number | { readonly current: number }

export function readExplode(value: ExplodeValue): number {
  return typeof value === 'number' ? value : value.current
}

/**
 * Explicações das partes: surgem na segunda metade do explode, uma de cada vez, da frente
 * para trás; a última termina de aparecer junto com o fim do explode, qualquer que seja o
 * número de partes. Valores em progresso do explode (0–1), não do scroll.
 */
const CALLOUT_REVEAL = { start: 0.5, fade: 0.2 }

/** Visibilidade (0–1) da explicação da parte `index` (de `count`) para um progresso de explode */
export function calloutReveal(explode: number, index: number, count: number): number {
  const { start, fade } = CALLOUT_REVEAL
  const stagger = count > 1 ? (1 - fade - start) / (count - 1) : 0
  const from = start + index * stagger
  return Math.min(1, Math.max(0, (explode - from) / fade))
}
