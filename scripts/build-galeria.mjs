// npm run build:galeria [-- --theme ../theme-pdp5d]
//
// Monta a galeria 3D da página de produto (src/embed/galeria.tsx) num módulo ES só, com React,
// three, R3F e drei dentro. Copia, com nomes planos (o tema não tem subpastas em assets), as
// texturas das molduras e as fotos dos ambientes, e faz as versões leves do celular: texturas de
// 512 px e fotos com 720 px (verticais) ou 1280 px (horizontais) de largura (sufixo -sm).
//
// Com --theme <pasta do tema>: copia tudo para <tema>/assets e escreve
// <tema>/snippets/gq-galeria-assets.liquid ({ full, small }: caminho → asset_url).
import { build } from 'esbuild'
import sharp from 'sharp'
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const { values: args } = parseArgs({ options: { theme: { type: 'string' } } })
const OUT = path.join(ROOT, 'dist', 'embed')
const PREFIX = 'gq3d-'

await mkdir(OUT, { recursive: true })

const result = await build({
  entryPoints: [path.join(ROOT, 'src/embed/galeria.tsx')],
  outfile: path.join(OUT, `${PREFIX}galeria.js`),
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
      // A galeria não mostra os números das partes (legenda da landing): o PartMarker usa o Html do
      // drei, que traria o React DOM inteiro para o arquivo
      name: 'sem-numeros-das-partes',
      setup(build) {
        build.onResolve({ filter: /\/PartMarker$/ }, () => ({ path: 'PartMarker', namespace: 'galeria-stub' }))
        build.onLoad({ filter: /.*/, namespace: 'galeria-stub' }, () => ({ contents: 'export function PartMarker() { return null }', loader: 'js' }))
      },
    },
  ],
})

const full = {}
const small = {}
const files = []
const add = async (dir, file, url) => {
  const name = `${PREFIX}${path.basename(dir)}-${file}`
  await copyFile(path.join(dir, file), path.join(OUT, name))
  full[url] = name
  files.push(name)
}
const addSmall = async (dir, file, url, resize, quality) => {
  const name = `${PREFIX}${path.basename(dir)}-${file.replace(/\.webp$/, '-sm.webp')}`
  await sharp(path.join(dir, file)).resize(resize).webp({ quality }).toFile(path.join(OUT, name))
  small[url] = name
  files.push(name)
}

// Texturas das molduras (a arte de exemplo e a sala 3D ficam de fora)
const textures = path.join(ROOT, 'public', 'textures')
for (const dir of await readdir(textures, { withFileTypes: true })) {
  if (!dir.isDirectory() || dir.name === 'arte' || dir.name === 'sala') continue
  const base = path.join(textures, dir.name)
  for (const file of await readdir(base)) {
    if (!file.endsWith('.webp')) continue
    const url = `/textures/${dir.name}/${file}`
    await add(base, file, url)
    const { width = 0 } = await sharp(path.join(base, file)).metadata()
    if (width > 512) await addSmall(base, file, url, { width: 512, height: 512, fit: 'inside' }, 80)
  }
}

// Fotos dos ambientes (as dos cômodos com largura do móvel e as de um tamanho só); as miniaturas
// e a sala antiga (celular/computador.webp, da página especial) ficam de fora
const ambiente = path.join(ROOT, 'public', 'ambiente')
for (const file of await readdir(ambiente)) {
  if (!file.endsWith('.webp') || file.endsWith('-mini.webp') || file === 'celular.webp' || file === 'computador.webp') continue
  const url = `/ambiente/${file}`
  await add(ambiente, file, url)
  // A vitrine do celular é deitada (4:3) e usa a foto horizontal: as duas ganham a versão leve
  if (file.endsWith('-celular.webp')) await addSmall(ambiente, file, url, { width: 720, withoutEnlargement: true }, 78)
  if (file.endsWith('-computador.webp') || file.endsWith('-computador-frente.webp')) await addSmall(ambiente, file, url, { width: 1280, withoutEnlargement: true }, 78)
}

const bytes = Object.values(result.metafile.outputs)[0].bytes
console.log(`${PREFIX}galeria.js: ${(bytes / 1024).toFixed(0)} KB; ${Object.keys(full).length} arquivos, ${Object.keys(small).length} leves`)

if (args.theme) {
  const theme = path.resolve(args.theme)
  for (const name of [`${PREFIX}galeria.js`, ...files]) await copyFile(path.join(OUT, name), path.join(theme, 'assets', name))
  const entries = (map) => Object.entries(map).map(([url, name]) => `    ${JSON.stringify(url)}: {{ '${name}' | asset_url | json }}`).join(',\n')
  const snippet = [
    '{%- comment -%}',
    '  Gerado por quadro-3d (npm run build:galeria -- --theme): endereço de cada arquivo da galeria 3D da',
    '  página de produto (texturas e fotos dos ambientes), pelo caminho usado no projeto; small = as',
    '  versões leves do celular. Não editar à mão.',
    '{%- endcomment -%}',
    '{',
    '  "full": {',
    entries(full),
    '  },',
    '  "small": {',
    entries(small),
    '  }',
    '}',
    '',
  ].join('\n')
  await writeFile(path.join(theme, 'snippets', 'gq-galeria-assets.liquid'), snippet)
  console.log(`copiado para ${theme}/assets e snippets/gq-galeria-assets.liquid`)
}
