import { useEffect, useLayoutEffect, useMemo, type RefObject } from 'react'
import {
  CanvasTexture,
  CylinderGeometry,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  type BufferGeometry,
  type Group,
  type Material,
  type Mesh,
  type Texture,
} from 'three'
import { useGLTF, useTexture } from '@react-three/drei'
import { softBox } from './softBox'

/**
 * A sala onde o quadro é pendurado (unidades em metros). O centro do quadro fica na origem,
 * a 1,45 m do chão (altura de pendurar), com a frente em z = 0; a parede fica logo atrás.
 */
export const ROOM = {
  wallZ: -0.06,
  floorY: -1.45,
  /** Largura e altura (m) da parte da sala que a câmera enquadra, e o centro dela em y */
  view: { width: 3.3, height: 2.5, centerY: -0.55 },
  /** A câmera fica acima do centro e olha levemente para baixo: mostra o assento e um pouco do piso */
  eyeLift: 0.45,
}

/**
 * Texturas da Poly Haven (CC0), com o tamanho real (m) de cada repetição. As cores dos tecidos
 * foram tiradas (cinza claro): quem dá a cor é o material. A parede usa só o relevo do reboco.
 */
const SURFACES = {
  wool: { name: 'poly_wool_herringbone', res: '512', tile: 0.27, color: true },
  linen: { name: 'rough_linen', res: '512', tile: 0.27, color: true },
  teddy: { name: 'curly_teddy_natural', res: '512', tile: 0.33, color: true },
  floor: { name: 'laminate_floor_02', res: '1k', tile: 1.7, color: true },
  wall: { name: 'plastered_wall_04', res: '1k', tile: 3.2, color: false },
} as const

type SurfaceName = keyof typeof SURFACES

/** Modelos da Poly Haven (CC0) */
const PLANT_URL = '/models/potted_plant_02/potted_plant_02.gltf'
const VASE_URL = '/models/ceramic_vase_01/ceramic_vase_01.gltf'

/** Folheado de freijó do próprio quadro, para a mesa lateral */
const OAK = {
  map: '/textures/madeira/ash_veneer_diff_1k.webp',
  normalMap: '/textures/madeira/ash_veneer_nor_gl_1k.webp',
  roughnessMap: '/textures/madeira/ash_veneer_rough_1k.webp',
}

function surfaceUrls(): Record<string, string> {
  const urls: Record<string, string> = {}
  for (const [key, { name, res, color }] of Object.entries(SURFACES)) {
    if (color) urls[`${key}.map`] = `/textures/sala/${name}_diff_${res}.webp`
    urls[`${key}.normalMap`] = `/textures/sala/${name}_nor_gl_${res}.webp`
    urls[`${key}.roughnessMap`] = `/textures/sala/${name}_rough_${res}.webp`
  }
  for (const [slot, url] of Object.entries(OAK)) urls[`oak.${slot}`] = url
  return urls
}

const URLS = surfaceUrls()

/** Repetição de cada textura: as UVs das peças estão em metros */
function tileOf(key: string): number {
  const surface = key.split('.')[0]
  return surface === 'oak' ? 0.6 : SURFACES[surface as SurfaceName].tile
}

/**
 * Chamado pelo useTexture antes de as texturas irem para a GPU. O tipo diz objeto por chave,
 * mas o drei passa a lista; nos dois casos Object.values segue a ordem das URLs.
 */
function configureTextures(loaded: Record<string, Texture> | Texture[]) {
  const keys = Object.keys(URLS)
  Object.values(loaded).forEach((texture, index) => {
    const key = keys[index]
    // O folheado é o mesmo objeto do quadro (cache por URL): a sala usa uma cópia (createMaterials)
    if (texture.userData.configured || key.startsWith('oak.')) return
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.repeat.setScalar(1 / tileOf(key))
    // O three limita ao máximo da placa
    texture.anisotropy = 8
    if (key.endsWith('.map')) texture.colorSpace = SRGBColorSpace
    texture.userData.configured = true
    texture.needsUpdate = true
  })
}

interface RoomProps {
  group: RefObject<Group | null>
  /** Recebe os materiais da sala: quem anima a cena muda a opacidade deles (a sala some e volta) */
  materialsRef: RefObject<Material[]>
}

/**
 * Sala de estar realista: parede de reboco, piso de madeira, tapete felpudo, sofá de lã com
 * almofadas de linho, planta e mesa lateral com vaso. Sombras de contato pintadas embaixo das
 * peças: a sombra da luz principal sozinha deixa os móveis "flutuando".
 */
