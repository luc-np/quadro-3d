'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { DirectionalLight } from 'three'
import { useTexture } from '@react-three/drei'
import { assetUrl, textureUrls } from '@/components/scene/materials'
import { configureModel, FINISHES, type Finish } from '@/components/scene/models/configure'
import { FRAME_FINISHES } from '@/components/scene/models/surfaces'
import type { ModelDef } from '@/components/scene/models/types'
import { Studio } from '@/components/scene/Studio'
import { Details } from '@/components/especial/Details'
import { COLOR_LABEL } from '@/components/especial/labels'
import { AMBIENT, hangHeight } from '@/components/especial/PhotoRoom'
import { choiceOf, finishesOf, hasFrame, money, priceOf, sizeLabel, sizeMeters, sizesOf, takesGlass, variantOf, type Choice, type ShopData } from '@/components/especial/shop'
import { HangTag } from './HangTag'
import { ImersivoScene, measures, type AltModels, type StageInsets, type StoryState } from './ImersivoScene'
import { MODES, ROOM_MODES, type Mode } from './modes'
import { furnitureOf, ROOMS, sizedRoom, type RoomDef } from './rooms'
import { QUESTIONS, questionsOf, type Question } from './story'

/** Partes presas na moldura (como na página especial): andam com ela e não ganham "+" */
const ATTACHED_PARTS = ['grampos', 'penduradores']

/** Com o ambiente em foto, só o quadro faz sombra: a área da sombra pode ser justa */
const SHADOW_EXTENT = AMBIENT.wide || AMBIENT.narrow ? 1.2 : 2.6

/** Folga (px) entre o quadro e o HTML em volta dele no palco */
const GAP = 24

/** Onde a etiqueta de compra fica pendurada (px, do alto do palco): o barbante sobe até a borda */
const TAG_TOP = 56

/**
 * Telas ultralargas: o seletor, as etiquetas de cima e a etiqueta de compra ficam numa faixa de até
 * 1600 px no meio, perto do quadro (a foto continua de ponta a ponta). Abaixo disso, 0.
 */
const SIDE = 'max(0px, calc((100% - 1600px) / 2))'

/** Distância entre as peças de um conjunto (cm), a da conta da largura montada */
const KIT_GAP_CM = 4

export interface ImersivoProps {
  shop: ShopData
  /** Categoria do quadro, para a migalha (a mesma da página de produto) */
  crumb?: { title: string; url: string }
  /** Onde a página começa (px, do topo do documento): o palco ocupa o resto da tela */
  topOffset?: number
  /** Onde o palco fica preso ao rolar (px do topo da tela): logo abaixo do cabeçalho flutuante da loja */
  stickyTop?: number
}

/** O modelo 3D de uma peça (as partes presas na moldura andam com ela na vista por dentro) */
function buildModel(choice: Choice, shop: ShopData, art: string, overrides: Partial<Choice> = {}): ModelDef {
  const pick = { ...choice, ...overrides }
  const { width, height } = sizeMeters(pick.size, shop.art)
  const full = configureModel({ ...pick, glass: pick.glass && takesGlass(pick.finish), width, height, art })
  const frame = full.parts.find((part) => part.id === 'moldura')
  if (!frame) return full
  return { ...full, parts: full.parts.map((part) => (ATTACHED_PARTS.includes(part.id) ? { ...part, explode: frame.explode } : part)) }
}

/**
 * Página de produto imersiva: o quadro em 3D num palco que ocupa a tela, com o seletor de vistas
 * para vê-lo de frente (inclina com o mouse), na parede, por dentro e na escala do ambiente (que se
 * escolhe embaixo dessas duas), e a etiqueta de compra ao lado (no celular, embaixo). Rolando, o palco fica preso na tela e
 * responde as oito perguntas que decidem a compra, cada uma com uma animação. Depois, a descrição
 * e as avaliações.
 */
