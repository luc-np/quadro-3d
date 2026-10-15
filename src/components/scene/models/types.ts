/**
 * Convenção de eixos (unidades em metros):
 * x = largura, y = altura, z = profundidade.
 * A frente da arte fica em z = 0, centrada na origem; o que está atrás dela tem z negativo.
 */

export type Vec3 = [number, number, number]

export interface Size2 {
  width: number
  height: number
}

/** Faces na ordem dos grupos do BoxGeometry do three: +x, -x, +y, -y, +z, -z */
export const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'] as const
export type Face = (typeof FACES)[number]

export interface Box<S extends string = string> {
  size: Vec3
  position: Vec3
  /** Superfície de cada face. As omitidas usam a `baseSurface` da parte. */
  faces?: Partial<Record<Face, S>>
}

/** Caixa só com forma; as superfícies das faces são definidas depois */
export type Shape = Pick<Box, 'size' | 'position'>

/**
 * Texturas que se repetem em escala real. As UVs da geometria são em metros e o eixo u
 * corre ao longo da maior dimensão de cada peça: com o veio horizontal na imagem,
 * a madeira acompanha cada ripa.
 */
export interface TiledTextures {
  map?: string
  normalMap?: string
  roughnessMap?: string
  /** Lado (m) que uma repetição da imagem cobre na peça */
  tile: number
}

interface SurfaceBase {
  /** Multiplica o map; sem map, é a cor da superfície */
  color: string
  roughness: number
  metalness?: number
  /** Intensidade do relevo do normalMap */
  normalScale?: number
  /** Multiplica o reflexo do ambiente (HDR) só nesta superfície */
  envIntensity?: number
}

/**
 * Arte projetada de frente sobre a área `art` do modelo, sem distorcer
 * (recorte central, como `object-fit: cover`). Nas laterais, a projeção estica a borda da arte.
 */
interface ArtSurface extends SurfaceBase {
  art: string
  tiled?: TiledTextures & { map?: never }
  glass?: never
}

interface PlainSurface extends SurfaceBase {
  art?: never
  tiled?: TiledTextures
  glass?: never
}

/** Vidro: só o reflexo do ambiente, somado por cima do que está atrás (que segue nítido) */
interface GlassSurface extends SurfaceBase {
  glass: { ior: number }
  art?: never
  tiled?: never
}

export type SurfaceDef = ArtSurface | PlainSurface | GlassSurface

/** Tipos de ferragem com geometria própria (não são caixas), gerada pelo renderizador */
export type HardwareKind = 'sawtoothHanger' | 'screw'

/** Uma ferragem: os dados dizem qual peça e onde; a forma vem de hardwareGeometry.ts */
export interface HardwareItem<S extends string = string> {
  kind: HardwareKind
  position: Vec3
  /** Rotação em radianos (ordem XYZ). Sem rotação, a peça fica deitada no plano xy, voltada para +z */
  rotation: Vec3
  surface: S
}

export interface PartDef<S extends string = string> {
  id: string
  label: string
  description: string
  /** Deslocamento em z (m) quando a vista explodida está em 100% */
  explode: number
  /** Ponto da parte (m), visível na vista explodida, onde fica o número da legenda */
  marker: Vec3
  surfaces: Record<S, SurfaceDef>
  /** Superfície das faces que a caixa não especifica */
  baseSurface: S
  /** Sombras só onde aparecem: cada parte que projeta ou recebe custa mais um desenho por frame */
  shadows: { cast: boolean; receive: boolean }
  boxes: Box<S>[]
  hardware?: HardwareItem<S>[]
}

/** Um produto: as partes, da frente para trás, e as medidas que a cena precisa conhecer. */
export interface ModelDef {
  /** Nome do produto, para títulos e links */
  name: string
  /** Área da arte (m), centrada na origem com a frente em z = 0: onde a imagem é projetada */
  art: Size2
  /** Parte da arte que fica à vista (a moldura pode cobrir a borda) */
  window: Size2
  /** Contorno externo do quadro montado (m) */
  outer: Size2
  parts: PartDef[]
}

/** Garante, na compilação, que as faces só usam superfícies que a parte define */
export function definePart<S extends string>(part: PartDef<S>): PartDef {
  return part
}
