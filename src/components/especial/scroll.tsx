import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { FRAME_ORDER } from '@/components/scene/timeline'

/** Progresso da história (0–1), amortecido; `target` é o da rolagem, sem amortecer */
export interface StoryScrollState {
  offset: number
  target: number
}

const StoryContext = createContext<RefObject<StoryScrollState> | null>(null)

/**
 * Fornece um progresso da história vindo de outro lugar (sem rolagem própria): a página imersiva
 * usa para animar a embalagem (Crate, Guards) na pergunta "Chega inteiro?"
 */
export function StoryValue({ value, children }: { value: RefObject<StoryScrollState>; children: ReactNode }) {
  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>
}

/** O progresso da história (ref), lido nos frames (useFrame) de quem anima */
export function useStory(): RefObject<StoryScrollState> {
  const storyRef = useContext(StoryContext)
  if (!storyRef) throw new Error('useStory fora do <StoryScroll>')
  return storyRef
}

interface StoryScrollProps {
  /** Trilho da história: um bloco alto na página, que rola por baixo da cena presa (sticky) */
  trackRef: RefObject<HTMLElement | null>
  /** Palco preso na tela: a altura dele é a "tela" da história */
  stageRef: RefObject<HTMLElement | null>
  damping?: number
  children: ReactNode
}

/**
 * Liga a cena à rolagem da página (no lugar do ScrollControls, que tem uma área de rolagem
 * própria e não convive com o cabeçalho e o rodapé da loja). 0 quando o trilho encosta no topo
 * do palco; 1 quando o fim do trilho chega no fim do palco.
 */
export function StoryScroll({ trackRef, stageRef, damping = 0.18, children }: StoryScrollProps) {
  const invalidate = useThree((state) => state.invalidate)
  const storyRef = useRef<StoryScrollState>({ offset: 0, target: 0 })

  useEffect(() => {
    const read = () => {
      const track = trackRef.current
      const stage = stageRef.current
      if (!track || !stage) return
      const trackBox = track.getBoundingClientRect()
      const stageBox = stage.getBoundingClientRect()
      const distance = trackBox.height - stageBox.height
      storyRef.current.target = distance > 0 ? Math.min(1, Math.max(0, (stageBox.top - trackBox.top) / distance)) : 0
      invalidate()
    }
    read()
    // A primeira leitura já posiciona (abrir a página no meio da história não anima do começo)
    storyRef.current.offset = storyRef.current.target
    // Em captura: pega também a rolagem de um contêiner (no computador, o tema da loja rola o
    // .page-wrapper, não a janela; o evento de scroll de um elemento não sobe até a janela)
    window.addEventListener('scroll', read, { passive: true, capture: true })
    window.addEventListener('resize', read)
    return () => {
      window.removeEventListener('scroll', read, { capture: true })
      window.removeEventListener('resize', read)
    }
  }, [trackRef, stageRef, invalidate])

  // Antes das animações (prioridade negativa): quem lê o offset no mesmo frame já vê o novo
  useFrame((_, delta) => {
    const story = storyRef.current
    // O passo real (até 0,1 s): o amortecimento só aproxima do alvo, um passo grande não pula nada
    easing.damp(story, 'offset', story.target, damping, Math.min(delta, 0.1))
    if (Math.abs(story.offset - story.target) > 1e-5) invalidate()
  }, FRAME_ORDER.scroll)

  return <StoryContext.Provider value={storyRef}>{children}</StoryContext.Provider>
}
