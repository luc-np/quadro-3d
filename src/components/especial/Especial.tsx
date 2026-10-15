'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { DirectionalLight } from 'three'
import { useTexture } from '@react-three/drei'
import { textureUrls } from '@/components/scene/materials'
import { configureModel, FINISHES } from '@/components/scene/models/configure'
import { FRAME_FINISHES } from '@/components/scene/models/surfaces'
import { Studio } from '@/components/scene/Studio'
import { BuyPanel } from './BuyPanel'
import { Details } from './Details'
import { Overlay } from './Overlay'
import { AMBIENT } from './PhotoRoom'
import { StoryScroll } from './scroll'
import { choiceOf, finishesOf, sizeMeters, sizesOf, takesGlass, variantOf, type Choice, type ShopData } from './shop'
import { advanceStops, PACK_STEPS, STORY_PAGES } from './story'
import { Story } from './StoryScene'

/**
 * Partes presas na moldura (grampos cravados nela, penduradores nas costas dela): continuam no
 * quadro, mas na vista por dentro andam junto com a moldura e não ganham explicação (era
 * informação demais)
 */
const ATTACHED_PARTS = ['grampos', 'penduradores']

/** Com o ambiente em foto, só o quadro faz sombra: a área da sombra pode ser justa (mais nítida) */
const SHADOW_EXTENT = AMBIENT.wide || AMBIENT.narrow ? 1.2 : 2.6

export interface EspecialProps {
  shop: ShopData
  /** Luz ambiente: o HDR (no Next) ou os rebatedores feitos na cena (na loja, sem baixar o HDR) */
  environment?: 'hdr' | 'lightformers'
  /** Altura (px) do cabeçalho fixo da loja: o palco da história fica logo abaixo dele */
  topOffset?: number
}

/**
 * Página especial de um produto: o quadro configurável no topo, com linhas saindo de cada parte
 * até as escolhas; rolando, ele gira, é pendurado no ambiente, se abre em camadas, é embalado e,
 * no fim, sai da caixa e vira a vitrine da compra, com o painel ao lado e o resto da página embaixo.
 *
 * A cena fica num palco preso na tela (sticky) enquanto um trilho alto rola por baixo; o
 * progresso da história é a posição do trilho (StoryScroll). A rolagem é a da própria página:
 * convive com o cabeçalho e o rodapé da loja.
 */