export function Room({ group, materialsRef }: RoomProps) {
  const textures = useTexture(URLS, configureTextures)
  const plant = useGLTF(PLANT_URL)
  const vase = useGLTF(VASE_URL)

  const materials = useMemo(() => createMaterials(textures), [textures])
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials])

  // Os modelos projetam e recebem sombra; os materiais deles também somem com a sala
  useLayoutEffect(() => {
    const modelMaterials: Material[] = []
    for (const scene of [plant.scene, vase.scene]) {
      scene.traverse((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = true
        mesh.receiveShadow = true
        for (const material of [mesh.material].flat()) {
          material.userData.alphaTest ??= material.alphaTest
          modelMaterials.push(material)
        }
      })
    }
    materialsRef.current = [...Object.values(materials), ...modelMaterials]
  }, [materials, plant.scene, vase.scene, materialsRef])

  const geometries = useMemo(() => createGeometries(), [])
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries])

  const { wallZ, floorY } = ROOM
  const sofaZ = wallZ + SOFA.depth / 2 + 0.05

  return (
    <group ref={group}>
      {/* Parede, rodapé e piso */}
      <mesh geometry={geometries.wall} position={[0, floorY + 3, wallZ]} material={materials.wall} receiveShadow />
      <mesh geometry={geometries.floor} position={[0, floorY, wallZ + 4]} rotation={[-Math.PI / 2, 0, 0]} material={materials.floor} receiveShadow />
      <mesh position={[0, floorY + 0.05, wallZ + 0.008]} material={materials.baseboard} receiveShadow>
        <boxGeometry args={[12, 0.1, 0.016]} />
      </mesh>
      {/* Canto parede-piso um pouco mais escuro: a luz chega menos ali */}
      <mesh geometry={geometries.cornerWall} position={[0, floorY + 0.25, wallZ + 0.017]} material={materials.cornerWall} renderOrder={1} />
      <mesh geometry={geometries.cornerFloor} position={[0, floorY + 0.002, wallZ + 0.2]} rotation={[-Math.PI / 2, 0, 0]} material={materials.cornerFloor} renderOrder={1} />

      {/* Tapete felpudo */}
      <mesh geometry={geometries.rug} position={[0, floorY + 0.007, wallZ + 1.05]} material={materials.rug} receiveShadow />

      {/* Sofá de 2,20 m centrado embaixo do quadro */}
      <group position={[0, floorY, sofaZ]}>
        <mesh geometry={geometries.sofaShadow} position={[0, 0.016, 0.02]} rotation={[-Math.PI / 2, 0, 0]} material={materials.contact} renderOrder={2} />
        <Sofa geometries={geometries} materials={materials} />
      </group>

      {/* Planta à esquerda */}
      <group position={[-1.5, floorY, wallZ + 0.45]} rotation={[0, 0.6, 0]}>
        <mesh geometry={geometries.roundShadow} position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.95} material={materials.contact} renderOrder={2} />
        <primitive object={plant.scene} scale={1.2} />
      </group>

      {/* Mesa lateral com vaso, à direita */}
      <group position={[1.42, floorY, wallZ + 0.38]}>
        <mesh geometry={geometries.roundShadow} position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.85} material={materials.contact} renderOrder={2} />
        <SideTable materials={materials} />
        <primitive object={vase.scene} position={[0.02, SIDE_TABLE.height + 0.012, 0]} scale={0.85} />
      </group>
    </group>
  )
}

/** Opacidade da sala (0–1): troca para transparente só durante o fade, para a sala inteira ordenar certo quando está opaca */
export function fadeRoom(materials: Material[], opacity: number) {
  for (const material of materials) {
    const base = (material.userData.opacity as number | undefined) ?? 1
    // userData.alpha: a textura tem recorte (a camada da frente da foto), sempre transparente
    const transparent = base < 1 || opacity < 0.999 || material.userData.alpha === true
    if (material.transparent !== transparent) {
      material.transparent = transparent
      material.needsUpdate = true
    }
    material.opacity = base * opacity
    // Folhas recortadas por alpha: o recorte acompanha o fade, senão somem de uma vez na metade
    const alphaTest = material.userData.alphaTest as number | undefined
    if (alphaTest) material.alphaTest = alphaTest * opacity
  }
}

// ─── Sofá ────────────────────────────────────────────────────────────────────

/** Sofá moderno de três lugares (m): base, braços largos, assentos e encostos soltos */
const SOFA = { width: 2.2, depth: 0.92, legs: 0.08, baseTop: 0.3, arm: 0.2, armTop: 0.62, seat: 0.17, back: 0.46 }

/** Mesa lateral redonda, de pé central */
const SIDE_TABLE = { height: 0.56, radius: 0.24 }

type Geometries = ReturnType<typeof createGeometries>
type Materials = ReturnType<typeof createMaterials>

