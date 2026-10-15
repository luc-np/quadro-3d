/**
 * As oito perguntas que decidem a compra (as da página de produto atual), respondidas rolando a
 * página: o palco do topo fica preso na tela e o quadro anima a resposta de cada uma.
 *
 * O progresso `s` vai de 0 (a vitrine do topo) a QUESTIONS (a última pergunta no meio da tela);
 * `s = k` quando a pergunta k está no centro. Cada pergunta tem uma pose (onde ficam o quadro e a
 * câmera) e uma animação interna, conduzida por `u` (0 quando ela entra, 0,5 no centro, 1 quando sai).
 */

export const QUESTIONS = 8

/** Pose da cena numa pergunta: tudo que a câmera e o quadro precisam, como números para misturar */
export interface Pose {
  /** A foto do ambiente (0–1) e o enquadramento de longe, como na vista "Escala" */
  wall: number
  far: number
  /** Câmera de frente-direita (a da vista por dentro) em vez de frente */
  angled: number
  /** Giro (rad) e quanto o quadro sai da parede (m) */
  yaw: number
  lift: number
  /** Distância extra (m) entre as peças, além dos 4 cm; e as outras peças fora de cena (0–1) */
  spread: number
  solo: number
  /** Aproxima a câmera (1 = o quadro inteiro na área livre) e o ponto que ela olha (frações da largura e da altura) */
  zoom: number
  focusX: number
  focusY: number
  /** Qual grupo aparece: o quadro escolhido, o par canvas × papel, o par sem × com vidro, o canvas sozinho */
  main: number
  material: number
  glass: number
  canvas: number
  /** O canvas sozinho desliza para o lado (fração da largura): mostra o que está atrás dele */
  slide: number
  /** O par gira espelhado (1): cada quadro para um lado, como portas */
  mirror: number
}

export const POSE_KEYS = ['wall', 'far', 'angled', 'yaw', 'lift', 'spread', 'solo', 'zoom', 'focusX', 'focusY', 'main', 'material', 'glass', 'canvas', 'slide', 'mirror'] as const

export const BASE: Pose = { wall: 0, far: 0, angled: 0, yaw: 0, lift: 0, spread: 0, solo: 0, zoom: 1, focusX: 0, focusY: 0, main: 1, material: 0, glass: 0, canvas: 0, slide: 0, mirror: 0 }

export const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** Trecho [de, até] de `u` mapeado para 0–1, suavizado */
export const span = (u: number, from: number, to: number) => smooth((u - from) / (to - from))

/**
 * Pose da pergunta `k` (1–8) no momento `u` da animação dela. `pieces`: quantas peças (1, 2 ou 3);
 * `setWidth`, `pieceWidth` (m): para aproximar a câmera do vão entre as peças.
 */
export function poseOf(k: number, u: number, pieces: number, setWidth: number, pieceWidth: number): Pose {
  const set = pieces > 1
  switch (k) {
    // 01 · Vai caber? O conjunto na parede, de longe, com as medidas dele e do móvel
    case 1:
      return { ...BASE, wall: 1, far: 1 }
    // 02 · Quantos vêm? As peças saem da parede e se afastam, uma a uma (avulso: dá uma volta)
    case 2: {
      const out = span(u, 0.05, 0.45)
      return set
        ? { ...BASE, lift: 0.3 * out, spread: 0.22 * out, yaw: (-10 * Math.PI) / 180 * out, zoom: 0.92 }
        : { ...BASE, lift: 0.3 * out, yaw: Math.PI * 2 * span(u, 0.1, 0.5), zoom: 1 }
    }
    // 03 · Conjunto: as peças se aproximam até 4 cm, com a câmera no vão. Avulso: a altura acima do móvel
    case 3: {
      if (!set) return { ...BASE, wall: 1 }
      const close = span(u, 0.1, 0.45)
      const zoom = 1 + (Math.max(1, setWidth / 0.9) - 1) * close
      // O vão entre a 1ª e a 2ª peça, em fração da largura do conjunto
      const gapX = (pieceWidth + 0.02 - setWidth / 2) / setWidth
      return { ...BASE, lift: 0.3, spread: 0.22 * (1 - close), zoom, focusX: gapX * close, focusY: -0.2 * close }
    }
    // 04 · Como pendurar? O quadro vira de costas e a câmera chega nos penduradores
    case 4: {
      const turn = span(u, 0.08, 0.45)
      return { ...BASE, lift: 0.3, solo: 1, yaw: Math.PI * turn + (-18 * Math.PI) / 180 * turn, zoom: 1 + 0.55 * turn, focusY: 0.22 * turn }
    }
    // 05 · Chega inteiro? A embalagem (a animação é a da página especial, conduzida por `u`)
    case 5:
      return { ...BASE, lift: 0.3, solo: 1, angled: 1, zoom: 0.78, yaw: (-28 * Math.PI) / 180 }
    // 06 · Canvas ou papel? A textura: o par de frente, parado; a câmera chega bem perto, como uma
    // lupa, e desliza da trama do canvas (à esquerda) para o papel liso (à direita)
    case 6: {
      const close = span(u, 0.12, 0.4)
      const pan = span(u, 0.38, 0.86)
      return { ...BASE, main: 0, material: 1, zoom: 1.05 + 1.75 * close, focusX: -0.26 * close + 0.52 * pan, focusY: 0.12 * close }
    }
    // 07 · Com ou sem vidro? O reflexo: de longe, os dois abrem e fecham como portas (cada um para um
    // lado), devagar, e a luz corre pelo vidro de um e não pelo outro
    case 7: {
      const swing = Math.sin(u * Math.PI * 2)
      return { ...BASE, main: 0, glass: 1, mirror: 1, lift: 0.05, yaw: (28 * Math.PI) / 180 * swing, zoom: 1.08 }
    }
    // 08 · Esconde caixa de energia? O canvas sai da parede e de lado, mostra a caixa e volta
    default: {
      const reveal = span(u, 0.12, 0.4) * (1 - span(u, 0.62, 0.92))
      return { ...BASE, main: 0, canvas: 1, wall: 1, lift: 0.18 * reveal, yaw: (-30 * Math.PI) / 180 * reveal, slide: 0.95 * reveal }
    }
  }
}