export default function Especial({ shop, environment = 'hdr', topOffset = 0 }: EspecialProps) {
  const [choice, setChoice] = useState<Choice>(() => choiceOf(shop, initialVariant(shop)))
  const keyLightRef = useRef<DirectionalLight | null>(null)
  // HTML por cima da cena: a animação acha os elementos pelos atributos data-* e os move a cada frame
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)

  const finishes = useMemo(() => finishesOf(shop), [shop])
  const sizes = useMemo(() => sizesOf(shop), [shop])
  const variant = variantOf(shop, choice)
  const model = useMemo(() => {
    const { width, height } = sizeMeters(choice.size, shop.art)
    const full = configureModel({ ...choice, glass: choice.glass && takesGlass(choice.finish), width, height, art: shop.art.url })
    const frame = full.parts.find((part) => part.id === 'moldura')
    if (!frame) return full
    return { ...full, parts: full.parts.map((part) => (ATTACHED_PARTS.includes(part.id) ? { ...part, explode: frame.explode } : part)) }
  }, [choice, shop.art])
  // As partes explicadas na vista por dentro
  const explained = useMemo(() => model.parts.filter((part) => !ATTACHED_PARTS.includes(part.id)), [model])

  // As texturas de todas as molduras começam a baixar já: trocar não deixa a cena esperando
  useEffect(() => {
    const urls = new Set<string>(Object.values(textureUrls(FRAME_FINISHES)))
    const { width, height } = sizeMeters(choice.size, shop.art)
    for (const finish of FINISHES) {
      for (const part of configureModel({ finish, color: 'preta', glass: takesGlass(finish), width, height, art: shop.art.url }).parts) {
        for (const url of Object.values(textureUrls(part.surfaces))) urls.add(url)
      }
    }
    urls.forEach((url) => useTexture.preload(url))
    // Só na abertura: o tamanho não muda as texturas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.art])

  // Como na página de produto da loja, a variante vai para o endereço (?variant=): o link abre a mesma escolha
  useEffect(() => {
    if (!variant) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('variant') === String(variant[0])) return
    url.searchParams.set('variant', String(variant[0]))
    window.history.replaceState(window.history.state, '', url)
  }, [variant])

  const pick = (next: Partial<Choice>) =>
    setChoice((current) => {
      const merged = { ...current, ...next }
      // Escolher vidro numa moldura sem vidro leva para a que tem (filete ou caixa ficam como estão)
      return { ...merged, glass: merged.glass && takesGlass(merged.finish) }
    })

  const glass = model.parts.some((part) => part.id === 'vidro')

  // Botão "Avançar" dos cartões: a página rola sozinha até a próxima parada (no fim, até a compra)
  const advance = () => {
    const track = trackRef.current
    const stage = stageRef.current
    if (!track || !stage) return
    const trackBox = track.getBoundingClientRect()
    const stageBox = stage.getBoundingClientRect()
    const distance = trackBox.height - stageBox.height
    const now = (stageBox.top - trackBox.top) / distance
    const steps = PACK_STEPS.filter((step) => glass || !step.glassOnly).map((step) => step.key)
    const next = advanceStops(explained.length, steps).find((stop) => stop > now + 0.004)
    const delta = next === undefined ? distance * (1 - now) + stageBox.height * 0.75 : distance * (next - now)
    scrollerOf(track).scrollBy({ top: delta, behavior: 'smooth' })
  }
  const stageHeight = 'calc(100svh - var(--esp-top))'

  return (
    <div className="bg-[#f4f1ec] font-[family-name:var(--font-especial)] text-[#2a2520]" style={{ '--esp-top': `${topOffset}px` } as CSSProperties}>
      {/* Uma coluna da largura da tela (minmax 0): o conteúdo não alarga a página no celular */}
      <div className="grid grid-cols-1">
        {/* Palco preso na tela: a cena e o HTML por cima dela */}
        <div
          ref={stageRef}
          className="sticky top-[var(--esp-top)] col-start-1 row-start-1 min-w-0 self-start overflow-hidden [&_canvas]:touch-pan-y"
          style={{ height: stageHeight }}
        >
          <Studio shadowExtent={SHADOW_EXTENT} keyLightRef={keyLightRef} environment={environment}>
            <StoryScroll trackRef={trackRef} stageRef={stageRef}>
              <Story model={model} overlayRef={overlayRef} keyLightRef={keyLightRef} />
            </StoryScroll>
          </Studio>
          <Overlay
            shop={shop}
            choice={choice}
            onPick={pick}
            finishes={finishes}
            sizes={sizes}
            price={variant?.[4] ?? null}
            rootRef={overlayRef}
            parts={explained}
            onAdvance={advance}
            glass={glass}
          />
        </div>

        {/* O que rola por cima do palco: o trilho da história (vazio) e, no fim, a compra */}
        <div className="pointer-events-none relative z-50 col-start-1 row-start-1 min-w-0">
          <div ref={trackRef} data-story-track style={{ height: `calc(${stageHeight} * ${STORY_PAGES})` }} />
          <div className="md:ml-[50%] md:w-1/2">
            <BuyPanel shop={shop} choice={choice} onPick={pick} finishes={finishes} sizes={sizes} variant={variant} />
          </div>
        </div>
      </div>

      <Details shop={shop} />
    </div>
  )
}

/**
 * Quem rola a página: o primeiro ancestral com rolagem própria (no computador, o tema da loja rola
 * o .page-wrapper; atravessa o Shadow DOM pelo host) ou o documento
 */
function scrollerOf(element: Element): Element {
  let node: Element | null = element
  while (node) {
    const style = getComputedStyle(node)
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node
    node = node.parentElement ?? ((node.getRootNode() as ShadowRoot).host as Element | undefined) ?? null
  }
  return document.scrollingElement ?? document.documentElement
}

/** A variante do endereço (?variant=), se for deste produto; senão, a que a loja abriu */
function initialVariant(shop: ShopData): number {
  const fromUrl = Number(new URLSearchParams(window.location.search).get('variant'))
  return shop.variants.some(([id]) => id === fromUrl) ? fromUrl : shop.selected
}
