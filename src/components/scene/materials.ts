import {
  AdditiveBlending,
  ClampToEdgeWrapping,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type ColorSpace,
  type Texture,
  type Wrapping,
} from 'three'
import { ART_UV_CHANNEL } from './geometry'
import { FACES, type Box, type SurfaceDef } from './models/types'

export type SurfaceMaterials = Record<string, MeshStandardMaterial>

interface MaterialContext {
  /** Texturas carregadas, por URL */
  textures: Record<string, Texture>
  /** Largura e altura (m) da área onde a arte é projetada: a frente da tela */
  artSize: [number, number]
  anisotropy: number
}

/** Escala (em UV 0–1) do recorte central que cobre o alvo sem distorcer, como `object-fit: cover` */
export function coverScale(imageAspect: number, targetAspect: number): [number, number] {
  return [Math.min(1, targetAspect / imageAspect), Math.min(1, imageAspect / targetAspect)]
}

/**
 * De onde baixar cada textura. Os modelos usam os caminhos de `public/` (ex.: /textures/...);
 * fora do Next (o visualizador embutido no tema da loja), quem monta a cena troca por outros
 * endereços com setTextureUrlResolver.
 */
let resolveTextureUrl = (url: string) => url

export function setTextureUrlResolver(resolve: (url: string) => string) {
  resolveTextureUrl = resolve
}

/** Endereço de um arquivo do projeto (caminho em public/): o mesmo no Next, o do tema na loja */
export function assetUrl(path: string): string {
  return resolveTextureUrl(path)
}

/** Texturas das superfícies, sem repetição: chave = caminho no modelo, valor = de onde baixar */
export function textureUrls(surfaces: Record<string, SurfaceDef>): Record<string, string> {
  const urls: Record<string, string> = {}
  for (const { art, tiled } of Object.values(surfaces)) {
    for (const url of [art, tiled?.map, tiled?.normalMap, tiled?.roughnessMap]) {
      if (url) urls[url] = resolveTextureUrl(url)
    }
  }
  return urls
}

/** Um material por superfície; superfícies com a mesma definição dividem o material */
export function createSurfaceMaterials(surfaces: Record<string, SurfaceDef>, ctx: MaterialContext): SurfaceMaterials {
  const byDefinition = new Map<SurfaceDef, MeshStandardMaterial>()
  const materials: SurfaceMaterials = {}
  for (const [id, surface] of Object.entries(surfaces)) {
    let material = byDefinition.get(surface)
    if (!material) {
      material = createSurfaceMaterial(surface, ctx)
      byDefinition.set(surface, material)
    }
    materials[id] = material
  }
  return materials
}

export function disposeSurfaceMaterials(materials: SurfaceMaterials) {
  for (const material of new Set(Object.values(materials))) {
    // As texturas são clones exclusivos deste material
    material.map?.dispose()
    material.normalMap?.dispose()
    material.roughnessMap?.dispose()
    material.dispose()
  }
}

/** Material da malha: um só se todas as faces usam a mesma superfície, senão um por face */
export function boxMaterial(box: Box, materials: SurfaceMaterials, baseSurface: string) {
  const perFace = FACES.map((face) => materials[box.faces?.[face] ?? baseSurface])
  return perFace.every((material) => material === perFace[0]) ? perFace[0] : perFace
}

function createSurfaceMaterial(
  { color, roughness, metalness = 0, normalScale = 1, envIntensity = 1, art, tiled, glass }: SurfaceDef,
  { textures, artSize, anisotropy }: MaterialContext,
): MeshStandardMaterial {
  // Vidro: só o reflexo (cor preta), somado por cima do que já foi desenhado atrás. Não usa a
  // transmissão física do three: ela relê a cena de uma textura com filtro bicúbico e borra a arte.
  const material = glass
    ? new MeshPhysicalMaterial({
        color,
        roughness,
        metalness,
        ior: glass.ior,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      })
    : new MeshStandardMaterial({ color, roughness, metalness })
  material.envMapIntensity = envIntensity

  if (tiled) {
    const repeat = 1 / tiled.tile
    const tiledTexture = (url: string, colorSpace: ColorSpace) => {
      const texture = withUploadParams(textures[url], colorSpace, RepeatWrapping, anisotropy).clone()
      texture.repeat.set(repeat, repeat)
      return texture
    }
    if (tiled.map) material.map = tiledTexture(tiled.map, SRGBColorSpace)
    if (tiled.normalMap) {
      material.normalMap = tiledTexture(tiled.normalMap, NoColorSpace)
      material.normalScale.setScalar(normalScale)
    }
    if (tiled.roughnessMap) material.roughnessMap = tiledTexture(tiled.roughnessMap, NoColorSpace)
  }

  if (art) {
    const [width, height] = artSize
    const source = textures[art]
    const [scaleX, scaleY] = coverScale(imageAspect(source), width / height)
    const texture = withUploadParams(source, SRGBColorSpace, ClampToEdgeWrapping, anisotropy).clone()
    texture.channel = ART_UV_CHANNEL
    // uv1 vai de -width/2 a +width/2 (idem altura): leva o centro da tela ao centro da imagem
    texture.repeat.set(scaleX / width, scaleY / height)
    texture.offset.set(0.5, 0.5)
    material.map = texture
  }

  return material
}

/**
 * Ajusta os parâmetros de upload no original em cache do useTexture. Clones com os mesmos
 * parâmetros dividem a mesma textura na GPU; repeat, offset e canal ficam só no clone.
 */
function withUploadParams(texture: Texture, colorSpace: ColorSpace, wrap: Wrapping, anisotropy: number): Texture {
  texture.colorSpace = colorSpace
  texture.wrapS = wrap
  texture.wrapT = wrap
  texture.anisotropy = anisotropy
  return texture
}

function imageAspect({ image }: Texture): number {
  if (!(image instanceof HTMLImageElement)) throw new Error('A arte precisa ser uma imagem (jpg, png, webp)')
  return image.naturalWidth / image.naturalHeight
}
