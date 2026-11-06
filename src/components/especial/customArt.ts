import { useCallback, useEffect, useRef, useState } from 'react'
import { gqPhoto, type Envio, type PhotoError, type PhotoQuality, type PhotoSlot } from './gqphoto'
import { sizeCm, type ShopData } from './shop'

/**
 * A foto do cliente no personalizado (uma peça): escolher ou arrastar, enquadrar na proporção do
 * tamanho escolhido e usar a prévia do enquadramento como arte do 3D. Quem faz o trabalho é o
 * GQPhoto do tema (gqphoto.ts); aqui fica o estado da página.
 *
 * Envio (ajuste do tema "Como a foto chega"):
 * - 'email': a foto é só a prévia (opcional); o item leva o aviso de que vai por e-mail.
 * - 'shopify': o arquivo original vai junto ao pôr na sacola (com progresso).
 * - 's3': o original sobe assim que o cliente enquadra (com progresso); a sacola recebe o link.
 * Nos dois envios, comprar pede a foto.
 */
export interface CustomArt {
  /** Personalizado e o GQPhoto carregado: a página mostra a parte da foto */
  on: boolean
  envio: Envio
  /** A foto vai com o pedido: comprar pede a foto */
  required: boolean
  slot: PhotoSlot | null
  /** Arte do 3D: a prévia do enquadramento (null: a arte de exemplo do produto) */
  art: string | null
  quality: PhotoQuality | null
  /** Medida da peça no tamanho escolhido (cm) */
  cm: { w: number; h: number }
  /** Abrindo ou enquadrando */
  opening: boolean
  /** Enviando a foto: 0–99; null sem envio em andamento */
  progress: number | null
  /** Envio 's3' concluído */
  uploaded: boolean
  error: string | null
  /** Abre o seletor de arquivo (precisa vir de um clique) */
  choose: () => void
  /** Abre um arquivo (arrastado) e enquadra */
  open: (file: File) => void
  /** Reabre o enquadramento da foto atual */
  adjust: () => void
  /** Cancela o envio em andamento */
  cancel: () => void
  /** Antes de pôr na sacola: no 's3', espera (ou refaz) o envio da foto */
  prepare: () => Promise<void>
  /** Põe na sacola a variante com a foto (o FormData do GQPhoto, com progresso e cancelamento) */
  send: (variantId: number) => Promise<unknown>
}

const UPLOAD_ERROR = 'Não conseguimos enviar a sua foto. Tente de novo.'

interface UploadJob {
  file: File
  promise: Promise<string>
  ctrl: AbortController
}

