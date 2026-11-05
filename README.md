# quadro-3d

Quadro 3D da GoQuadros (Next 16, React 19, react-three-fiber, drei, three, Tailwind 4).

## O que é

Cenas 3D do quadro decorativo da loja, em dois usos:

- **Páginas Next** (para desenvolver e ver no navegador): índice dos modelos, landing com rolagem, visualização 360° e a página **especial** (escolhas ligadas às partes do quadro, quadro na parede, por dentro e embalagem).
- **Módulos embutíveis** (`src/embed/`): o mesmo código empacotado com esbuild em arquivos ES soltos, que outros sites carregam: visualizador 3D, galeria 3D da PDP (vistas 3D, Na parede e Escala, com fotos dos ambientes), página especial e página imersiva.

Os modelos não usam arquivos externos de geometria: são gerados em código (`src/components/scene/models/`). A leitura de contexto do projeto está em `leia/` (`PROMPT.md`, roteiro original da cena; `PROMPTS-AMBIENTES.md`, prompts para gerar as fotos dos ambientes).

## Requisitos

- Node **>= 20.9.0** (mínimo exigido pelo Next 16, em `node_modules/next/package.json`; o projeto não declara `engines` nem `.nvmrc`). Foi testado com Node 24 (nvm).
- npm (há `package-lock.json`).

## Instalação e desenvolvimento

```bash
npm install
npm run dev -- -p 3030   # http://localhost:3030
```

`npm run dev` sozinho sobe na porta padrão do Next (3000); a 3030 é só uma convenção local, passada com `-p`.

Outros scripts: `npm run lint` (eslint), `npx tsc --noEmit` (tipos), `npm run build` / `npm run start` (build e servidor de produção do Next).

## Rotas

| Rota | O que mostra |
| --- | --- |
| `/` | Índice: link da página especial e, para cada modelo, Landing e 360° |
| `/especial` | Página especial (escolhas, quadro na parede, por dentro, embalagem) |
| `/[modelo]` | Landing do modelo: o quadro gira e se abre (vista explodida) conforme a rolagem |
| `/[modelo]/360` | Visualização livre: arrastar para girar, rolar para aproximar |

`[modelo]` aceita só: `canvas`, `caixa`, `caixa-vidro`, `filete`, `filete-vidro`, `placa-mdf`. Qualquer outro valor dá 404.

Parâmetro de query: só `?variant=<id>` (id numérico da variante do produto), lido na página especial; sem ele, ou com um id que não existe nos dados, abre na variante padrão. A página especial usa dados de demonstração (`src/components/especial/demo-product.json`).

Exemplos:

```
http://localhost:3030/
http://localhost:3030/canvas
http://localhost:3030/caixa-vidro/360
http://localhost:3030/especial?variant=<id>
```

A página imersiva (`imersivo`) existe só como módulo embutível; não há rota Next para ela.

## Builds

Os scripts de embed gravam em `dist/` (ignorado pelo git). Opções de cada um estão no cabeçalho do script.

| Comando | Gera |
| --- | --- |
| `npm run build` | Build do app Next (`.next/`) |
| `npm run build:embed` | `dist/embed/gq3d-viewer.js` (visualizador 3D), texturas com nome plano (`gq3d-<pasta>-<arquivo>.webp`) e `textures.json`. |
| `npm run build:especial` | `gq3d-especial.js` e `gq3d-imersivo.js` (com o CSS Tailwind embutido, para Shadow DOM), texturas e fotos de `public/ambiente`. `-- --only especial` ou `-- --only imersivo` monta só uma. |
| `npm run build:galeria` | `gq3d-galeria.js`, texturas, fotos dos ambientes e versões leves para celular (sufixo `-sm`: texturas, fotos de 720/1280 px). |

## Assets

Tudo em `public/`:

- `textures/<grupo>/`: texturas PBR em `.webp` (`canvas`, `madeira`, `mdf`, `ferragens`; `arte` é só a arte de exemplo do Next; `sala` é da sala 3D da página especial). Convenção: `_diff` (cor), `_nor_gl` (normal), `_rough`/`_arm`.
- `models/`: modelos glTF (`ceramic_vase_01`, `potted_plant_02`) com `.bin` e texturas.
- `hdri/studio_small_03_1k.hdr`: iluminação do estúdio.
- `ambiente/`: fotos dos ambientes da vista "Na parede" (`<ambiente>-celular.webp`, `-computador.webp`, `-computador-frente.webp`, `-mini.webp` para miniatura). Os PNGs grandes são originais.
- `molduras/`: fotos das molduras.

Adicionar:

- **Textura**: coloque o `.webp` (até 1k) em `public/textures/<grupo>/` e referencie pelo caminho `/textures/<grupo>/<arquivo>.webp` em `src/components/scene/materials.ts` / `models/surfaces.ts`. Os builds copiam sozinhos todo `.webp` das pastas de texturas (exceto `arte`, e `sala` conforme o build).
- **Ambiente**: gere as fotos seguindo `leia/PROMPTS-AMBIENTES.md`, salve em `public/ambiente/` com o padrão de nomes acima e cadastre o cômodo em `ROOMS` (`src/components/imersivo/rooms.ts`) com as medidas de piso/teto e do móvel de referência. Rode `build:galeria` e `build:especial` para regerar os módulos.

## Estrutura de pastas

```
src/app/          rotas Next: /, /especial, /[modelo], /[modelo]/360
src/components/
  scene/          cena base: Frame, Studio, materiais, timeline; models/ define os 6 modelos
  especial/       página especial (Overlay, BuyPanel, PhotoRoom, Packaging, shop.ts...)
  imersivo/       página imersiva e catálogo de ambientes (rooms.ts)
  galeria/        galeria 3D da PDP
src/embed/        pontos de entrada dos módulos embutíveis (viewer, galeria, especial, imersivo)
scripts/          build-embed.mjs, build-especial.mjs, build-galeria.mjs
public/           texturas, modelos, HDRI, fotos dos ambientes, molduras
leia/             documentos de contexto (roteiro da cena, prompts dos ambientes)
dist/             saída dos builds embutíveis (não versionada)
```

Aviso do `AGENTS.md`: este Next 16 tem mudanças incompatíveis; consulte `node_modules/next/dist/docs/` antes de mexer em APIs do Next.
