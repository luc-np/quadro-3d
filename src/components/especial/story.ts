/** Altura total da página, em telas */
export const STORY_PAGES = 14.5

/** Telas de rolagem (a primeira tela não rola) */
const SCROLL = STORY_PAGES - 1

/** Trecho [início, duração] medido em telas de rolagem, em fração do scroll total */
const at = (start: number, length: number) => [start / SCROLL, length / SCROLL] as const

/**
 * Roteiro da página especial (/especial), em frações do scroll total (0–1).
 * Cada trecho é [início, duração]; tudo é derivado do offset atual: rolar para cima desfaz.
 */
export const STORY = {
  /**
   * Resposta imediata à rolagem, com as escolhas à mostra: o quadro vira devagar quase de frente
   * e chega um pouco mais perto (as linhas acompanham as partes)
   */
  heroTurn: at(0, 0.45),
  /**
   * As escolhas e suas linhas: ficam à mostra no começo da rolagem (dá para descer um pouco e ver
   * a bandeja inteira no celular) e depois somem
   */
  heroOut: at(0.3, 0.35),
  /** Sem as escolhas na tela, o quadro dá uma volta e termina de frente */
  spin: at(0.55, 0.71),
  /** A sala sobe do chão, a câmera recua e o quadro é pendurado na parede */
  roomIn: at(1.26, 0.84),
  /** As frases sobre o ambiente, uma depois da outra */
  phrases: at(2.1, 1.96),
  /** O quadro sai da parede e a sala sobe sumindo */
  roomOut: at(4.2, 0.7),
  /** As camadas se separam; no fim, os "+" de cada parte */
  explode: at(4.9, 0.98),
  /** O título "Por dentro do quadro" */
  explodeHint: at(5.3, 0.4),
  /** A explicação de cada parte, com linha até ela, uma depois da outra (da frente para o fundo) */
  parts: at(5.6, 1.7),
  /** As camadas voltam ao lugar */
  assemble: at(7.6, 0.6),
  /** As 4 cantoneiras de canto encaixam nas pontas */
  corners: at(8.2, 0.8),
  /** Com vidro, as 4 cantoneiras laterais (o quadro fica com 8) */
  edges: at(9.0, 0.7),
  /** A caixa de MDF aparece atrás e o quadro sai um pouco para a frente */
  box: at(9.7, 0.6),
  /** O quadro entra na caixa */
  insert: at(10.3, 0.6),
  /** O tampo com o adesivo fecha a caixa */
  lid: at(10.9, 0.7),
  /** A caixa abre (depois de uma tela inteira fechada, com o adesivo): o tampo sai, o quadro sai
   *  para a frente, as cantoneiras soltam e a caixa desce */
  unbox: at(12.4, 0.8),
  /** O quadro vira a foto do produto: de frente, à esquerda (no celular, em cima), para a compra */
  showcase: at(13.0, 0.5),
} as const satisfies Record<string, readonly [number, number]>

/** Progresso linear (0–1) de `offset` dentro do trecho */
export function progress(offset: number, [from, distance]: readonly [number, number]): number {
  return Math.min(1, Math.max(0, (offset - from) / distance))
}

/** Suaviza começo e fim de um progresso 0–1 */
export function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Interpola de a até b */
export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Frases do ambiente: aparecem e saem em sequência dentro de STORY.phrases */
export const PHRASES = [
  { title: 'Melhore seu ambiente.', text: 'Um quadro muda a parede, a luz e o jeito de viver o espaço.' },
  { title: 'Na medida da sua parede.', text: 'Do 30×45 ao 100×150, com a moldura que conversa com a sua casa.' },
  { title: 'Feito no nosso ateliê.', text: 'Impressão própria, montagem à mão e envio em 48 horas úteis.' },
] as const

/** Visibilidade (0–1) da frase `index`: cada uma ocupa uma fatia do trecho, com entrada e saída suaves */
export function phraseReveal(offset: number, index: number): number {
  const t = progress(offset, STORY.phrases) * PHRASES.length - index
  if (t <= 0 || t >= 1) return 0
  const fade = 0.25
  return smooth(Math.min(1, t / fade, (1 - t) / fade))
}

/** Visibilidade (0–1) da explicação da parte `index` de `count`: entram uma depois da outra em STORY.parts */
export function partReveal(offset: number, index: number, count: number): number {
  const t = progress(offset, STORY.parts) * count - index
  return smooth(Math.min(1, Math.max(0, t / 0.6)))
}

export type PackStep = 'corners' | 'edges' | 'box' | 'lid'

/** As etapas da embalagem explicadas com linhas, cada uma ligada à peça que entra nela */
export const PACK_STEPS: { key: PackStep; title: string; text: string; glassOnly?: boolean }[] = [
  { key: 'corners', title: 'Cantoneiras de canto', text: 'Polietileno nas quatro pontas: as quinas, onde o quadro mais sofre, ficam protegidas.' },
  { key: 'edges', title: 'Cantoneiras laterais', text: 'Com vidro, mais quatro perfis ao longo das bordas: são oito no total.', glassOnly: true },
  { key: 'box', title: 'Caixa de MDF reforçada', text: 'Laterais de MDF pregadas na base, montada na nossa fábrica.' },
  { key: 'lid', title: 'Tampo com adesivo', text: 'Fechada com tampo de MDF e o aviso: frágil, cuidado vidro, produto rastreado.' },
]

/** Visibilidade (0–1) da etiqueta de uma etapa: entra na segunda metade do trecho dela */
export function packReveal(offset: number, step: PackStep): number {
  const [from, distance] = STORY[step]
  return smooth(progress(offset, [from + distance * 0.4, distance * 0.5]))
}

/**
 * As etapas de abrir a caixa, dentro de STORY.unbox (0–1 cada): o tampo sai, o quadro sai para
 * a frente, as cantoneiras soltam e a caixa desce. Uma começa antes da outra terminar.
 */
export function unboxPhases(offset: number) {
  const u = progress(offset, STORY.unbox)
  const part = (from: number, length: number) => smooth(Math.min(1, Math.max(0, (u - from) / length)))
  return { lidOff: part(0, 0.35), quadroOut: part(0.2, 0.45), guardsOff: part(0.45, 0.4), boxDown: part(0.5, 0.5) }
}

/**
 * Paradas do botão "Avançar" (fração do scroll): cada explicação das partes e cada etapa da
 * embalagem inteira na tela, uma depois da outra
 */
export function advanceStops(partCount: number, steps: PackStep[]): number[] {
  const [from, length] = STORY.parts
  const parts = Array.from({ length: partCount }, (_, index) => from + (length * (index + 0.7)) / partCount)
  const pack = steps.map((key) => STORY[key][0] + STORY[key][1] * 0.92)
  return [...parts, ...pack]
}