export function useCustomArt(shop: ShopData, size: string): CustomArt {
  const envio: Envio = shop.custom?.envio ?? 'email'
  const endpoint = shop.custom?.endpoint ?? ''
  // O tema carrega o gq-photo.js antes deste módulo (os dois adiados, nessa ordem)
  const [PH] = useState(() => (shop.custom ? gqPhoto() : null))
  const on = Boolean(shop.custom && PH)
  const { w, h } = sizeCm(size, shop.art)

  const [slot, setSlot] = useState<PhotoSlot | null>(null)
  const [art, setArt] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lidos nos cliques e nas promessas: o valor de agora, não o do render que criou a função
  const slotRef = useRef<PhotoSlot | null>(null)
  const sizeRef = useRef({ w, h })
  const aspectRef = useRef(0)
  const openingRef = useRef(false)
  const job = useRef<UploadJob | null>(null)
  const sending = useRef<AbortController | null>(null)

  useEffect(() => {
    sizeRef.current = { w, h }
  }, [w, h])

  /** Envio 's3' da foto da peça: um por arquivo; outro arquivo cancela o anterior */
  const upload = useCallback(
    (target: PhotoSlot): Promise<string> => {
      if (!PH || !target.file) return Promise.reject({ description: UPLOAD_ERROR })
      if (target.arte) return Promise.resolve(target.arte)
      const current = job.current
      if (current && current.file === target.file) return current.promise
      current?.ctrl.abort()
      const file = target.file
      const ctrl = new AbortController()
      const mine = () => job.current?.file === file
      setUploaded(false)
      setProgress(0)
      const promise = PH.upload(target, endpoint, (pct) => mine() && setProgress(pct), ctrl.signal).then(
        (url) => {
          if (slotRef.current?.file === file) {
            slotRef.current.arte = url
            setUploaded(true)
          }
          if (mine()) setProgress(null)
          return url
        },
        (failure: PhotoError) => {
          if (mine()) {
            job.current = null
            setProgress(null)
          }
          if (!failure?.canceled && slotRef.current?.file === file) setError(failure?.description || UPLOAD_ERROR)
          throw failure
        },
      )
      // Ninguém esperando (o envio começa sozinho depois do enquadramento): o erro já foi mostrado
      promise.catch(() => undefined)
      job.current = { file, promise, ctrl }
      return promise
    },
    [PH, endpoint],
  )

  /** A peça enquadrada entra no lugar da anterior (e da arte de exemplo, no 3D) */
  const apply = useCallback(
    (next: PhotoSlot) => {
      const old = slotRef.current
      if (old && old !== next) {
        if (old.preview && old.preview !== next.preview) URL.revokeObjectURL(old.preview)
        if (old.url !== next.url) URL.revokeObjectURL(old.url)
      }
      if (old?.file !== next.file && job.current && job.current.file !== next.file) {
        job.current.ctrl.abort()
        job.current = null
        setProgress(null)
      }
      slotRef.current = next
      aspectRef.current = sizeRef.current.w / sizeRef.current.h
      setSlot(next)
      setArt(next.preview)
      setUploaded(Boolean(next.arte))
      setError(null)
      if (envio === 's3') upload(next).catch(() => undefined)
    },
    [envio, upload],
  )

  const cropNow = useCallback(
    async (draft: PhotoSlot, fresh: boolean) => {
      if (!PH) return
      const { w: cw, h: ch } = sizeRef.current
      const next = await PH.crop(draft, { w: cw, h: ch, sub: `${cw}×${ch} cm` })
      if (!next) {
        if (fresh) URL.revokeObjectURL(draft.url)
        return
      }
      apply(next)
    },
    [PH, apply],
  )

  const open = useCallback(
    async (file: File) => {
      if (!PH || openingRef.current) return
      const problem = PH.check(file, envio)
      if (problem) {
        setError(problem)
        return
      }
      setError(null)
      openingRef.current = true
      setOpening(true)
      try {
        let draft: PhotoSlot
        try {
          draft = await PH.load(file)
        } catch {
          setError(PH.LOAD_ERROR)
          return
        }
        await cropNow(draft, true)
      } finally {
        openingRef.current = false
        setOpening(false)
      }
    },
    [PH, envio, cropNow],
  )

  const choose = useCallback(() => {
    if (!PH || openingRef.current) return
    // O seletor abre aqui mesmo, ainda dentro do clique
    PH.choose().then((file) => {
      if (file) open(file)
    })
  }, [PH, open])

  const adjust = useCallback(() => {
    const current = slotRef.current
    if (current) cropNow(current, false)
  }, [cropNow])

  const cancel = useCallback(() => {
    job.current?.ctrl.abort()
    job.current = null
    sending.current?.abort()
    sending.current = null
    setProgress(null)
  }, [])

  const prepare = useCallback(async () => {
    const current = slotRef.current
    if (envio !== 's3' || !current) return
    await upload(current)
  }, [envio, upload])

  const send = useCallback(
    async (variantId: number) => {
      if (!PH) throw { description: UPLOAD_ERROR }
      const current = slotRef.current
      const { w: cw, h: ch } = sizeRef.current
      const { data } = await PH.form({ variantId, quantity: 1, slots: [current], w: cw, h: ch, envio })
      const withFile = envio === 'shopify' && current !== null
      const ctrl = new AbortController()
      sending.current = ctrl
      if (withFile) setProgress(0)
      try {
        return await PH.send(data, withFile ? (pct) => setProgress(pct) : undefined, ctrl.signal)
      } finally {
        if (sending.current === ctrl) sending.current = null
        if (withFile) setProgress(null)
      }
    },
    [PH, envio],
  )

  // Tamanho de outra proporção: refaz o enquadramento no mesmo centro e zoom (como a página de produto)
  useEffect(() => {
    const current = slotRef.current
    if (!PH || !current || !aspectRef.current || Math.abs(w / h - aspectRef.current) < 0.001) return
    aspectRef.current = w / h
    PH.refresh(current, w, h).then((fresh) => {
      if (slotRef.current === fresh) setArt(fresh.preview)
    })
  }, [PH, w, h])

  // Saindo da página: nada continua subindo
  useEffect(
    () => () => {
      job.current?.ctrl.abort()
      sending.current?.abort()
    },
    [],
  )

  return {
    on,
    envio,
    required: envio !== 'email',
    slot,
    art,
    quality: on && slot && PH ? PH.quality(slot, w, h) : null,
    cm: { w, h },
    opening,
    progress,
    uploaded,
    error,
    choose,
    open,
    adjust,
    cancel,
    prepare,
    send,
  }
}