/**
 * Peso de cada pergunta (0–1, somam 1) no progresso `s`: a pose fica parada em volta do centro
 * e a troca acontece entre uma pergunta e a outra (de k + 0,3 a k + 0,7). Índice 0 = a vitrine.
 */
export function weightsOf(s: number): number[] {
  const weights = new Array(QUESTIONS + 1).fill(0)
  const k = Math.min(QUESTIONS, Math.max(0, Math.floor(s)))
  if (k >= QUESTIONS) {
    weights[QUESTIONS] = 1
    return weights
  }
  const a = smooth((s - k - 0.3) / 0.4)
  weights[k] = 1 - a
  weights[k + 1] = a
  return weights
}

/** Momento (0–1) da animação da pergunta k: 0 quando ela entra (s = k − 0,5), 1 quando sai */
export const momentOf = (s: number, k: number) => Math.min(1, Math.max(0, s - k + 0.5))

export interface Question {
  title: string
  text: string
  pill: string
}

interface QuestionData {
  pieces: number
  /** Medida de cada peça e do conjunto na parede (cm) */
  piece: { width: number; height: number }
  set: { width: number; height: number }
  /** Medida da arte (cm), como na escolha de tamanho ("40×60") */
  sizeLabel: string
  /** O móvel do ambiente escolhido: "um sofá", largura (cm) */
  furniture: { phrase: string; width: number }
  /** Folga entre o móvel e a base do quadro (cm) */
  hangGap: number
  framed: boolean
  canvas: boolean
  glassOk: boolean
  /** Quanto o vidro soma no tamanho e na moldura escolhidos (centavos) */
  glassDelta: number | null
  money: (cents: number) => string
}

const WORDS = ['', 'Um', 'Dois', 'Três', 'Quatro']

/** Os textos das perguntas (os da página de produto atual), com as medidas da escolha */
export function questionsOf(d: QuestionData): Question[] {
  const set = d.pieces > 1
  const cm = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  const meters = (value: number) => (value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const setLabel = `${cm(d.set.width)} × ${cm(d.set.height)} cm`
  const fits = d.set.width < d.furniture.width
  const above = `Acima de ${d.furniture.phrase} de ${meters(d.furniture.width)} m, ${fits ? 'sobra parede dos dois lados' : 'ele passa da largura do móvel'}.`
  return [
    {
      title: 'Vai caber na minha parede?',
      text: set ? `O conjunto montado tem ${setLabel}, com 4 cm entre as peças. ${above}` : `O quadro tem ${setLabel} na parede, já com a moldura. ${above}`,
      pill: set ? `${setLabel} montado` : `${setLabel} na parede`,
    },
    {
      title: 'Quantos quadros vêm?',
      text: set
        ? `${WORDS[d.pieces] ?? d.pieces}. Cada um com a medida escolhida — a medida não é do conjunto, é de cada peça.`
        : `Um quadro, na medida escolhida: ${d.sizeLabel} cm de arte, ${cm(d.piece.width)} × ${cm(d.piece.height)} cm com a moldura.`,
      pill: set ? `${d.pieces} quadros · ${d.sizeLabel} cm cada` : `1 quadro · ${d.sizeLabel} cm`,
    },
    set
      ? {
          title: 'Quantos centímetros deixo entre eles?',
          text: 'De 3 a 5 cm. É a recomendação da própria Go Quadros — e é a conta que usamos para calcular a largura montada.',
          pill: '4 cm entre as peças',
        }
      : {
          title: 'A que altura pendurar?',
          text: `Com a base do quadro de 20 a 25 cm acima do móvel. Sem móvel embaixo, o centro do quadro fica na altura dos olhos, a cerca de 1,45 m do piso.`,
          pill: `${cm(d.hangGap)} cm acima do móvel`,
        },
    {
      title: 'Como pendurar?',
      text: 'Os acabamentos com moldura trazem penduradores na parte de trás. A placa sem moldura é só a impressão em MDF, sem estrutura para pendurar.',
      pill: d.framed ? 'Penduradores na parte de trás' : 'Placa: sem pendurador',
    },
    {
      title: 'Chega inteiro?',
      text: 'Embalagem reforçada do ateliê até você. Avaria no transporte: refazemos sem custo.',
      pill: 'Avaria? Refazemos sem custo',
    },
    {
      title: 'Canvas ou papel fotográfico?',
      text: 'Canvas tem textura e efeito artístico; papel fosco tem definição e contraste.',
      pill: d.canvas ? 'O seu: canvas' : 'O seu: papel fosco',
    },
    {
      title: 'Com ou sem vidro?',
      text: 'Sem vidro para sala e quarto; com vidro para cozinha e área de maior umidade.',
      pill: d.glassOk && d.glassDelta !== null ? `Com vidro: + ${d.money(d.glassDelta)} neste tamanho` : 'Vidro: só no Filete e na Caixa',
    },
    {
      title: 'Esconde caixa de energia?',
      text: 'Sim — o modelo canvas tem 3,8 cm de profundidade, feito exatamente para isso.',
      pill: '3,8 cm de profundidade',
    },
  ]
}
