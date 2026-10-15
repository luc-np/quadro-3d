// npm run build:embed [-- --theme ../theme-salao]
//
// Monta o visualizador embutível (src/embed/viewer.tsx) num módulo ES só, com React, three,
// R3F e drei dentro, para o tema da loja importar sob demanda. Copia as texturas que os
// modelos usam com nomes planos (o tema não tem subpastas em assets) e escreve o mapa
// caminho → nome em dist/embed/textures.json.
//
// Com --theme <pasta do tema>: copia tudo para <tema>/assets e escreve
// <tema>/snippets/gq-pdp-3d-textures.liquid (o mapa com asset_url, lido pela página de produto).
import { build } from 'esbuild'
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const { values: args } = parseArgs({ options: { theme: { type: 'string' } } })
const OUT = path.join(ROOT, 'dist', 'embed')
/** Prefixo dos arquivos no tema: agrupa e evita colisão com os assets da loja */
const PREFIX = 'gq3d-'

await mkdir(OUT, { recursive: true })

const result = await build({
  entryPoints: [path.join(ROOT, 'src/embed/viewer.tsx')],
  outfile: path.join(OUT, `${PREFIX}viewer.js`),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  metafile: true,
})

// Texturas: /textures/madeira/ash_veneer_diff_1k.webp → gq3d-madeira-ash_veneer_diff_1k.webp
const textures = {}
const base = path.join(ROOT, 'public', 'textures')
for (const dir of await readdir(base, { withFileTypes: true })) {
  // arte: só de exemplo no Next; sala: da sala 3D da página especial (que tem build próprio)
  if (!dir.isDirectory() || dir.name === 'arte' || dir.name === 'sala') continue
  for (const file of await readdir(path.join(base, dir.name))) {
    if (!file.endsWith('.webp')) continue
    const name = `${PREFIX}${dir.name}-${file}`
    await copyFile(path.join(base, dir.name, file), path.join(OUT, name))
    textures[`/textures/${dir.name}/${file}`] = name
  }
}
await writeFile(path.join(OUT, 'textures.json'), JSON.stringify(textures, null, 2) + '\n')

const bytes = Object.values(result.metafile.outputs)[0].bytes
console.log(`${PREFIX}viewer.js: ${(bytes / 1024).toFixed(0)} KB; ${Object.keys(textures).length} texturas`)

if (args.theme) {
  const theme = path.resolve(args.theme)
  for (const name of [`${PREFIX}viewer.js`, ...Object.values(textures)]) {
    await copyFile(path.join(OUT, name), path.join(theme, 'assets', name))
  }
  const entries = Object.entries(textures).map(([url, name]) => `  ${JSON.stringify(url)}: {{ '${name}' | asset_url | json }}`)
  const snippet = [
    '{%- comment -%}',
    '  Gerado por quadro-3d (npm run build:embed -- --theme): endereço de cada textura do visualizador 3D,',
    '  pelo caminho usado nos modelos. Não editar à mão.',
    '{%- endcomment -%}',
    '{',
    entries.join(',\n'),
    '}',
    '',
  ].join('\n')
  await writeFile(path.join(theme, 'snippets', 'gq-pdp-3d-textures.liquid'), snippet)
  console.log(`copiado para ${theme}/assets e snippets/gq-pdp-3d-textures.liquid`)
}
