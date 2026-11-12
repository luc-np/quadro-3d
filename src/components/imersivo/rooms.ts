import { AMBIENT, type AmbientPhoto } from '@/components/especial/PhotoRoom'

/**
 * Os ambientes da vista "Na parede": uma foto para o computador (16:9) e outra para o celular
 * (9:16), da parede vazia acima de um móvel. Prompts em leia/PROMPTS-AMBIENTES.md.
 */
export interface RoomDef {
  key: string
  label: string
  /** Onde o quadro fica, para a dica ("acima do sofá") */
  above: string
  /** Altura (m) do topo do móvel: a base do quadro fica `AMBIENT.hangGap` acima dele */
  top: number
  /** Miniatura quadrada (176 px) do ambiente, para a escolha na etiqueta de compra */
  thumb: string
  /** O móvel de referência, para as cotas da vista "Escala", e como ele aparece no texto ("um sofá") */
  furniture: string
  phrase: string
  wide: AmbientPhoto
  narrow: AmbientPhoto
  /** x (px) das pontas do móvel em cada foto (junto da parede) */
  span: { wide: [number, number]; narrow: [number, number] }
  /**
   * Larguras do móvel para escolher (como o simulador do site antigo): cada uma é o mesmo cômodo
   * com o móvel nessa medida. Os campos acima são os da largura `initial`.
   */
  sizes?: { label: string; aria: string; initial: string; options: FurnitureSize[]; /** Na recomendação: "Ideal para esse sofá" */ fits: string }
}

/** Uma largura do móvel: as fotos do cômodo com ele nessa medida e o tamanho de quadro que combina */
export interface FurnitureSize {
  key: string
  /** Na escolha ("2,00 m", "Queen") */
  label: string
  /** Na dica, com a medida ("acima do sofá de 2,00 m") */
  above: string
  top: number
  wide: AmbientPhoto
  narrow: AmbientPhoto
  span: { wide: [number, number]; narrow: [number, number] }
  /** O tamanho mais proporcional para esse móvel: a tabela do simulador do site antigo (pdp-d.php, SIM) */
  reco: string
}

/** O ambiente com a largura do móvel escolhida (sem escolha, ou num ambiente de uma largura só: como ele é) */
export function sizedRoom(room: RoomDef, key: string | undefined): RoomDef & { size?: FurnitureSize } {
  const options = room.sizes?.options ?? []
  const size = options.find((option) => option.key === key) ?? options.find((option) => option.key === room.sizes?.initial)
  return size ? { ...room, above: size.above, top: size.top, wide: size.wide, narrow: size.narrow, span: size.span, size } : room
}

/**
 * O móvel na cena (m, coordenadas da sala, com o eixo do quadro em x = 0): as pontas e a largura,
 * medidas na foto da tela atual
 */
export function furnitureOf(room: RoomDef, layout: 'wide' | 'narrow') {
  const photo = room[layout]
  const meters = AMBIENT.ceiling / (photo.floorLine - photo.ceilingLine)
  const [left, right] = room.span[layout]
  return { left: (left - photo.axis) * meters, right: (right - photo.axis) * meters, width: (right - left) * meters, height: room.top }
}

interface Measured {
  src: string
  front?: string
  width: number
  height: number
  /** y (px) de onde a parede encontra o piso e do topo do móvel (junto da parede) */
  floorLine: number
  topLine: number
  axis: number
  zoom: number
  viewHeight: number
}

/**
 * Fotos novas: a escala vem da altura do móvel (o gerador acertou as alturas pedidas, mas fez os
 * móveis mais largos), e a "linha do teto" é calculada com o pé-direito de AMBIENT.ceiling.
 * O enquadramento (`zoom`) abre mais que o da sala, para os móveis largos não ficarem cortados.
 */
function calibrated(top: number, { floorLine, topLine, ...photo }: Measured): AmbientPhoto {
  const perMeter = (floorLine - topLine) / top
  return { ...photo, floorLine, ceilingLine: floorLine - AMBIENT.ceiling * perMeter }
}

// height: só nas fotos que ganharam parede em cima (paredes-vazias/v3/exportar-site.py, TETO_VIRA_PAREDE)
const wide = (src: string, rest: Omit<Measured, 'src' | 'width' | 'height'> & { height?: number }) => ({ src, width: 3840, height: 2160, ...rest })
const narrow = (src: string, rest: Omit<Measured, 'src' | 'width' | 'height'>) => ({ src, width: 2160, height: 3840, ...rest })

