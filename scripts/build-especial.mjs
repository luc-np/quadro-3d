// npm run build:especial [-- --theme ../theme-salao] [--only imersivo]
//
// Monta as páginas de produto embutíveis — a especial (src/embed/especial.tsx) e a imersiva
// (src/embed/imersivo.tsx) — cada uma num módulo ES só, com React, three, R3F e drei dentro, e o
// CSS dela (Tailwind, src/embed/<nome>.css) como texto para o Shadow DOM. --only <nome> monta
// só uma delas. Copia os arquivos que a página usa com nomes planos (o tema não tem
// subpastas em assets): texturas das molduras, da embalagem e as fotos do ambiente.
//
// Com --theme <pasta do tema>: copia tudo para <tema>/assets e escreve
// <tema>/snippets/gq-especial-assets.liquid (o mapa caminho → asset_url, lido pela seção).
import { build } from 'esbuild'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const { values: args } = parseArgs({ options: { theme: { type: 'string' }, only: { type: 'string' } } })
const PAGES = ['especial', 'imersivo'].filter((page) => !args.only || page === args.only)
if (!PAGES.length) throw new Error(`--only: use especial ou imersivo`)
const OUT = path.join(ROOT, 'dist', 'embed')
/** Prefixo dos arquivos no tema: o mesmo do visualizador da galeria (as texturas são as mesmas) */
const PREFIX = 'gq3d-'

await mkdir(OUT, { recursive: true })

const outputs = []
for (const page of PAGES) {
  // CSS: Tailwind só das classes usadas nos componentes da página
  const cssFile = path.join(ROOT, `src/embed/${page}.css`)
  const { css } = await postcss([tailwind({ base: ROOT, optimize: { minify: true } })]).process(await readFile(cssFile, 'utf8'), { from: cssFile })

  const result = await build({
    entryPoints: [path.join(ROOT, `src/embed/${page}.tsx`)],
    outfile: path.join(OUT, `${PREFIX}${page}.js`),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    metafile: true,
    plugins: [
      {
        name: 'especial-css',
        setup(build) {
          build.onResolve({ filter: /^especial:css$/ }, () => ({ path: 'especial:css', namespace: 'especial-css' }))
          // As regras @property (variáveis do Tailwind com valor inicial) não valem dentro de um Shadow
          // DOM: vão à parte, para a página registrar no documento (o registro vale para tudo)
          build.onLoad({ filter: /.*/, namespace: 'especial-css' }, () => {
            const properties = (css.match(/@property\s+--[\w-]+\s*\{[^}]*\}/g) ?? []).join('')
            return { contents: `export default ${JSON.stringify(css)}; export const properties = ${JSON.stringify(properties)}`, loader: 'js' }
          })
        },
      },
    ],
  })
  const output = Object.values(result.metafile.outputs)[0]
  outputs.push(`${PREFIX}${page}.js`)
  console.log(`${PREFIX}${page}.js: ${(output.bytes / 1024).toFixed(0)} KB (CSS ${(css.length / 1024).toFixed(0)} KB)`)
}

// Arquivos: /textures/madeira/x.webp → gq3d-madeira-x.webp; /ambiente/x.webp → gq3d-ambiente-x.webp
const assets = {}
const add = async (dir, file, url) => {
  const name = `${PREFIX}${path.basename(dir)}-${file}`
  await copyFile(path.join(dir, file), path.join(OUT, name))
  assets[url] = name
}
const textures = path.join(ROOT, 'public', 'textures')
for (const dir of await readdir(textures, { withFileTypes: true })) {
  if (!dir.isDirectory() || dir.name === 'arte') continue
  for (const file of await readdir(path.join(textures, dir.name))) {
    if (!file.endsWith('.webp')) continue
    // Da sala 3D, só a textura de bolhas da espuma das cantoneiras (o ambiente é foto)
    if (dir.name === 'sala' && !file.startsWith('curly_teddy_natural_nor_gl')) continue
    await add(path.join(textures, dir.name), file, `/textures/${dir.name}/${file}`)
  }
}
const ambiente = path.join(ROOT, 'public', 'ambiente')
for (const file of await readdir(ambiente)) {
  if (file.endsWith('.webp')) await add(ambiente, file, `/ambiente/${file}`)
}

console.log(`${Object.keys(assets).length} arquivos (texturas e fotos do ambiente)`)

if (args.theme) {
  const theme = path.resolve(args.theme)
  for (const name of [...outputs, ...Object.values(assets)]) {
    await copyFile(path.join(OUT, name), path.join(theme, 'assets', name))
  }
  const entries = Object.entries(assets).map(([url, name]) => `  ${JSON.stringify(url)}: {{ '${name}' | asset_url | json }}`)
  const snippet = [
    '{%- comment -%}',
    '  Gerado por quadro-3d (npm run build:especial -- --theme): endereço de cada arquivo da página',
    '  especial de produto (texturas e fotos do ambiente), pelo caminho usado no projeto. Não editar à mão.',
    '{%- endcomment -%}',
    '{',
    entries.join(',\n'),
    '}',
    '',
  ].join('\n')
  await writeFile(path.join(theme, 'snippets', 'gq-especial-assets.liquid'), snippet)
  console.log(`copiado para ${theme}/assets e snippets/gq-especial-assets.liquid`)
}
