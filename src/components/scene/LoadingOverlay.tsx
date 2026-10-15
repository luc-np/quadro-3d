import { useProgress } from '@react-three/drei'
import { LoadingScreen } from './LoadingScreen'

/** Progresso real das texturas e do HDR; some quando tudo carregou. */
export function LoadingOverlay() {
  const { active, progress } = useProgress()
  return <LoadingScreen progress={progress} hidden={!active && progress === 100} />
}
