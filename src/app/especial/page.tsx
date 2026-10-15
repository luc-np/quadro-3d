import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import { EspecialLoader } from '@/components/especial/EspecialLoader'

// A tipografia do site da loja (pesos finos nos títulos, como na home)
const montserrat = Montserrat({ subsets: ['latin'], weight: ['300', '400', '500', '600', '800'], variable: '--font-especial' })

export const metadata: Metadata = { title: 'Edição especial — GoQuadros' }

/** Página especial: escolhas ligadas às partes, o quadro na parede e por dentro, conforme a rolagem */
export default function EspecialPage() {
  return (
    <main className={`min-h-dvh w-full ${montserrat.variable}`}>
      <EspecialLoader />
    </main>
  )
}