interface SizeShots {
  key: string
  label: string
  above: string
  reco: string
  /** Largura do móvel (m) */
  meters: number
  /**
   * Computador (medidas na escala de 1920 px de largura; o arquivo tem 3840 px): pontas do móvel,
   * linha do piso (rodapé) e topo do móvel, em px; a altura só muda numa foto com parede a mais em cima
   */
  desk: { src: string; front?: string; height?: number; span: [number, number]; floorLine: number; topLine: number; zoom: number; viewHeight: number }
  /**
   * Celular (×1920; o piso fica escondido): topo do móvel e pontas dele; se ele sai da foto, a escala
   * (px por m) e o eixo vêm dados
   */
  phone: { src: string; width?: number; height?: number; topLine: number; zoom: number; viewHeight: number } & ({ span: [number, number] } | { perMeter: number; axis: number })
}

/**
 * Fotos de 15/10, uma por largura do móvel (paredes-vazias/v3; medidas em v3/finais/medidas.json): a
 * escala vem da largura do móvel medida na foto (o gerador desenha o sofá mais comprido e mais baixo
 * que o pedido, então a altura calculada do encosto fica abaixo da real); a linha do teto sai do
 * pé-direito (AMBIENT.ceiling) e a do piso no celular, da altura do móvel medida no computador.
 */
function sized({ key, label, above, reco, meters, desk, phone }: SizeShots): FurnitureSize {
  const deskPer = (desk.span[1] - desk.span[0]) / meters
  const top = (desk.floorLine - desk.topLine) / deskPer
  const phonePer = 'span' in phone ? (phone.span[1] - phone.span[0]) / meters : phone.perMeter
  const phoneAxis = 'span' in phone ? (phone.span[0] + phone.span[1]) / 2 : phone.axis
  const phoneSpan: [number, number] = 'span' in phone ? phone.span : [phoneAxis - (meters / 2) * phonePer, phoneAxis + (meters / 2) * phonePer]
  const phoneFloor = phone.topLine + top * phonePer
  return {
    key,
    label,
    above,
    reco,
    top,
    span: { wide: desk.span, narrow: phoneSpan },
    wide: { src: desk.src, front: desk.front, width: 1920, height: desk.height ?? 1080, floorLine: desk.floorLine, ceilingLine: desk.floorLine - AMBIENT.ceiling * deskPer, axis: (desk.span[0] + desk.span[1]) / 2, zoom: desk.zoom, viewHeight: desk.viewHeight },
    narrow: { src: phone.src, width: phone.width ?? 1080, height: phone.height ?? 1920, floorLine: phoneFloor, ceilingLine: phoneFloor - AMBIENT.ceiling * phonePer, axis: phoneAxis, zoom: phone.zoom, viewHeight: phone.viewHeight },
  }
}

/** Um cômodo com uma foto só (computador e celular) e as pontas do móvel em cada uma */
interface OnePhoto {
  wide: Measured
  narrow: Measured
  span: { wide: [number, number]; narrow: [number, number] }
}

/**
 * Uma largura do móvel num cômodo de foto única (como as camas, que usam as fotos da queen): a escala
 * vem da largura escolhida, medida nas pontas do móvel, e a altura dele acompanha. No celular, a escala
 * vem das pontas na foto dele e o piso, da altura do computador (como em `sized`): o topo do móvel fica
 * onde está nas duas fotos. O eixo do quadro e o enquadramento continuam os da foto.
 * 12/11/2026: sem isso, aparador, buffet e escrivaninha ficavam com a medida da foto (1,40, 2,40 e
 * 1,95 m) qualquer que fosse a largura escolhida no "Me ajude a escolher" da página de produto.
 */
function resized(photo: OnePhoto, { meters, ...size }: Pick<SizeShots, 'key' | 'label' | 'above' | 'reco' | 'meters'>): FurnitureSize {
  const top = ((photo.wide.floorLine - photo.wide.topLine) * meters) / (photo.span.wide[1] - photo.span.wide[0])
  const phonePer = (photo.span.narrow[1] - photo.span.narrow[0]) / meters
  return {
    ...size,
    top,
    span: photo.span,
    wide: calibrated(top, photo.wide),
    narrow: calibrated(top, { ...photo.narrow, floorLine: photo.narrow.topLine + top * phonePer }),
  }
}

/** O ambiente que tem larguras: os campos da largura inicial e a lista */
function withSizes(room: Omit<RoomDef, 'above' | 'top' | 'wide' | 'narrow' | 'span' | 'sizes'>, sizes: Omit<NonNullable<RoomDef['sizes']>, 'options'>, options: FurnitureSize[]): RoomDef {
  const initial = options.find((option) => option.key === sizes.initial)!
  return { ...room, above: initial.above, top: initial.top, wide: initial.wide, narrow: initial.narrow, span: initial.span, sizes: { ...sizes, options } }
}

