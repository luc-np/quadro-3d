/** Medida em metros escrita em centímetros, no formato brasileiro (ex.: 0.038 → "3,8 cm") */
export function cm(meters: number): string {
  return `${(meters * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} cm`
}

/** Medida em metros escrita em milímetros (ex.: 0.003 → "3 mm") */
export function mm(meters: number): string {
  return `${(meters * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mm`
}
