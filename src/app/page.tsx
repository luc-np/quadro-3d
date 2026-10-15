import Link from 'next/link'
import { MODEL_IDS, MODELS } from '@/components/scene/models'
import { SCENE_BACKGROUND } from '@/components/scene/theme'

/** Índice dos modelos, com a landing e a visualização 360° de cada um */
export default function Home() {
  return (
    <main className="min-h-dvh px-6 py-16 font-sans text-neutral-900" style={{ background: SCENE_BACKGROUND }}>
      <div className="mx-auto flex max-w-xl flex-col gap-8">
        <h1 className="text-2xl font-semibold">Modelos 3D</h1>
        <Link href="/especial" className="rounded-xl border border-neutral-300 px-4 py-3 text-sm hover:border-neutral-900">
          Página especial: escolhas, quadro na parede e por dentro →
        </Link>
        <ul role="list" className="divide-y divide-neutral-300 border-y border-neutral-300">
          {MODEL_IDS.map((id) => (
            <li key={id} className="flex items-center justify-between gap-4 py-4">
              <span className="font-medium">{MODELS[id].name}</span>
              <span className="flex gap-5 text-sm text-neutral-600">
                <Link href={`/${id}`} className="underline underline-offset-4 hover:text-neutral-900">
                  Landing
                </Link>
                <Link href={`/${id}/360`} className="underline underline-offset-4 hover:text-neutral-900">
                  360°
                </Link>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