const SALA_DESK = { floorLine: 914, zoom: 1.5, viewHeight: 1.2 }
const SALA_PHONE = { zoom: 1, viewHeight: 1.35 }
// As fotos do computador ganharam parede em cima (no quarto, no lugar do teto): o quadro mais alto (150 cm)
// passava do alto da foto ou entrava no teto. Piso e topo do móvel descem junto.
const QUARTO_DESK = { height: 1280, floorLine: 1122, topLine: 766, zoom: 1.5, viewHeight: 1.3 }
const QUARTO_PHONE = { topLine: 738, zoom: 1, viewHeight: 1.45 }

// Os cômodos de foto única. A escrivaninha (0,75 m de altura na foto) tem a luminária à direita: o
// quadro vai um pouco para a esquerda
const ESCRITORIO: OnePhoto = {
  span: { wide: [1171, 2675], narrow: [214, 1959] },
  wide: wide('/ambiente/escritorio-computador.webp', { front: '/ambiente/escritorio-computador-frente.webp', height: 2400, floorLine: 2149, topLine: 1575, axis: 1882, zoom: 1.38, viewHeight: 1.2 }),
  narrow: narrow('/ambiente/escritorio-celular.webp', { floorLine: 3153, topLine: 2481, axis: 1037, zoom: 1.63, viewHeight: 1.25 }),
}
// Buffet (0,80 m de altura na foto), com o vaso de galhos à direita
const JANTAR: OnePhoto = {
  span: { wide: [1025, 2809], narrow: [356, 1866] },
  wide: wide('/ambiente/sala-jantar-computador.webp', { front: '/ambiente/sala-jantar-computador-frente.webp', height: 2300, floorLine: 2137, topLine: 1541, axis: 1917, zoom: 1.44, viewHeight: 1.2 }),
  narrow: narrow('/ambiente/sala-jantar-celular.webp', { floorLine: 3510, topLine: 2930, axis: 1111, zoom: 1.86, viewHeight: 1.3 }),
}
// Aparador (0,80 m de altura na foto); o vaso de galhos fica à esquerda, perto do meio: o quadro vai
// para a direita dele
const HALL: OnePhoto = {
  span: { wide: [1392, 2443], narrow: [352, 1819] },
  wide: wide('/ambiente/hall-computador.webp', { front: '/ambiente/hall-computador-frente.webp', height: 2300, floorLine: 2151, topLine: 1554, axis: 2093, zoom: 1.48, viewHeight: 1.2 }),
  narrow: narrow('/ambiente/hall-celular.webp', { floorLine: 3384, topLine: 2532, axis: 1231, zoom: 1.34, viewHeight: 1.25 }),
}

