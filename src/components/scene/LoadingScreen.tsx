import { SCENE_BACKGROUND } from './theme'

interface LoadingScreenProps {
  /** 0–100; sem valor, só o texto (ex.: enquanto o código da cena ainda baixa) */
  progress?: number
  /** Esconde com fade (sem fade se o usuário pede menos movimento) */
  hidden?: boolean
}

/** Tela de carregamento na cor da cena: o quadro aparece no lugar dela sem salto de cor. */
export function LoadingScreen({ progress, hidden = false }: LoadingScreenProps) {
  return (
    <div
      role="status"
      className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 font-sans text-sm text-neutral-600 motion-safe:transition-[opacity,visibility] motion-safe:duration-500 ${hidden ? 'invisible opacity-0' : ''}`}
      style={{ background: SCENE_BACKGROUND }}
    >
      <span>Carregando o quadro…</span>
      <span aria-hidden className="h-0.5 w-32 overflow-hidden rounded-full bg-neutral-300">
        <span
          className="block h-full bg-neutral-900 motion-safe:transition-[width]"
          style={{ width: `${progress ?? 0}%` }}
        />
      </span>
    </div>
  )
}