export default function Imersivo({ shop, crumb, topOffset = 0, stickyTop = 0 }: ImersivoProps) {
  const [choice, setChoice] = useState<Choice>(() => choiceOf(shop, initialVariant(shop)))
  const [mode, setMode] = useState<Mode>('frente')
  const [roomKey, setRoomKey] = useState(() => initialRoom(shop.room))
  // Largura do móvel escolhida em cada ambiente que tem mais de uma (sala: sofá; quarto: cama)
  const [furniture, setFurniture] = useState<Record<string, string>>(initialFurniture)
  const baseRoom = ROOMS.find((item) => item.key === roomKey) ?? ROOMS[0]!
  const room = useMemo(() => sizedRoom(baseRoom, furniture[baseRoom.key]), [baseRoom, furniture])
  const onWall = ROOM_MODES.includes(mode)
  // A lista de ambientes fica embaixo da vista com parede escolhida; indo para Frente ou Por dentro,
  // esmaece (200 ms) antes de sair
  const [roomsAt, setRoomsAt] = useState<Mode | null>(onWall ? mode : null)
  if (onWall && roomsAt !== mode) setRoomsAt(mode)
  useEffect(() => {
    if (onWall || roomsAt === null) return
    const timer = window.setTimeout(() => setRoomsAt(null), 200)
    return () => window.clearTimeout(timer)
  }, [onWall, roomsAt])
  const keyLightRef = useRef<DirectionalLight | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const annotationsRef = useRef<HTMLDivElement>(null)
  const questionRefs = useRef<(HTMLElement | null)[]>([])
  // Celular: os cards das perguntas ficam presos embaixo do palco (um por vez)
  const pinnedRef = useRef<HTMLDivElement>(null)
  // A altura da imagem na vitrine (no celular, o palco é mais alto que ela: o resto fica sob o seletor)
  const vitrineRef = useRef<HTMLDivElement>(null)
  const insetsRef = useRef<StageInsets>({ vitrine: { top: GAP, right: GAP, bottom: GAP, left: GAP }, story: { top: GAP, right: GAP, bottom: GAP, left: GAP } })
  const storyRef = useRef<StoryState>({ target: 0, offset: 0 })
  const coarse = useCoarsePointer()
  const wide = useWide()
  // A etiqueta de compra nunca rola por dentro: no computador, diminui por inteiro (até 72%) para
  // caber na altura da tela; se nem assim couber, o palco cresce com ela
  const [tag, setTag] = useState({ height: 0, scale: 1 })
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    const fit = () => {
      const natural = card.offsetHeight
      const desktop = window.matchMedia('(min-width: 48rem)').matches
      const room = window.innerHeight - topOffset - 12 - TAG_TOP - GAP
      const scale = desktop && natural > 0 ? Math.min(1, Math.max(0.72, room / natural)) : 1
      setTag((current) => (current.scale === scale && current.height === Math.ceil(natural * scale) ? current : { height: Math.ceil(natural * scale), scale }))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(card)
    window.addEventListener('resize', fit)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [topOffset])

  const finishes = useMemo(() => finishesOf(shop), [shop])
  const sizes = useMemo(() => sizesOf(shop), [shop])
  const variant = variantOf(shop, choice)
  // Uma arte por peça (duo e trio); sem a lista, uma peça só
  const arts = useMemo(() => (shop.arts && shop.arts.length > 0 ? shop.arts : [shop.art.url]), [shop.arts, shop.art.url])
  const models = useMemo(() => arts.map((art) => buildModel(choice, shop, art)), [arts, choice, shop])
  // As comparações (perguntas 06 e 07) e o canvas da pergunta 08, com a arte da 1ª peça
  const alt = useMemo<AltModels>(() => {
    const paper: Finish = choice.finish === 'filete' || choice.finish === 'caixa' ? choice.finish : 'filete'
    const glazed: Finish = takesGlass(choice.finish) ? choice.finish : 'caixa'
    const art = arts[0]!
    return {
      canvas: buildModel(choice, shop, art, { finish: 'canvas', glass: false }),
      paper: buildModel(choice, shop, art, { finish: paper, glass: false }),
      plain: buildModel(choice, shop, art, { finish: glazed, glass: false }),
      glazed: buildModel(choice, shop, art, { finish: glazed, glass: true }),
    }
  }, [arts, choice, shop])
  const size = measures(models[0]!)
  const pieces = models.length
  const setWidth = pieces * size.width + (pieces - 1) * KIT_GAP_CM

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

  // Como na página de produto da loja, a variante vai para o endereço (?variant=)
  useEffect(() => {
    if (!variant) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('variant') === String(variant[0])) return
    url.searchParams.set('variant', String(variant[0]))
    window.history.replaceState(window.history.state, '', url)
  }, [variant])

  // Área do palco coberta pelo HTML (na vitrine: o cartão, as abas e as etiquetas; nas perguntas: o
  // texto delas) e o progresso das perguntas, pela rolagem. A pergunta k vale `s = k` quando o
  // centro dela passa no ponto de foco: o meio do palco (computador) ou o meio da faixa abaixo dele (celular)
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const update = () => {
      const box = stage.getBoundingClientRect()
      const card = cardRef.current?.getBoundingClientRect()
      const tabs = tabsRef.current?.getBoundingClientRect()
      const top = topRef.current?.getBoundingClientRect()
      const desktop = window.matchMedia('(min-width: 48rem)').matches
      // A etiqueta ao lado do palco (computador); no celular ela vem embaixo, na folha que cobre o pé do palco
      const cardOver = desktop && card && card.width > 0 && card.left < box.right && card.top < box.bottom && card.bottom > box.top
      // As vistas: em coluna à esquerda (computador) ou em fileira embaixo (celular)
      const vertical = Boolean(tabs && tabs.height > tabs.width)
      // O card da pergunta (no computador, à esquerda do palco): a área dele fica livre do quadro
      const question = questionRefs.current[0]?.querySelector('article')?.getBoundingClientRect()
      const pinnedHeight = pinnedRef.current?.offsetHeight ?? 0
      insetsRef.current = {
        vitrine: {
          left: vertical && tabs ? tabs.right - box.left + GAP / 2 : GAP,
          right: cardOver ? box.right - card.left + GAP : GAP,
          top: top && top.height > 0 ? top.bottom - box.top + GAP / 2 : GAP,
          bottom: !vertical && tabs && tabs.height > 0 ? box.bottom - tabs.top + GAP / 2 : Math.max(GAP, box.height - (vitrineRef.current?.offsetHeight ?? box.height) + GAP / 2),
        },
        story: {
          left: desktop && question ? question.right - box.left + GAP : GAP,
          right: GAP,
          top: GAP,
          bottom: !desktop && pinnedHeight > 0 ? pinnedHeight + GAP / 2 : GAP,
        },
      }

      const centers = questionRefs.current.map((element) => {
        const rect = element?.getBoundingClientRect()
        return rect ? rect.top + rect.height / 2 : Infinity
      })
      const focus = box.top + box.height / 2
      let s = QUESTIONS
      if (centers[0]! > focus) {
        // Da vitrine até a 1ª pergunta: pela distância que a 1ª já andou desde o topo da página
        const scrolled = Math.max(0, topOffset - (rootRef.current?.getBoundingClientRect().top ?? topOffset))
        const start = centers[0]! + scrolled
        s = start > focus ? 1 - (centers[0]! - focus) / (start - focus) : 0
      } else {
        for (let k = 1; k < QUESTIONS; k++) {
          if (centers[k]! > focus) {
            s = k + (focus - centers[k - 1]!) / (centers[k]! - centers[k - 1]!)
            break
          }
        }
      }
      s = Math.min(QUESTIONS, Math.max(0, s))
      storyRef.current.target = s
      // A dica, a migalha e as vistas somem quando as perguntas começam
      stage.style.setProperty('--story', String(Math.min(1, s)))
      stage.dataset.story = s > 0.15 ? 'on' : 'off'
      // Celular: a faixa das perguntas sobe quando a etiqueta termina de passar por cima do palco;
      // dentro dela, só o texto troca (a pergunta mais perto aparece, as outras esmaecem)
      const band = pinnedRef.current
      if (band && !desktop) {
        const tagBottom = cardRef.current?.getBoundingClientRect().bottom ?? -Infinity
        const show = Math.min(1, Math.max(0, (box.bottom - tagBottom - 40) / 160)) * Math.min(1, s / 0.4)
        const eased = show * show * (3 - 2 * show)
        band.style.transform = `translateY(${(1 - eased) * 105}%)`
        band.style.visibility = eased > 0.001 ? 'visible' : 'hidden'
        band.querySelectorAll<HTMLElement>('[data-q]').forEach((text) => {
          const k = Number(text.dataset.q)
          const distance = k === 1 && s < 1 ? 0 : k === QUESTIONS && s > QUESTIONS ? 0 : Math.abs(s - k)
          const opacity = Math.min(1, Math.max(0, 1 - (distance - 0.3) / 0.2))
          text.style.opacity = String(opacity)
          text.style.visibility = opacity > 0.01 ? 'visible' : 'hidden'
        })
      }
    }
    update()
    storyRef.current.offset = storyRef.current.target
    const observer = new ResizeObserver(update)
    observer.observe(stage)
    if (cardRef.current) observer.observe(cardRef.current)
    if (topRef.current) observer.observe(topRef.current)
    window.addEventListener('scroll', update, { passive: true, capture: true })
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', update, { capture: true })
      window.removeEventListener('resize', update)
    }
  }, [mode, topOffset])

  // O ambiente escolhido vale nas duas vistas com parede, na troca de variante e nas outras páginas da visita
  const preload = (next: RoomDef) => preloadRoom(sizedRoom(next, furniture[next.key]))
  const chooseRoom = (next: RoomDef) => {
    preload(next)
    setRoomKey(next.key)
    try {
      sessionStorage.setItem(ROOM_KEY, next.key)
    } catch {
      // Sem armazenamento (aba privada, bloqueado): vale só nesta página
    }
  }
  // A largura do móvel vale para o ambiente, nas duas vistas com parede e na visita
  const chooseSize = (key: string) => {
    const next = { ...furniture, [baseRoom.key]: key }
    preloadRoom(sizedRoom(baseRoom, key))
    setFurniture(next)
    try {
      sessionStorage.setItem(FURNITURE_KEY, JSON.stringify(next))
    } catch {
      // Sem armazenamento: vale só nesta página
    }
  }

  // O tamanho que combina com a largura do móvel (a tabela do simulador do site antigo), se o quadro tiver ele
  const reco = useMemo(() => {
    const target = room.size?.reco
    if (!target) return null
    const dims = (value: string) => value.toLowerCase().split('x').map(Number).sort((a, b) => a - b).join('x')
    const size = sizes.find((value) => dims(value) === dims(target))
    if (!size || priceOf(shop, { ...choice, size }) === null) return null
    return { size, label: sizeLabel(size, shop.art), chosen: size === choice.size }
  }, [choice, room.size, shop, sizes])

  const pick = (next: Partial<Choice>) =>
    setChoice((current) => {
      const merged = { ...current, ...next }
      return { ...merged, glass: merged.glass && takesGlass(merged.finish) }
    })

  const cm = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: value < 10 ? 1 : 0 })
  const hints: Record<Mode, string> = {
    frente: coarse ? 'Arraste para girar' : 'Mova o mouse para inclinar',
    parede: `No tamanho real · ${room.above}`,
    dentro: coarse ? 'Toque no + para ver cada parte' : 'Clique no + para ver cada parte',
    escala: `Escala real · ${room.label.toLowerCase()}`,
  }
  const title = shop.product.short || shop.product.title

  const questions = useMemo<Question[]>(() => {
    const furniture = furnitureOf(room, wide ? 'wide' : 'narrow')
    const H = size.height / 100
    const glassOff = priceOf(shop, { ...choice, glass: false })
    const glassOn = priceOf(shop, { ...choice, glass: true })
    return questionsOf({
      pieces,
      piece: { width: size.width, height: size.height },
      set: { width: setWidth, height: size.height },
      sizeLabel: sizeLabel(choice.size, shop.art),
      furniture: { phrase: room.phrase, width: Math.round(furniture.width * 20) * 5 },
      hangGap: Math.round((hangHeight(H, room.top) - H / 2 - room.top) * 100),
      framed: hasFrame(choice.finish),
      canvas: choice.finish === 'canvas',
      glassOk: takesGlass(choice.finish),
      glassDelta: glassOff !== null && glassOn !== null ? glassOn - glassOff : null,
      money: (cents) => money(cents).replace(',00', ''),
    })
  }, [choice, pieces, room, setWidth, shop, size.height, size.width, wide])

  return (
    <div
      className="bg-white font-[family-name:var(--font-especial)] text-[#2a2520]"
      style={{ '--im-top': `${topOffset}px`, '--im-sticky': `${stickyTop}px` } as CSSProperties}
    >
      {/* O palco fica preso na tela enquanto a etiqueta e as perguntas rolam por cima dele.
          Altura do palco: no computador, a da tela (ou mais, se a etiqueta precisar: ela nunca rola por dentro) */}
      <div
        ref={rootRef}
        // Celular: na vitrine a imagem tem 64% da tela (o seletor e a etiqueta sobem por cima do resto);
        // o palco vai até o pé da tela, e nas perguntas o quadro usa ela toda (a página não muda de altura)
        className="relative px-2 [--im-stage:max(calc(100svh-var(--im-sticky)-8px),var(--im-vitrine))] [--im-vitrine:max(64svh,440px)] md:px-3 md:[--im-stage:max(calc(100svh-var(--im-top)-12px),var(--im-card,0px),600px)] md:[--im-vitrine:var(--im-stage)]"
        style={{ '--im-card': `${tag.height + TAG_TOP + GAP}px`, '--im-tag-scale': tag.scale, '--im-side': SIDE } as CSSProperties}
      >
        {/* Palco: a cena e o HTML por cima dela */}
        <div
          ref={stageRef}
          data-story="off"
          className="group/stage sticky top-[var(--im-sticky)] z-0 h-[var(--im-stage)] overflow-hidden rounded-[24px] bg-[#f4f1ec] md:rounded-[32px] [&_canvas]:touch-pan-y"
        >
          <Studio shadowExtent={SHADOW_EXTENT} keyLightRef={keyLightRef} environment="lightformers">
            <ImersivoScene
              models={models}
              alt={alt}
              mode={mode}
              keyLightRef={keyLightRef}
              insetsRef={insetsRef}
              annotationsRef={annotationsRef}
              attached={ATTACHED_PARTS}
              room={room}
              storyRef={storyRef}
            />
          </Studio>

          {/* Cotas (a cena posiciona a cada frame; as sem texto aqui ela mesma escreve) */}
          <div ref={annotationsRef} aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            {(
              [
                ['w', `${cm(setWidth)} cm`],
                ['h', `${cm(size.height)} cm`],
                ['d', `${cm(size.depth)} cm`],
                ['fw', ''],
                ['fh', ''],
                ['p0', `${sizeLabel(choice.size, shop.art)} cm`],
                ['p1', `${sizeLabel(choice.size, shop.art)} cm`],
                ['p2', `${sizeLabel(choice.size, shop.art)} cm`],
                ['g', ''],
                ['v', ''],
                ['a0', ''],
                ['a1', ''],
                ['bx', 'Caixa de luz'],
                ['cd', ''],
              ] as const
            ).map(([key, text]) => (
              <div key={key} data-dim={key} style={{ opacity: 0 }}>
                <span
                  data-dim-line
                  className="absolute top-0 left-0 h-px origin-[0_50%] bg-[#2a2520]/70 before:absolute before:-top-1 before:left-0 before:h-2.25 before:w-px before:bg-[#2a2520]/70 after:absolute after:right-0 after:-top-1 after:h-2.25 after:w-px after:bg-[#2a2520]/70"
                />
                <span
                  data-dim-label
                  className={`absolute top-0 left-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#2a2520] shadow-[0_4px_14px_rgba(42,37,32,0.18)]${
                    // Nome do quadro do par (06 e 07): etiqueta com a setinha para baixo, apontando para ele
                    key === 'a0' || key === 'a1' ? ' after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-x-[6px] after:border-t-[6px] after:border-x-transparent after:border-t-white' : ''
                  }`}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>

          {/* Em cima: a dica da vista e a migalha (somem nas perguntas) */}
          <div
            ref={topRef}
            className="pointer-events-none absolute top-4 left-4 z-20 flex max-w-[calc(100%-2rem)] flex-col items-start gap-2 transition-opacity [opacity:clamp(0,calc(1-var(--story,0)*4),1)] md:top-7 md:left-[calc(1.75rem+var(--im-side))]"
          >
            <p className="rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-[#2a2520] shadow-[0_2px_10px_rgba(42,37,32,0.08)] backdrop-blur">{hints[mode]}</p>
            <nav
              aria-label="Você está em"
              className="pointer-events-auto max-w-full truncate rounded-full bg-white/90 px-3.5 py-1.5 text-xs text-[#8a7d6c] shadow-[0_2px_10px_rgba(42,37,32,0.08)] backdrop-blur group-data-[story=on]/stage:pointer-events-none"
            >
              <a href={crumb?.url ?? '/'} className="hover:text-[#c85f12]">
                {crumb?.title ?? 'Início'}
              </a>
              <span className="mx-1.5" aria-hidden>
                /
              </span>
              <span className="font-semibold text-[#2a2520]">{title}</span>
            </nav>
          </div>

          {/* Computador, nas vistas com ambiente: um véu claro atrás do seletor (sem cartão, sem borda),
              para os nomes lerem sobre qualquer foto; some com as perguntas. Começa 100 px antes do
              seletor, esmaecendo: na tela comum essa parte fica fora do palco; na ultralarga, o véu não
              tem corte no meio da foto */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-[calc(var(--im-side)-100px)] z-10 hidden w-[460px] transition-opacity duration-300 md:block"
            style={{
              background: 'linear-gradient(90deg, rgba(244,241,236,0) 0%, rgba(244,241,236,0.94) 22%, rgba(244,241,236,0.86) 62%, rgba(244,241,236,0) 100%)',
              opacity: onWall ? 'clamp(0, calc(1 - var(--story, 0) * 4), 1)' : 0,
            }}
          />

          {/* Computador: o seletor de vistas em linhas, à esquerda, com os ambientes embaixo de Na parede e
              Escala (largura fixa: abrir a lista não empurra o quadro); some nas perguntas */}
          <div
            ref={tabsRef}
            className="absolute top-[120px] bottom-6 left-[calc(1.75rem+var(--im-side))] z-20 hidden w-[184px] flex-col justify-center [opacity:clamp(0,calc(1-var(--story,0)*4),1)] group-data-[story=on]/stage:pointer-events-none md:flex"
          >
            <ViewPicker
              mode={mode}
              onMode={setMode}
              art={shop.art}
              frameColor={hasFrame(choice.finish) ? COLOR_LABEL[choice.color].swatch : null}
              room={room}
              roomsAt={roomsAt}
              leaving={!onWall}
              onRoom={chooseRoom}
              onPreload={preload}
              onSize={chooseSize}
              reco={reco}
              onApply={() => reco && pick({ size: reco.size })}
              layout="column"
            />
          </div>

          {/* Celular: a faixa branca das perguntas, presa embaixo do palco; a rolagem escolhe o texto */}
          <div
            ref={pinnedRef}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 rounded-t-[22px] bg-white px-4 pt-3.5 pb-4 shadow-[0_-14px_30px_-22px_rgba(42,37,32,0.5)] md:hidden"
            style={{ transform: 'translateY(105%)', visibility: 'hidden' }}
          >
            <div className="grid">
              {questions.map((question, index) => (
                <div key={question.title} data-q={index + 1} className="self-start [grid-area:1/1]" style={{ opacity: 0, visibility: 'hidden' }}>
                  <QuestionCard number={index + 1} question={question} compact />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Por cima do palco (que fica preso): o espaço da vitrine, a etiqueta e as perguntas */}
        <div className="pointer-events-none relative z-10 -mt-[var(--im-stage)]">
          <div ref={vitrineRef} className="h-[var(--im-vitrine)]" />

          {/* Celular: as vistas numa linha embaixo da imagem e, em Na parede e Escala, os ambientes */}
          <div className="pointer-events-auto relative -mx-2 rounded-t-[22px] bg-white px-2 pt-4 shadow-[0_-14px_30px_-22px_rgba(42,37,32,0.5)] md:hidden">
            <ViewPicker
              mode={mode}
              onMode={setMode}
              art={shop.art}
              frameColor={hasFrame(choice.finish) ? COLOR_LABEL[choice.color].swatch : null}
              room={room}
              roomsAt={roomsAt}
              leaving={!onWall}
              onRoom={chooseRoom}
              onPreload={preload}
              onSize={chooseSize}
              reco={reco}
              onApply={() => reco && pick({ size: reco.size })}
              layout="row"
            />
          </div>

          {/* Compra: a etiqueta pendurada ao lado do palco (no celular, embaixo dele, reta); sobe com a página */}
          <aside
            ref={cardRef}
            aria-label="Comprar"
            className="pointer-events-auto relative -mx-2 bg-white px-2 pt-3 pb-8 md:absolute md:top-14 md:right-[calc(3.5rem+var(--im-side))] md:mx-0 md:w-[372px] md:origin-top md:bg-transparent md:p-0 md:[transform:scale(var(--im-tag-scale,1))] lg:right-[calc(5rem+var(--im-side))] lg:w-[392px]"
          >
            <HangTag
              shop={shop}
              choice={choice}
              onPick={pick}
              finishes={finishes}
              sizes={sizes}
              variant={variant}
            />
          </aside>

          {/* As oito perguntas: uma por tela, à esquerda do palco (no celular, na faixa abaixo dele) */}
          <div className="pt-[8svh] md:pt-0">
            {questions.map((question, index) => (
              <section
                key={question.title}
                ref={(element) => {
                  questionRefs.current[index] = element
                }}
                aria-label={question.title}
                className="flex h-[70svh] items-center md:h-[var(--im-stage)] md:pl-8 lg:pl-12"
              >
                {/* No celular o card fica preso no palco (acima); aqui, só o texto para leitores de tela */}
                <div className="sr-only md:not-sr-only md:contents">
                  <QuestionCard number={index + 1} question={question} />
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <Details shop={shop} />
    </div>
  )
}

/** Uma pergunta: o número em laranja, a pergunta, a resposta e a medida principal (`compact`: o card do celular, preso no palco) */
function QuestionCard({ number, question, compact }: { number: number; question: Question; compact?: boolean }) {
  return compact ? (
    <article>
      <p className="flex items-baseline gap-2">
        <span className="text-[1.5rem] leading-none font-extralight text-[#c85f12]">{String(number).padStart(2, '0')}</span>
        <span className="text-[1.02rem] leading-tight font-semibold tracking-tight">{question.title}</span>
      </p>
      <p className="mt-1.5 text-[12.5px] leading-snug text-[#5a534e]">{question.text}</p>
      <span className="mt-2 inline-flex rounded-full bg-[#2a2520] px-3 py-1.5 text-[11px] font-semibold text-white">{question.pill}</span>
    </article>
  ) : (
    <article className="pointer-events-auto w-full rounded-[22px] bg-white/92 px-5 py-5 shadow-[0_18px_50px_-30px_rgba(42,37,32,0.45)] backdrop-blur md:w-[400px] md:px-7 md:py-7 lg:w-[430px]">
      <p className="text-[2.4rem] leading-none font-extralight text-[#c85f12] md:text-[3.2rem]">{String(number).padStart(2, '0')}</p>
      <h2 className="mt-2 text-[1.3rem] leading-tight font-semibold tracking-tight md:mt-3 md:text-[1.65rem]">{question.title}</h2>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[#5a534e] md:mt-3 md:text-[16px]">{question.text}</p>
      <span className="mt-3 inline-flex rounded-full bg-[#2a2520] px-4 py-2 text-[12px] font-semibold text-white md:mt-4 md:text-[13px]">{question.pill}</span>
    </article>
  )
}

interface ViewPickerProps {
  mode: Mode
  onMode: (mode: Mode) => void
  art: ShopData['art']
  /** Cor da moldura escolhida (sem moldura: null) */
  frameColor: string | null
  /** O ambiente escolhido, com a largura do móvel (`size`) quando ele tem mais de uma */
  room: ReturnType<typeof sizedRoom>
  /** Embaixo de qual vista está a lista de ambientes (null: nenhuma) e se ela está saindo */
  roomsAt: Mode | null
  leaving: boolean
  onRoom: (room: RoomDef) => void
  /** Começa a baixar a foto de um ambiente (na largura escolhida para ele) */
  onPreload: (room: RoomDef) => void
  onSize: (key: string) => void
  /** O tamanho de quadro que combina com o móvel e se ele já é o escolhido */
  reco: { label: string; chosen: boolean } | null
  onApply: () => void
  /** `column`: à esquerda do palco (computador), traço + miniatura + nome; `row`: embaixo da imagem (celular) */
  layout: 'column' | 'row'
}

/** Anel da miniatura escolhida (a vista em grafite, o ambiente em laranja) e o contorno das outras */
const RING = { view: '0 0 0 1.5px #f4f1ec, 0 0 0 3px #2a2520', room: '0 0 0 1.5px #f4f1ec, 0 0 0 3px #c85f12', idle: '0 0 0 1px rgba(42,37,32,0.12)' }

/** Foco do teclado nos botões do seletor */
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#c85f12]'

/**
 * Seletor de vistas (handoff da vitrine, "4a · Linhas"): sem cartão, cada vista é um traço (maior
 * na escolhida), a mini-cena dela e o nome; as outras ficam a meia opacidade. Na parede e Escala
 * abrem embaixo a lista de ambientes, que entra em escadinha. Abas e ambientes andam com as setas.
 */
function ViewPicker({ mode, onMode, art, frameColor, room, roomsAt, leaving, onRoom, onPreload, onSize, reco, onApply, layout }: ViewPickerProps) {
  const column = layout === 'column'
  const options = room.sizes?.options ?? []
  const rooms = (
    <div key={roomsAt} className={`transition-opacity duration-200 ${leaving ? 'opacity-0' : ''} ${column ? 'mt-2.5 mb-1 ml-[26px] border-l border-[#2a2520]/25 pl-3' : ''}`}>
    <div
      role="radiogroup"
      aria-label="Ambiente"
      onKeyDown={(event) => arrowKeys(event, 'radio', ROOMS.findIndex((item) => item.key === room.key), ROOMS.length, (index) => onRoom(ROOMS[index]!))}
      className={
        column
          ? 'flex flex-col items-start gap-1.5'
          : '-mx-2 mt-1 flex snap-x snap-mandatory gap-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      }
    >
      {ROOMS.map((item, index) => {
        const active = item.key === room.key
        return (
          <button
            key={item.key}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onRoom(item)}
            onPointerEnter={() => onPreload(item)}
            onFocus={() => onPreload(item)}
            // Entra da esquerda, 40 ms depois do anterior (sem animação com "reduzir movimento")
            style={{ animationDelay: `${index * 40}ms` }}
            className={`flex shrink-0 snap-start items-center gap-2.5 rounded-[10px] text-[12.5px] whitespace-nowrap animate-[gq-room-in_300ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none ${
              column ? 'py-0.5' : 'min-h-11 px-2'
            } ${active ? 'font-bold text-[#c85f12]' : 'font-medium text-[#2a2520]'} ${FOCUS}`}
          >
            <span className="block size-[26px] shrink-0 overflow-hidden rounded-[8px] transition-shadow duration-200" style={{ boxShadow: active ? RING.room : RING.idle }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetUrl(item.thumb)} alt="" loading="lazy" className="block size-full object-cover" />
            </span>
            <span style={{ boxShadow: active ? 'inset 0 -1.5px 0 #c85f12' : undefined }}>{item.label}</span>
          </button>
        )
      })}
    </div>
    {room.sizes && (
      // A largura do móvel (sala e quarto) e o tamanho de quadro que combina com ela
      <div className={`animate-[gq-room-in_300ms_cubic-bezier(0.23,1,0.32,1)_both] [animation-delay:200ms] motion-reduce:animate-none ${column ? 'mt-3' : 'mt-1 flex flex-wrap items-center gap-x-3'}`}>
        <div
          role="radiogroup"
          aria-label={room.sizes.aria}
          onKeyDown={(event) => arrowKeys(event, 'radio', options.findIndex((option) => option.key === room.size?.key), options.length, (index) => onSize(options[index]!.key))}
          // Computador: o nome do grupo em cima e as medidas sem o "m", para caber na coluna
          className={column ? 'flex flex-wrap items-center gap-[3px]' : 'flex items-center gap-1'}
        >
          <span aria-hidden className={`font-bold text-[#8a7d6c] uppercase ${column ? 'mb-0.5 w-full text-[10px] tracking-[0.08em] whitespace-nowrap' : 'mr-1 text-[10.5px] tracking-[0.12em]'}`}>
            {column ? room.sizes.aria : room.sizes.label}
          </span>
          {options.map((option) => {
            const active = option.key === room.size?.key
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onSize(option.key)}
                onPointerEnter={() => onPreload({ ...room, sizes: { ...room.sizes!, initial: option.key } })}
                // No celular o toque pega 44 px de altura; a pílula é o miolo
                className={`group/size flex items-center rounded-full ${column ? '' : 'min-h-11'} ${FOCUS}`}
              >
                <span
                  className={`rounded-full py-[3px] font-semibold whitespace-nowrap transition-colors duration-200 ${
                    active ? 'bg-[#2a2520] text-white [text-shadow:none]' : 'text-[#2a2520] ring-1 ring-[#2a2520]/25 group-hover/size:ring-[#2a2520]/60'
                  } ${column ? 'px-[6px] text-[11px]' : 'px-3 py-1.5 text-[11.5px]'}`}
                >
                  {column ? option.label.replace(/ m$/, '') : option.label}
                </span>
              </button>
            )
          })}
        </div>
        {reco && (
          <p className={`text-[12px] leading-snug text-[#2a2520] ${column ? 'mt-2 max-w-[150px]' : ''}`}>
            Ideal para {room.sizes.fits}: <b>{reco.label}</b>
            {reco.chosen ? (
              <span className="text-[#5a534e]"> · o seu</span>
            ) : (
              <>
                {' · '}
                <button type="button" onClick={onApply} className={`font-bold text-[#c85f12] underline underline-offset-2 ${column ? '' : '-my-3 py-3'} ${FOCUS}`}>
                  Aplicar
                </button>
              </>
            )}
          </p>
        )}
      </div>
    )}
    </div>
  )

  return (
    // Sem cartão: no computador os nomes ficam sobre a foto do ambiente, então levam um halo claro para ler sobre qualquer parede
    <div className={column ? 'flex flex-col items-start [text-shadow:0_0_8px_rgba(244,241,236,0.95),0_0_2px_rgba(244,241,236,0.9)]' : ''}>
      <div
        role="tablist"
        aria-label="Vistas do quadro"
        aria-orientation={column ? 'vertical' : 'horizontal'}
        onKeyDown={(event) => arrowKeys(event, 'tab', MODES.findIndex((item) => item.key === mode), MODES.length, (index) => onMode(MODES[index]!.key))}
        className={column ? 'flex flex-col items-start gap-2.5' : 'flex justify-center gap-3'}
      >
        {MODES.map(({ key, label }) => {
          const active = mode === key
          return (
            <div key={key} role="none" className={column ? 'flex flex-col items-start' : 'contents'}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onMode(key)}
                className={`group flex items-center rounded-[14px] transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-50 hover:opacity-100'} ${
                  column ? 'gap-3' : 'min-h-11 min-w-11 flex-col gap-1.5'
                } ${FOCUS}`}
              >
                {column && (
                  <span
                    aria-hidden
                    className={`block h-[1.5px] shrink-0 bg-[#2a2520] transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${active ? 'w-[14px]' : 'w-[6px]'}`}
                  />
                )}
                <span className="relative block size-10 shrink-0 overflow-hidden rounded-[12px] bg-[#ece5db] transition-shadow duration-200" style={{ boxShadow: active ? RING.view : RING.idle }}>
                  <MiniScene view={key} art={art} frameColor={frameColor} />
                </span>
                <span className={`tracking-[0.02em] whitespace-nowrap text-[#2a2520] ${column ? 'text-[13px]' : 'text-[11.5px]'} ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
              </button>
              {column && roomsAt === key && rooms}
            </div>
          )
        })}
      </div>
      {!column && roomsAt !== null && rooms}
    </div>
  )
}

/**
 * Setas (e Home/End) num grupo de abas ou de ambientes: escolhe o vizinho e leva o foco até ele. Os
 * ambientes ficam dentro das abas no computador: a tecla para no grupo de dentro.
 */
function arrowKeys(event: KeyboardEvent<HTMLElement>, role: 'tab' | 'radio', current: number, count: number, choose: (index: number) => void) {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
  const index = step !== undefined ? (current + step + count) % count : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null
  if (index === null) return
  event.preventDefault()
  event.stopPropagation()
  choose(index)
  // Os botões já estão na tela (só o escolhido muda): o foco vai na hora
  event.currentTarget.querySelectorAll<HTMLElement>(`[role="${role}"]`)[index]?.focus()
}

/**
 * Mini-cena de cada vista, desenhada com a arte do quadro: de frente; na parede, sobre um móvel;
 * em camadas; e com a régua de altura ao lado
 */
function MiniScene({ view, art, frameColor }: { view: Mode; art: ShopData['art']; frameColor: string | null }) {
  const ratio = art.width / art.height
  const framed = (extra?: CSSProperties): CSSProperties => ({ aspectRatio: ratio, border: frameColor ? `2px solid ${frameColor}` : undefined, ...extra })
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={art.url} alt="" loading="lazy" className="block size-full object-cover" />
  )
  const wall = <span className="absolute inset-x-0 bottom-0 h-[22%] bg-[#d6c6ae]" />
  switch (view) {
    case 'frente':
      return (
        <span className="absolute top-1/2 left-1/2 block h-[74%] -translate-x-1/2 -translate-y-1/2 overflow-hidden shadow-[2px_3px_6px_rgba(0,0,0,0.25)]" style={framed()}>
          {image}
        </span>
      )
    case 'parede':
      return (
        <>
          {wall}
          <span className="absolute bottom-[22%] left-1/2 h-[15%] w-[62%] -translate-x-1/2 rounded-t-[2px] bg-[#8b6a4e]" />
          <span className="absolute top-[12%] left-1/2 block h-[38%] -translate-x-1/2 overflow-hidden shadow-[1px_2px_4px_rgba(0,0,0,0.25)]" style={framed()}>
            {image}
          </span>
        </>
      )
    case 'dentro':
      return (
        <span className="absolute inset-0 [perspective:110px]">
          <span className="absolute top-[22%] left-[14%] block h-[56%] bg-[#cdbba3] [transform:rotateY(-38deg)]" style={{ aspectRatio: ratio }} />
          <span className="absolute top-[20%] left-[30%] block h-[60%] overflow-hidden shadow-[1px_2px_4px_rgba(0,0,0,0.2)] [transform:rotateY(-38deg)]" style={{ aspectRatio: ratio }}>
            {image}
          </span>
          <span className="absolute top-[17%] left-[48%] block h-[66%] [transform:rotateY(-38deg)]" style={{ aspectRatio: ratio, border: `2.5px solid ${frameColor ?? '#b9a88f'}` }} />
        </span>
      )
    case 'escala':
      return (
        <>
          {wall}
          <span className="absolute top-[24%] left-[26%] block h-[34%] overflow-hidden shadow-[1px_2px_4px_rgba(0,0,0,0.25)]" style={framed()}>
            {image}
          </span>
          <span className="absolute top-[12%] right-[22%] bottom-[22%] w-px bg-[#2a2520]/70" />
          <span className="absolute top-[12%] right-[calc(22%-3px)] h-px w-[7px] bg-[#2a2520]/70" />
          <span className="absolute right-[calc(22%-3px)] bottom-[22%] h-px w-[7px] bg-[#2a2520]/70" />
        </>
      )
  }
}

/** Começa a baixar a foto do ambiente (a da tela atual: computador ou celular) antes da troca */
function preloadRoom(room: (typeof ROOMS)[number]) {
  const photo = window.matchMedia('(min-width: 48rem)').matches ? room.wide : room.narrow
  useTexture.preload(assetUrl(photo.src))
}

/** Tela larga (computador): o ambiente usa a foto do computador */
function useWide(): boolean {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 48rem)')
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return wide
}

/** Toque (celular, tablet): as dicas falam em arrastar e tocar */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarse(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return coarse
}

/** Chave do ambiente escolhido nesta visita (sessionStorage) e a da largura do móvel de cada ambiente */
const ROOM_KEY = 'gq-room'
const FURNITURE_KEY = 'gq-room-size'

/** As larguras do móvel escolhidas nesta visita ({ sala: '240', quarto: 'king' }), só as que existem */
function initialFurniture(): Record<string, string> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(FURNITURE_KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(
      ROOMS.flatMap((room) => {
        const key = saved[room.key]
        return typeof key === 'string' && room.sizes?.options.some((option) => option.key === key) ? [[room.key, key]] : []
      }),
    )
  } catch {
    return {}
  }
}

/**
 * O ambiente que abre: o escolhido nesta visita; senão o do produto (metafield
 * custom.ambiente_padrao, pelo nome ou pela chave, sem ligar para acento); senão o quarto
 */
function initialRoom(fromProduct: string | null | undefined): string {
  const plain = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  const known = (value: string | null | undefined) => (value ? ROOMS.find((room) => room.key === plain(value) || plain(room.label) === plain(value))?.key : undefined)
  let saved: string | null = null
  try {
    saved = sessionStorage.getItem(ROOM_KEY)
  } catch {
    // Sem armazenamento: fica o do produto
  }
  return known(saved) ?? known(fromProduct) ?? 'quarto'
}

/** A variante do endereço (?variant=), se for deste produto; senão, a que a loja abriu */
function initialVariant(shop: ShopData): number {
  const fromUrl = Number(new URLSearchParams(window.location.search).get('variant'))
  return shop.variants.some(([id]) => id === fromUrl) ? fromUrl : shop.selected
}
