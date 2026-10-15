import type { Finish } from '@/components/scene/models/configure'
import type { FrameColor } from '@/components/scene/models/surfaces'

export const FINISH_LABEL: Record<Finish, string> = {
  filete: 'Filete',
  caixa: 'Caixa',
  canvas: 'Canvas flutuante',
  placa: 'Sem moldura',
}

/** Nomes curtos para as etiquetas e a bandeja do celular */
export const FINISH_SHORT: Record<Finish, string> = { ...FINISH_LABEL, canvas: 'Canvas' }

/** Ordem das molduras nos botões */
export const FINISH_ORDER: Finish[] = ['filete', 'caixa', 'canvas', 'placa']

export const COLOR_LABEL: Record<FrameColor, { name: string; swatch: string }> = {
  preta: { name: 'Preta', swatch: '#2b2a2c' },
  branca: { name: 'Branca', swatch: '#ecebe7' },
  tabaco: { name: 'Tabaco', swatch: '#9b7f64' },
  freijo: { name: 'Freijó', swatch: '#936542' },
  crua: { name: 'Crua', swatch: '#cec1a8' },
}

/** As escolhas do topo, cada uma ligada por linha a uma parte do quadro */
export type ChoiceKey = 'moldura' | 'cor' | 'vidro' | 'tamanho'
export const CHOICES: ChoiceKey[] = ['moldura', 'cor', 'vidro', 'tamanho']
export const CHOICE_TITLE: Record<ChoiceKey, string> = { moldura: 'Moldura', cor: 'Cor', vidro: 'Vidro', tamanho: 'Tamanho' }