function Sofa({ geometries, materials }: { geometries: Geometries; materials: Materials }) {
  const { width, depth, legs, baseTop, arm, seat } = SOFA
  const inner = width - arm * 2
  const seatWidth = inner / 3
  const backDepth = 0.18
  const seatDepth = depth - backDepth
  const seatTop = baseTop + seat
  const seatZ = -depth / 2 + backDepth + seatDepth / 2

  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={geometries.leg} position={[sx * (width / 2 - 0.09), legs / 2, sz * (depth / 2 - 0.09)]} material={materials.leg} castShadow />
        )),
      )}
      <mesh geometry={geometries.sofaBase} position={[0, legs + (baseTop - legs) / 2, 0]} material={materials.sofa} castShadow receiveShadow />
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={geometries.sofaArm} position={[side * (width / 2 - arm / 2), legs + (SOFA.armTop - legs) / 2, 0]} material={materials.sofa} castShadow receiveShadow />
      ))}
      <mesh geometry={geometries.sofaBack} position={[0, baseTop + 0.21, -depth / 2 + backDepth / 2]} material={materials.sofa} castShadow receiveShadow />
      {[-1, 0, 1].map((slot) => (
        <mesh key={`seat${slot}`} geometry={geometries.seatCushion} position={[slot * seatWidth, baseTop + seat / 2, seatZ]} material={materials.sofa} castShadow receiveShadow />
      ))}
      {[-1, 0, 1].map((slot) => (
        <mesh
          key={`back${slot}`}
          geometry={geometries.backCushion}
          position={[slot * seatWidth, seatTop + SOFA.back / 2 - 0.02, -depth / 2 + backDepth + 0.08]}
          rotation={[-0.13, 0, 0]}
          material={materials.sofa}
          castShadow
          receiveShadow
        />
      ))}
      {/* Almofadas soltas, encostadas e um pouco tortas */}
      <mesh geometry={geometries.pillow} position={[-0.62, seatTop + 0.22, 0.0]} rotation={[-0.32, 0.18, 0.05]} material={materials.pillowRust} castShadow receiveShadow />
      <mesh geometry={geometries.pillowSmall} position={[-0.3, seatTop + 0.17, 0.07]} rotation={[-0.38, 0.05, -0.08]} material={materials.pillowTeddy} castShadow receiveShadow />
      <mesh geometry={geometries.pillow} position={[0.64, seatTop + 0.22, 0.0]} rotation={[-0.3, -0.2, -0.04]} material={materials.pillowSage} castShadow receiveShadow />
    </group>
  )
}

function SideTable({ materials }: { materials: Materials }) {
  const { height, radius } = SIDE_TABLE
  return (
    <group>
      <mesh position={[0, 0.01, 0]} material={materials.oak} castShadow receiveShadow>
        <cylinderGeometry args={[0.17, 0.18, 0.02, 48]} />
      </mesh>
      <mesh position={[0, height / 2, 0]} material={materials.oak} castShadow>
        <cylinderGeometry args={[0.028, 0.034, height, 24]} />
      </mesh>
      <mesh position={[0, height - 0.012, 0]} material={materials.oak} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius - 0.006, 0.024, 64]} />
      </mesh>
    </group>
  )
}

// ─── Geometrias e materiais ──────────────────────────────────────────────────

/** Plano com UVs em metros (como as do softBox) */
function plane(width: number, height: number): BufferGeometry {
  const geometry = new PlaneGeometry(width, height)
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width, uv.getY(i) * height)
  return geometry
}

function createGeometries() {
  const { width, depth, legs, baseTop, arm, armTop, seat, back } = SOFA
  const inner = width - arm * 2
  const seatWidth = inner / 3 - 0.008
  return {
    wall: plane(12, 6),
    floor: plane(12, 8),
    cornerWall: new PlaneGeometry(12, 0.5),
    cornerFloor: new PlaneGeometry(12, 0.4),
    rug: softBox({ size: [2.9, 0.014, 1.9], radius: 0.007, puff: [0, 0.002, 0], segments: { edge: 2, face: 4 } }),
    leg: new CylinderGeometry(0.022, 0.016, legs, 16),
    sofaBase: softBox({ size: [width - 0.04, baseTop - legs, depth - 0.02], radius: 0.035, puff: [0, 0.004, 0.008] }),
    sofaArm: softBox({ size: [arm, armTop - legs, depth], radius: 0.075, puff: [0.012, 0.018, 0.01] }),
    sofaBack: softBox({ size: [inner + 0.02, 0.42, 0.18], radius: 0.05, puff: [0, 0.01, 0.01] }),
    seatCushion: softBox({ size: [seatWidth, seat, depth - 0.2], radius: 0.06, puff: [0.008, 0.03, 0.014] }),
    backCushion: softBox({ size: [seatWidth, back, 0.2], radius: 0.075, puff: [0.008, 0.012, 0.045] }),
    // Almofadas: borda fina e miolo cheio (as pontas ficam "beliscadas", como as de verdade)
    pillow: softBox({ size: [0.46, 0.46, 0.05], radius: 0.024, puff: [0.004, 0.004, 0.065], segments: { edge: 3, face: 10 } }),
    pillowSmall: softBox({ size: [0.36, 0.36, 0.045], radius: 0.022, puff: [0.004, 0.004, 0.05], segments: { edge: 3, face: 10 } }),
    sofaShadow: new PlaneGeometry(width + 0.25, depth + 0.3),
    roundShadow: new PlaneGeometry(0.9, 0.9),
  }
}