export const ROOMS: RoomDef[] = [
  // Sala: uma foto por largura do sofá (fotos de 15/10). Quarto: as três camas usam as fotos da queen,
  // com a cabeceira medida como 1,50 / 1,70 / 2,05 m (na foto da king que saiu, a cama ficou grande
  // demais para o cômodo e o teto, baixo demais para um quadro alto acima dela)
  withSizes(
    { key: 'sala', label: 'Sala', thumb: '/ambiente/sala-mini.webp', furniture: 'Sofá', phrase: 'um sofá' },
    { label: 'Sofá', aria: 'Largura do sofá', initial: '200', fits: 'esse sofá' },
    [
      sized({
        key: '160',
        label: '1,60 m',
        above: 'acima do sofá de 1,60 m',
        reco: '40x60',
        meters: 1.6,
        desk: { ...SALA_DESK, src: '/ambiente/sala-160-computador.webp', front: '/ambiente/sala-160-computador-frente.webp', height: 1440, span: [563, 1355], floorLine: 1274, topLine: 1010 },
        phone: { ...SALA_PHONE, src: '/ambiente/sala-160-celular.webp', span: [145, 933], topLine: 1494 },
      }),
      sized({
        key: '200',
        label: '2,00 m',
        above: 'acima do sofá de 2,00 m',
        reco: '50x70',
        meters: 2,
        desk: { ...SALA_DESK, src: '/ambiente/sala-200-computador.webp', front: '/ambiente/sala-200-computador-frente.webp', height: 1140, span: [590, 1327], floorLine: 973, topLine: 779 },
        phone: { ...SALA_PHONE, src: '/ambiente/sala-200-celular.webp', span: [90, 985], topLine: 1262 },
      }),
      sized({
        key: '240',
        label: '2,40 m',
        above: 'acima do sofá de 2,40 m',
        reco: '60x90',
        meters: 2.4,
        desk: { ...SALA_DESK, src: '/ambiente/sala-240-computador.webp', front: '/ambiente/sala-240-computador-frente.webp', height: 1340, span: [438, 1508], floorLine: 1174, topLine: 910 },
        // As pontas saem da foto: a escala vem do recorte da foto do computador que virou o celular
        phone: { ...SALA_PHONE, src: '/ambiente/sala-240-celular.webp', perMeter: 491, axis: 540, topLine: 1448 },
      }),
    ],
  ),
  withSizes(
    { key: 'quarto', label: 'Quarto', thumb: '/ambiente/quarto-mini.webp', furniture: 'Cabeceira', phrase: 'uma cama' },
    { label: 'Cama', aria: 'Tamanho da cama', initial: 'queen', fits: 'essa cama' },
    [
      sized({
        key: 'casal',
        label: 'Casal',
        above: 'acima da cama de casal',
        reco: '30x45',
        meters: 1.5,
        desk: { ...QUARTO_DESK, src: '/ambiente/quarto-queen-computador.webp', span: [687, 1233] },
        phone: { ...QUARTO_PHONE, src: '/ambiente/quarto-queen-celular.webp', span: [53, 1029] },
      }),
      sized({
        key: 'queen',
        label: 'Queen',
        above: 'acima da cama queen',
        reco: '40x60',
        meters: 1.7,
        desk: { ...QUARTO_DESK, src: '/ambiente/quarto-queen-computador.webp', span: [687, 1233] },
        phone: { ...QUARTO_PHONE, src: '/ambiente/quarto-queen-celular.webp', span: [53, 1029] },
      }),
      sized({
        key: 'king',
        label: 'King',
        above: 'acima da cama king',
        reco: '50x70',
        meters: 2.05,
        desk: { ...QUARTO_DESK, src: '/ambiente/quarto-queen-computador.webp', span: [687, 1233] },
        phone: { ...QUARTO_PHONE, src: '/ambiente/quarto-queen-celular.webp', span: [53, 1029] },
      }),
    ],
  ),
  // Escritório, jantar e hall: uma foto só, com a escala de cada largura (como as camas; 12/11/2026). As
  // larguras são as do "Me ajude a escolher" da página de produto; a inicial, a mais perto da foto
  // horizontal, que também deixa mais parede acima do móvel
  withSizes(
    { key: 'escritorio', label: 'Escritório', thumb: '/ambiente/escritorio-mini.webp', furniture: 'Escrivaninha', phrase: 'uma escrivaninha' },
    { label: 'Escrivaninha', aria: 'Largura da escrivaninha', initial: '160', fits: 'essa escrivaninha' },
    [
      resized(ESCRITORIO, { key: '120', label: '1,20 m', above: 'acima da escrivaninha de 1,20 m', reco: '30x45', meters: 1.2 }),
      resized(ESCRITORIO, { key: '160', label: '1,60 m', above: 'acima da escrivaninha de 1,60 m', reco: '40x60', meters: 1.6 }),
    ],
  ),
  withSizes(
    { key: 'jantar', label: 'Jantar', thumb: '/ambiente/sala-jantar-mini.webp', furniture: 'Buffet', phrase: 'um buffet' },
    { label: 'Buffet', aria: 'Largura do buffet', initial: '200', fits: 'esse buffet' },
    [
      resized(JANTAR, { key: '180', label: '1,80 m', above: 'acima do buffet de 1,80 m', reco: '50x70', meters: 1.8 }),
      resized(JANTAR, { key: '200', label: '2,00 m', above: 'acima do buffet de 2,00 m', reco: '50x70', meters: 2 }),
    ],
  ),
  withSizes(
    { key: 'hall', label: 'Hall', thumb: '/ambiente/hall-mini.webp', furniture: 'Aparador', phrase: 'um aparador' },
    { label: 'Aparador', aria: 'Largura do aparador', initial: '160', fits: 'esse aparador' },
    [
      resized(HALL, { key: '90', label: '0,90 m', above: 'acima do aparador de 0,90 m', reco: '30x45', meters: 0.9 }),
      resized(HALL, { key: '120', label: '1,20 m', above: 'acima do aparador de 1,20 m', reco: '30x45', meters: 1.2 }),
      resized(HALL, { key: '160', label: '1,60 m', above: 'acima do aparador de 1,60 m', reco: '40x60', meters: 1.6 }),
    ],
  ),
]
