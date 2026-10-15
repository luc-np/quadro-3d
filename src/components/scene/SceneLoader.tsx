'use client'

import dynamic from 'next/dynamic'
import { useSyncExternalStore, type ReactNode } from 'react'
import { LoadingScreen } from './LoadingScreen'
import { MODELS, type ModelId } from './models'
import { SceneBoundary } from './SceneBoundary'
import { StaticFrame } from './StaticFrame'

// O three.js só roda no navegador e é pesado: carrega fora do SSR e do bundle inicial.
// `ssr: false` só é permitido dentro de um client component, por isso este arquivo existe.
// Cada cena vira um chunk próprio: a landing não baixa o código da visualização livre e vice-versa.
const loading = () => <LoadingScreen />

const Scene = dynamic(() => import('./Scene'), { ssr: false, loading })
const ViewerScene = dynamic(() => import('./ViewerScene'), { ssr: false, loading })

let webgl2: boolean | undefined

/** O three r186 exige WebGL 2. O contexto de teste é liberado logo em seguida. */
function supportsWebGL2(): boolean {
  if (webgl2 === undefined) {
    try {
      const gl = document.createElement('canvas').getContext('webgl2')
      webgl2 = gl !== null
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      webgl2 = false
    }
  }
  return webgl2
}

const subscribeNever = () => () => {}

interface WithWebGLProps {
  /** Mostrado sem WebGL 2, ou se a cena falhar mesmo assim */
  fallback: ReactNode
  children: ReactNode
}

function WithWebGL({ fallback, children }: WithWebGLProps) {
  // null no servidor e na hidratação: decide só no navegador
  const webgl = useSyncExternalStore(subscribeNever, supportsWebGL2, () => null)
  if (webgl === null) return <LoadingScreen />
  if (!webgl) return fallback
  return <SceneBoundary fallback={fallback}>{children}</SceneBoundary>
}

/** Landing (/<modelo>): o quadro reage ao scroll */
export function SceneLoader({ model }: { model: ModelId }) {
  const definition = MODELS[model]
  return (
    <WithWebGL fallback={<StaticFrame model={definition} />}>
      <Scene model={definition} />
    </WithWebGL>
  )
}

/** Visualização livre (/<modelo>/360): arrastar para girar, rolar para aproximar */
export function ViewerLoader({ model }: { model: ModelId }) {
  const definition = MODELS[model]
  return (
    <WithWebGL fallback={<StaticFrame model={definition} />}>
      <ViewerScene model={definition} />
    </WithWebGL>
  )
}
