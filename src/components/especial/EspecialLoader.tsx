'use client'

import dynamic from 'next/dynamic'
import { LoadingScreen } from '@/components/scene/LoadingScreen'
import demo from './demo-product.json'
import type { ShopData } from './shop'

// three.js só no navegador e fora do bundle inicial (como as outras cenas, em SceneLoader)
const Especial = dynamic(() => import('./Especial'), { ssr: false, loading: () => <LoadingScreen /> })

/** No Next, o produto de exemplo (copiado da loja): comprar e cotar frete só funcionam na loja */
export function EspecialLoader() {
  return <Especial shop={demo as unknown as ShopData} />
}
