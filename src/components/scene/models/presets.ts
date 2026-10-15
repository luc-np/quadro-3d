import type { BoardSpec } from './board'
import type { FramedSpec } from './framed'

/** Papel fotográfico adesivo colado em MDF de 3 mm (caixa, filete e placa) */
export const BOARD: Pick<BoardSpec, 'mdf' | 'paper'> = { mdf: 0.003, paper: 0.0003 }

export const GLASS_THICKNESS = 0.002

/** Perfil de cada moldura, sem as medidas da arte (que vêm do tamanho escolhido) */
type FramePreset = Omit<FramedSpec, 'width' | 'height' | 'mdf' | 'paper' | 'art' | 'frameSurface'>

// `overlap` e `lipThickness` (o rebaixo por dentro do perfil) são estimativas: só aparecem
// por trás e na vista explodida. Frente e profundidade são as medidas reais.
export const CAIXA: FramePreset = {
  style: 'caixa',
  frameFront: 0.02,
  frameDepth: 0.03,
  overlap: 0.006,
  lipThickness: 0.01,
  glass: 0,
}

export const FILETE: FramePreset = {
  style: 'filete',
  frameFront: 0.008,
  frameDepth: 0.02,
  overlap: 0.004,
  lipThickness: 0.005,
  glass: 0,
}
