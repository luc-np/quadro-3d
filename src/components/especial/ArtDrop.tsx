import { useEffect, useState } from 'react'
import type { CustomArt } from './customArt'

/**
 * A foto do cliente no personalizado: o bloco "Sua foto" do painel de compra, o botão do topo e o
 * aviso de soltar (a página inteira aceita a foto arrastada, no computador). O estado e o trabalho
 * ficam em customArt.ts.
 */

/** "Ótima resolução para 40×60 cm." e, no envio por e-mail, o lembrete do e-mail */
function qualityText(custom: CustomArt): string | null {
  const { quality, cm, envio } = custom
  if (!quality) return null
  const size = `${cm.w}×${cm.h} cm`
  if (quality.level === 'low') {
    return (
      `Pouca resolução para ${size}. Pode seguir: nossa equipe trata e melhora a foto antes de produzir.` +
      (envio === 'email' ? ' Depois da compra, envie por e-mail a foto original, na maior resolução que tiver.' : '')
    )
  }
  return `${quality.label} resolução para ${size}.` + (envio === 'email' ? ' Depois da compra, é só enviar esta foto original por e-mail.' : '')
}

/** O que aparece ao lado do título "Sua foto" */
function statusText(custom: CustomArt): string {
  if (!custom.slot) return custom.required ? 'Falta enviar' : 'Opcional'
  if (custom.envio === 's3') {
    if (custom.progress !== null) return `Enviando… ${custom.progress}%`
    if (custom.uploaded) return 'Enviada'
  }
  return custom.quality ? `${custom.quality.label} resolução` : ''
}

/** Bloco "Sua foto" do painel de compra */
export function ArtGroup({ custom }: { custom: CustomArt }) {
  const { slot, art, cm } = custom
  const quality = qualityText(custom)

  return (
    <div>
      <p className="mb-2.5 flex items-baseline justify-between text-[11px] font-semibold tracking-[0.24em] text-[#8a7d6c] uppercase">
        Sua foto
        <span className="text-xs font-medium tracking-normal text-[#2a2520] normal-case">{statusText(custom)}</span>
      </p>

      {slot && art ? (
        <div className="flex items-center gap-4 rounded-2xl border border-[#e4dccf] bg-white/70 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), fora do Next na loja */}
          <img
            src={art}
            alt="A sua foto, no enquadramento escolhido"
            className="h-20 w-auto max-w-24 shrink-0 rounded-md object-cover shadow-[0_6px_14px_-8px_rgba(42,37,32,0.6)]"
            style={{ aspectRatio: `${cm.w} / ${cm.h}` }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{slot.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={custom.adjust}
                disabled={custom.opening}
                className="h-11 rounded-full border border-[#2a2520] px-4 text-xs font-semibold tracking-[0.12em] uppercase transition hover:bg-[#2a2520] hover:text-white disabled:opacity-50"
              >
                Ajustar
              </button>
              <button
                type="button"
                onClick={custom.choose}
                disabled={custom.opening}
                className="h-11 rounded-full border border-[#d9cfc1] px-4 text-xs font-semibold tracking-[0.12em] uppercase transition hover:border-[#2a2520] disabled:opacity-50"
              >
                Trocar foto
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={custom.choose}
          disabled={custom.opening}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#c9bca9] bg-white/60 px-4 py-6 text-center transition hover:border-[#2a2520] disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mb-1 text-[#c85f12]">
            <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
          <span className="text-sm font-semibold">{custom.opening ? 'Abrindo a foto…' : 'Envie sua foto'}</span>
          <span className="text-xs text-[#8a7d6c]">
            JPG ou PNG<span className="hidden [@media(hover:hover)]:inline"> · ou arraste a foto para a página</span>
          </span>
        </button>
      )}

      {custom.envio === 's3' && custom.progress !== null && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#e4dccf]" role="progressbar" aria-label="Envio da foto" aria-valuenow={custom.progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[#2a2520] transition-[width]" style={{ width: `${custom.progress}%` }} />
        </div>
      )}
      <div aria-live="polite">
        {quality && (
          <p className={`mt-3 text-[13px] leading-relaxed text-pretty ${custom.quality?.level === 'low' ? 'text-[#a3441a]' : 'text-[#5a534e]'}`}>{quality}</p>
        )}
        {custom.error && <p className="mt-3 text-[13px] leading-relaxed text-[#a3441a]">{custom.error}</p>}
      </div>
    </div>
  )
}

/** Celular: botão do topo, embaixo do título (envia ou troca a foto sem rolar até a compra) */
export function HeroArtButton({ custom }: { custom: CustomArt }) {
  return (
    <button
      type="button"
      onClick={custom.choose}
      disabled={custom.opening}
      className="pointer-events-auto mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-[#2a2520] px-5 text-[11px] font-semibold tracking-[0.16em] text-white uppercase shadow-[0_12px_28px_-16px_rgba(42,37,32,0.8)] transition hover:bg-[#c85f12] disabled:opacity-60 md:hidden"
    >
      <UploadIcon size={16} />
      {custom.opening ? 'Abrindo a foto…' : custom.slot ? 'Trocar foto' : 'Envie sua foto'}
    </button>
  )
}

/**
 * Computador: cartão "Sua foto" à esquerda do quadro, entre "Cor da moldura" e "Vidro" (no
 * topo, embaixo do título, o botão encostaria no quadro, que lá é maior). Uma linha só, para
 * caber entre os dois cartões também em telas baixas (768 px).
 */
export function HeroArtPanel({ custom }: { custom: CustomArt }) {
  const { slot, art, cm } = custom
  return (
    <div className="especial-panel pointer-events-auto absolute top-[42.5%] left-[7%] hidden w-72 rounded-2xl border border-[#e4dccf] bg-white/85 p-4 shadow-[0_18px_40px_-24px_rgba(42,37,32,0.45)] backdrop-blur md:block">
      <p className="mb-3 flex items-baseline justify-between text-[11px] font-semibold tracking-[0.24em] text-[#8a7d6c] uppercase">
        Sua foto
        <span className="text-[10px] font-medium tracking-normal normal-case">{slot ? statusText(custom) : 'ou arraste para a página'}</span>
      </p>
      {slot && art ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), fora do Next na loja */}
          <img src={art} alt="" className="h-10 w-auto max-w-12 shrink-0 rounded object-cover" style={{ aspectRatio: `${cm.w} / ${cm.h}` }} />
          <button type="button" onClick={custom.adjust} disabled={custom.opening} className="h-10 flex-1 rounded-full border border-[#2a2520] text-xs font-medium transition hover:bg-[#2a2520] hover:text-white disabled:opacity-50">
            Ajustar
          </button>
          <button type="button" onClick={custom.choose} disabled={custom.opening} className="h-10 flex-1 rounded-full border border-[#d9cfc1] text-xs font-medium transition hover:border-[#2a2520] disabled:opacity-50">
            Trocar foto
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={custom.choose}
          disabled={custom.opening}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#2a2520] text-[11px] font-semibold tracking-[0.16em] text-white uppercase transition hover:bg-[#c85f12] disabled:opacity-60"
        >
          <UploadIcon size={16} />
          {custom.opening ? 'Abrindo a foto…' : 'Envie sua foto'}
        </button>
      )}
      {custom.error && <p className="mt-2 text-xs leading-relaxed text-[#a3441a]">{custom.error}</p>}
    </div>
  )
}

function UploadIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  )
}

/**
 * Arrastar a foto para qualquer ponto da janela (no computador): mostra o aviso e abre o
 * enquadramento ao soltar. Fora da página especial, soltar não troca a página pela foto.
 */
export function useArtDrop(custom: CustomArt): boolean {
  const [dragging, setDragging] = useState(false)
  const { on, open } = custom

  useEffect(() => {
    if (!on) return
    let depth = 0
    const withFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')
    const enter = (event: DragEvent) => {
      if (!withFiles(event)) return
      event.preventDefault()
      depth += 1
      setDragging(true)
    }
    const over = (event: DragEvent) => {
      if (!withFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const leave = (event: DragEvent) => {
      if (!withFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const drop = (event: DragEvent) => {
      if (!withFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      const file = event.dataTransfer?.files?.[0]
      if (file) open(file)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [on, open])

  return dragging
}

/** Aviso enquanto o cliente arrasta uma foto sobre a página */
export function DropVeil({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-[#2a2520]/35 p-6 backdrop-blur-sm">
      <div className="rounded-[1.75rem] border-2 border-dashed border-white/80 bg-[#fbf9f5]/95 px-8 py-7 text-center shadow-[0_24px_60px_-30px_rgba(42,37,32,0.7)]">
        <p className="text-xl font-light tracking-tight">
          Solte a foto para ver <em className="font-semibold text-[#c85f12] not-italic">no quadro</em>
        </p>
        <p className="mt-1.5 text-xs text-[#8a7d6c]">Depois, é só ajustar o enquadramento</p>
      </div>
    </div>
  )
}
