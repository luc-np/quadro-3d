import { Suspense, type ReactNode, type RefObject } from 'react'
import { NeutralToneMapping, type DirectionalLight } from 'three'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { LoadingOverlay } from './LoadingOverlay'
import type { Vec3 } from './models/types'
import { SCENE_BACKGROUND } from './theme'

export interface LightSetup {
  position: Vec3
  intensity: number
}

/**
 * Ponto de vista: de frente, um pouco à direita e acima. Daqui só vale a direção;
 * cada cena ajusta a distância para o quadro caber no viewport (fitDistance, em layout.ts).
 */
export const CAMERA = { position: [0.41, 0.18, 1.3] satisfies Vec3, fov: 35, near: 0.01, far: 20 }

/** O HDR de estúdio faz a luz ambiente; reduzido para a arte não estourar */
export const ENVIRONMENT_INTENSITY = 0.22
/** O softbox principal do HDR fica atrás do quadro; meia volta o traz para a frente, do lado da luz principal */
export const ENVIRONMENT_ROTATION: Vec3 = [0, Math.PI, 0]

/** Luz principal, de cima e da direita: desenha a sombra do vão entre a tela e a moldura */
export const KEY_LIGHT: LightSetup = { position: [2, 1.5, 2], intensity: 1 }

/**
 * Luz rasante da esquerda, ~10° do plano da tela: realça o relevo da trama, mais ainda com o
 * quadro girando. Fica ~7,5° abaixo do centro do quadro, o espelho da altura da câmera: assim o
 * reflexo dela no vidro passa pelo meio do quadro quando ele vira, e não pela borda de cima.
 */
export const GRAZING_LIGHT: LightSetup = { position: [-2, -0.27, 0.35], intensity: 0.8 }

/** Preenchimento por trás, fraco e sem sombra: o verso (MDF, chassi) fica legível na visualização 360° */
export const BACK_LIGHT: LightSetup = { position: [-1, 1.2, -2], intensity: 1.1 }

/** Câmera de sombra justa no quadro: ±0,5 m em 2048 px dá ~0,5 mm por texel, o vão tem 8 mm */
export const SHADOW = { mapSize: 2048, extent: 0.5, near: 1, far: 6, bias: -0.0002, normalBias: 0.0005 }

/**
 * Canvas, câmera e iluminação comuns a todas as cenas do quadro.
 * O conteúdo entra no mesmo Suspense do HDR: aparece já com texturas e luz finais.
 */
interface StudioProps {
  children: ReactNode
  /** Meia largura (m) da área com sombra; a padrão cobre só o quadro (cenas com sala usam mais) */
  shadowExtent?: number
  /**
   * Elemento que recebe os eventos de ponteiro, no lugar do container do Canvas. O R3F reconecta
   * os eventos a cada render do Canvas; com o ScrollControls, apontar para a área que rola evita
   * que essa reconexão tire o scroll dela. O Canvas fica com pointer-events: none (o alvo precisa
   * declarar `auto`).
   */
  eventSource?: RefObject<HTMLElement | null>
  /** Recebe a luz principal: cenas que mudam de ambiente podem trocar a direção dela */
  keyLightRef?: RefObject<DirectionalLight | null>
  /** Luz ambiente: o HDR de estúdio (1,7 MB) ou os rebatedores feitos na cena (na loja) */
  environment?: 'hdr' | 'lightformers'
}

export function Studio({ children, shadowExtent = SHADOW.extent, eventSource, keyLightRef, environment = 'hdr' }: StudioProps) {
  // Área maior, texel maior: a folga contra "acne" (listras de auto-sombra) cresce junto
  const texelScale = shadowExtent / SHADOW.extent
  return (
    <div className="relative h-full w-full">
      <Canvas
        // Só renderiza quando algo muda (scroll, animação em curso, resize): parado, a GPU descansa
        frameloop="demand"
        // PCFSoftShadowMap (padrão de `shadows`) foi removido no three r186
        shadows="percentage"
        // Neutral (Khronos PBR Neutral) preserva as cores da arte; o ACES padrão desbota e puxa o matiz
        gl={{ toneMapping: NeutralToneMapping }}
        dpr={[1, 2]}
        camera={CAMERA}
        eventSource={eventSource as RefObject<HTMLElement> | undefined}
      >
        <color attach="background" args={[SCENE_BACKGROUND]} />

        <directionalLight
          ref={keyLightRef}
          {...KEY_LIGHT}
          castShadow
          shadow-mapSize={[SHADOW.mapSize, SHADOW.mapSize]}
          shadow-bias={SHADOW.bias}
          shadow-normalBias={SHADOW.normalBias * texelScale}
          // Sombra mais macia na área maior (a sala): o desfoque do PCF é medido em texels
          shadow-radius={Math.max(1, texelScale * 0.9)}
        >
          {/* Via args porque mudar left/right por props não recalcula a projeção */}
          <orthographicCamera
            key={shadowExtent}
            attach="shadow-camera"
            args={[-shadowExtent, shadowExtent, shadowExtent, -shadowExtent, SHADOW.near, SHADOW.far]}
          />
        </directionalLight>
        <directionalLight {...GRAZING_LIGHT} />
        <directionalLight {...BACK_LIGHT} />

        <Suspense fallback={null}>
          {environment === 'hdr' ? (
            // HDR local: o preset "studio" baixaria do raw.githack.com a cada visita
            <Environment
              files="/hdri/studio_small_03_1k.hdr"
              environmentIntensity={ENVIRONMENT_INTENSITY}
              environmentRotation={ENVIRONMENT_ROTATION}
            />
          ) : (
            <StudioLight />
          )}
          {children}
        </Suspense>
      </Canvas>
      <LoadingOverlay />
    </div>
  )
}

/**
 * Luz ambiente de estúdio feita na própria cena (no lugar do HDR de 1,7 MB): um softbox grande
 * na frente e acima, rebatedores nas laterais e o chão claro. Ilumina por igual e dá o reflexo
 * do vidro, sem baixar arquivo. É a do visualizador da loja.
 */
export function StudioLight() {
  return (
    <Environment resolution={256} environmentIntensity={ENVIRONMENT_INTENSITY * 4}>
      <Lightformer form="rect" intensity={3} position={[0.6, 1.6, 3]} scale={[4, 2.5, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.2} position={[-3, 0.3, 1]} scale={[2, 3, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0.8} position={[3, 0.3, -0.5]} scale={[2, 3, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0.5} position={[0, -2.5, 0.5]} scale={[6, 6, 1]} target={[0, 0, 0]} color="#f2e8dc" />
      <Lightformer form="rect" intensity={0.6} position={[0, 0.5, -3]} scale={[5, 3, 1]} target={[0, 0, 0]} />
    </Environment>
  )
}
