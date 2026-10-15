import { mm } from './format'
import { plate } from './shapes'
import { MDF, PHOTO_PAPER, photoPrint } from './surfaces'
import { definePart, type PartDef, type Vec3 } from './types'

/** Arte impressa em papel fotográfico fosco adesivo, colada numa placa de MDF. */
export interface BoardSpec {
  /** Largura da arte e da placa (m) */
  width: number
  /** Altura da arte e da placa (m) */
  height: number
  /** Espessura da placa de MDF */
  mdf: number
  /** Espessura do papel fotográfico */
  paper: number
  /** Arte impressa (URL); sem ela, a arte de exemplo */
  art?: string
}

interface BoardPartOptions {
  explode: number
  marker: Vec3
  /** Recebe sombra (ex.: da borda de uma moldura por cima) */
  receiveShadow: boolean
}

/** O papel impresso: a arte na frente, papel branco nas bordas e no verso */
export function printPart({ width: W, height: H, paper: p, art }: BoardSpec, options: BoardPartOptions): PartDef {
  return definePart({
    id: 'impressao',
    label: 'Papel fotográfico fosco',
    description: 'A arte impressa em papel fotográfico fosco adesivo, colado sobre o MDF.',
    explode: options.explode,
    marker: options.marker,
    surfaces: { arte: photoPrint(art), papel: PHOTO_PAPER },
    baseSurface: 'papel',
    shadows: { cast: false, receive: options.receiveShadow },
    boxes: [{ ...plate(W, H, p, -p / 2), faces: { pz: 'arte' } }],
  })
}

/** A placa de MDF, logo atrás do papel */
export function mdfPart(
  { width: W, height: H, mdf: m, paper: p }: BoardSpec,
  options: BoardPartOptions & { description: string },
): PartDef {
  return definePart({
    id: 'mdf',
    label: `Placa de MDF de ${mm(m)}`,
    description: options.description,
    explode: options.explode,
    marker: options.marker,
    surfaces: { mdf: MDF },
    baseSurface: 'mdf',
    shadows: { cast: false, receive: options.receiveShadow },
    boxes: [plate(W, H, m, -p - m / 2)],
  })
}
