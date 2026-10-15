'use client'

import { useLayoutEffect } from 'react'
import { Vector3 } from 'three'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Frame } from './Frame'
import { fitDistance, frameExtent } from './layout'
import type { ModelDef } from './models/types'
import { CAMERA, Studio } from './Studio'

/** Limites do zoom (m da câmera ao centro do quadro) */
const ORBIT = { minDistance: 0.4, maxDistance: 3 }

/** Inspeção livre do quadro: arraste para girar, role para aproximar. Sem roteiro de scroll. */
export default function ViewerScene({ model }: { model: ModelDef }) {
  return (
    <Studio>
      {/* Troque para explode={1} para conferir as camadas separadas */}
      <Frame model={model} explode={0} />
      <FitCamera model={model} />
      <OrbitControls makeDefault {...ORBIT} />
    </Studio>
  )
}

/** Recoloca a câmera para o quadro montado caber no viewport (ex.: celular em pé) a cada resize. */
function FitCamera({ model }: { model: ModelDef }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)

  useLayoutEffect(() => {
    const distance = fitDistance(frameExtent(model, 0, 1, 0), CAMERA.fov, size, size)
    camera.position.copy(new Vector3(...CAMERA.position).normalize().multiplyScalar(distance))
    invalidate()
  }, [camera, model, size, invalidate])

  return null
}
