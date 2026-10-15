import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isModelId, MODEL_IDS, MODELS } from '@/components/scene/models'
import { SceneLoader } from '@/components/scene/SceneLoader'

// Só os modelos conhecidos: qualquer outro caminho dá 404
export const dynamicParams = false

export function generateStaticParams() {
  return MODEL_IDS.map((modelo) => ({ modelo }))
}

export async function generateMetadata({ params }: PageProps<'/[modelo]'>): Promise<Metadata> {
  const { modelo } = await params
  return isModelId(modelo) ? { title: MODELS[modelo].name } : {}
}

/** Landing do modelo: o quadro reage ao scroll */
export default async function ModelPage({ params }: PageProps<'/[modelo]'>) {
  const { modelo } = await params
  if (!isModelId(modelo)) notFound()

  return (
    <main className="h-dvh w-full">
      <SceneLoader model={modelo} />
    </main>
  )
}
