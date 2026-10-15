import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isModelId, MODEL_IDS, MODELS } from '@/components/scene/models'
import { ViewerLoader } from '@/components/scene/SceneLoader'

// Só os modelos conhecidos: qualquer outro caminho dá 404
export const dynamicParams = false

export function generateStaticParams() {
  return MODEL_IDS.map((modelo) => ({ modelo }))
}

export async function generateMetadata({ params }: PageProps<'/[modelo]/360'>): Promise<Metadata> {
  const { modelo } = await params
  return isModelId(modelo) ? { title: `${MODELS[modelo].name} — 360°` } : {}
}

/** Visualização livre do modelo: arrastar para girar, rolar para aproximar */
export default async function ModelViewerPage({ params }: PageProps<'/[modelo]/360'>) {
  const { modelo } = await params
  if (!isModelId(modelo)) notFound()

  return (
    <main className="h-dvh w-full">
      <ViewerLoader model={modelo} />
    </main>
  )
}
