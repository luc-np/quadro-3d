import { useState } from 'react'
import type { ShopData } from './shop'

/**
 * O resto da página de produto, depois da compra, no mesmo visual da história: descrição,
 * avaliações da loja, o que acontece se der errado e as perguntas frequentes (os textos da
 * página de produto atual do tema).
 */
export function Details({ shop }: { shop: ShopData }) {
  const [reviewsShown, setReviewsShown] = useState(6)
  const reviews = shop.reviews ?? []
  const score = shop.rating?.score.toLocaleString('pt-BR', { minimumFractionDigits: 1 })

  return (
    <div className="relative z-10 bg-[#f4f1ec] px-5 pt-16 pb-24 text-[#2a2520] md:px-10 md:pt-24">
      <div className="mx-auto max-w-6xl space-y-20 md:space-y-28">
        {shop.description && (
          <section className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-16">
            <Heading lead="Sobre" accent="a obra" />
            <div className="max-w-2xl text-base leading-relaxed text-[#5a534e] [&_p]:mb-4" dangerouslySetInnerHTML={{ __html: shop.description }} />
          </section>
        )}

        {reviews.length > 0 && (
          <section id="avaliacoes" className="scroll-mt-24">
            <Heading lead="A parede" accent="de quem já comprou" />
            {shop.rating && (
              <p className="mt-4 max-w-2xl text-base text-[#5a534e]">
                <b className="font-semibold text-[#2a2520]">{score}</b> de 5 em <b className="font-semibold text-[#2a2520]">{shop.rating.total}</b> avaliações públicas da
                Go Quadros no Google. São avaliações da loja; a nota por produto chega em breve.
              </p>
            )}
            <div className="mt-10 columns-1 gap-5 sm:columns-2 lg:columns-3">
              {reviews.slice(0, reviewsShown).map((review) => (
                <figure key={review.n + review.t} className="mb-5 break-inside-avoid overflow-hidden rounded-2xl border border-[#e4dccf] bg-white/80">
                  {/* Fotos das clientes, de fora (a página roda também no tema da loja, sem next/image) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {review.imgs?.[0] && <img src={review.imgs[0]} alt={`Foto de ${review.n}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
                  <blockquote className="p-5 text-[15px] leading-relaxed whitespace-pre-line text-[#3d3732]">{review.x}</blockquote>
                  <figcaption className="px-5 pb-5 text-xs text-[#8a7d6c]">
                    <b className="font-semibold text-[#2a2520]">{review.n}</b> · {review.t}
                  </figcaption>
                </figure>
              ))}
            </div>
            {reviewsShown < reviews.length && (
              <button
                type="button"
                onClick={() => setReviewsShown((count) => count + 6)}
                className="mt-4 rounded-full border border-[#2a2520] px-6 py-3 text-xs font-semibold tracking-[0.16em] uppercase"
              >
                Ver mais avaliações
              </button>
            )}
          </section>
        )}

        <section>
          <Heading lead="O que acontece" accent="se der errado" />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ['Chegou avariado', 'Refazemos e reenviamos sem custo. Basta a foto da embalagem.'],
              ['Não gostou ao vivo', '7 dias corridos para devolver, contados da entrega: direito de arrependimento do CDC (art. 49).'],
              ['Errou o tamanho', 'Troca por outra medida com a diferença de preço.'],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-[#e4dccf] bg-white/60 p-6">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-[#5a534e]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-16">
          <Heading lead="Ainda" accent="em dúvida?" />
          <div className="divide-y divide-[#e4dccf] border-y border-[#e4dccf]">
            {faq(shop).map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium">
                  {question}
                  <span className="text-xl font-light text-[#c85f12] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#5a534e]">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function Heading({ lead, accent }: { lead: string; accent: string }) {
  return (
    <h3 className="text-3xl leading-[1.1] font-light tracking-tight md:text-5xl">
      {lead} <em className="font-semibold text-[#c85f12] not-italic">{accent}</em>
    </h3>
  )
}

/** Perguntas da página de produto atual */
function faq(shop: ShopData): [string, string][] {
  const pix = shop.pix > 0 ? `, Pix com ${shop.pix}% de desconto` : ''
  return [
    ['Quanto tempo demora para fabricar?', 'Produzimos em até 48 horas úteis e despachamos em seguida.'],
    [
      'Qual o prazo por região?',
      'Sul, Sudeste e Centro-Oeste: 7 a 12 dias úteis. Nordeste: 13 a 17. Norte: 16 a 20. Estimativas sujeitas a variação da transportadora.',
    ],
    ['Como preservar o quadro?', 'Evite sol direto, limpe com pano seco e macio, sem água, álcool ou produto químico, e mantenha longe de umidade excessiva.'],
    ['Quais as formas de pagamento?', `Cartão em até ${shop.installments}× sem juros${pix} e boleto.`],
    ['Vocês enviam para todo o Brasil?', 'Sim. A fábrica fica em São José do Rio Preto/SP e enviamos para todas as regiões.'],
  ]
}
