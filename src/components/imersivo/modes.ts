/** As vistas da página imersiva, na ordem do seletor (a Profundidade saiu no handoff da vitrine, 11/10) */
export const MODES = [
  { key: 'frente', label: 'Frente' },
  { key: 'parede', label: 'Na parede' },
  { key: 'dentro', label: 'Por dentro' },
  { key: 'escala', label: 'Escala' },
] as const

export type Mode = (typeof MODES)[number]['key']

/** As vistas com ambiente: nelas aparece a lista para escolher a sala, o quarto... */
export const ROOM_MODES: readonly Mode[] = ['parede', 'escala']