function createMaterials(textures: Record<string, Texture>) {
  // Cópia com a repetição da sala; a imagem continua compartilhada com o quadro
  const own = (key: string) => {
    const texture = textures[key]
    if (!texture || !key.startsWith('oak.')) return texture ?? null
    const copy = texture.clone()
    copy.wrapS = copy.wrapT = RepeatWrapping
    copy.repeat.setScalar(1 / tileOf(key))
    copy.anisotropy = 8
    copy.colorSpace = key.endsWith('.map') ? SRGBColorSpace : texture.colorSpace
    copy.needsUpdate = true
    return copy
  }
  const set = (surface: string, normalScale = 1) => ({
    map: own(`${surface}.map`),
    normalMap: own(`${surface}.normalMap`),
    roughnessMap: own(`${surface}.roughnessMap`),
    normalScale: new Vector2(normalScale, normalScale),
  })
  const fabric = (surface: string, color: string, sheenColor: string) =>
    new MeshPhysicalMaterial({ ...set(surface), color, roughness: 1, sheen: 1, sheenRoughness: 0.75, sheenColor })

  // Sombras pintadas: cor quente (a luz da sala é amarelada) e o desenho no alphaMap
  const shadow = (alphaMap: Texture, color: string, opacity: number) => {
    const material = new MeshBasicMaterial({ alphaMap, color, depthWrite: false, transparent: true })
    material.userData.opacity = opacity
    return material
  }
  const corner = cornerShadeTexture()
  const cornerFloor = corner.clone()
  // No piso, o escuro fica do lado da parede (o plano deitado inverte o "para cima" da textura)
  cornerFloor.flipY = false

  return {
    wall: new MeshStandardMaterial({ ...set('wall', 0.35), color: '#e9dccb', roughness: 1 }),
    floor: new MeshStandardMaterial({ ...set('floor', 0.8), color: '#f2e6d8', roughness: 1 }),
    baseboard: new MeshStandardMaterial({ color: '#f5f1ea', roughness: 0.55 }),
    rug: new MeshStandardMaterial({ ...set('teddy', 1.2), color: '#f1e3cd', roughness: 1 }),
    sofa: fabric('wool', '#958270', '#dccdbb'),
    pillowSage: fabric('linen', '#b3b892', '#e6ead2'),
    pillowRust: fabric('linen', '#d27546', '#f7c2a0'),
    pillowTeddy: fabric('teddy', '#f6e8d2', '#fff6ea'),
    leg: new MeshStandardMaterial({ color: '#2a211b', roughness: 0.45, metalness: 0.1 }),
    oak: new MeshStandardMaterial({ ...set('oak'), color: '#e9d2b8', roughness: 1 }),
    contact: shadow(contactShadowTexture(), '#2e2219', 0.6),
    cornerWall: shadow(corner, '#4a3a2b', 0.28),
    cornerFloor: shadow(cornerFloor, '#4a3a2b', 0.22),
  }
}

/**
 * Sombra de contato (alphaMap: branco = sombra): retângulo de pontas arredondadas bem desfocado.
 * Desenhado com a sombra do canvas, que funciona em todo navegador (o `filter` do canvas não).
 */
function contactShadowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')!
  context.fillStyle = '#000'
  context.fillRect(0, 0, 256, 256)
  context.shadowColor = '#fff'
  context.shadowBlur = 34
  context.shadowOffsetX = 1000
  context.beginPath()
  context.roundRect(46 - 1000, 50, 164, 156, 44)
  context.fill()
  return new CanvasTexture(canvas)
}

/** Faixa (alphaMap) que escurece rápido perto do canto parede-piso, como a oclusão de verdade */
function cornerShadeTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 128
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(0, 0, 0, 128)
  gradient.addColorStop(0, '#000')
  gradient.addColorStop(0.55, '#1a1a1a')
  gradient.addColorStop(0.85, '#6e6e6e')
  gradient.addColorStop(1, '#fff')
  context.fillStyle = gradient
  context.fillRect(0, 0, 4, 128)
  return new CanvasTexture(canvas)
}
