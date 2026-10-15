# Contexto

Projeto Next.js (App Router, TypeScript, Tailwind) com uma cena 3D em React Three Fiber.
O objetivo é uma seção de landing page de um **quadro decorativo em canvas com moldura flutuante**
que reage ao scroll:

1. Conforme o usuário rola, o quadro **gira** e mostra as texturas (trama do canvas, madeira).
2. Continuando o scroll, as partes se **separam (vista explodida)** e cada uma ganha uma
   **explicação** (label + descrição).

Não usamos modelos externos: toda a geometria é gerada em código a partir de dados.

# O que já existe (passo 1, pronto e validado)

- `src/components/scene/parts.ts` — fonte da verdade. `FrameSpec` (medidas em metros) e `PARTS`
  (tela, chassi, moldura), cada parte com `label`, `description`, `explode` (deslocamento em z),
  `material` e `build(spec)` que devolve as caixas da parte. Eixos: x largura, y altura, z profundidade;
  frente da tela em z = 0, tudo cresce para trás.
- `src/components/scene/Frame.tsx` — renderiza `PARTS`; cada parte é um `<group>` com material
  compartilhado (descartado no unmount). Aceita a prop `explode` (0–1).
- `src/components/scene/Scene.tsx` — Canvas, luzes, Environment, OrbitControls (temporário).
- `src/components/scene/SceneLoader.tsx` — `dynamic(() => import('./Scene'), { ssr: false })`.
- `src/app/page.tsx` — renderiza o SceneLoader.

Leia esses arquivos antes de começar e mantenha a arquitetura: **parts.ts descreve, Frame renderiza**.
Nova parte ou ajuste de medida deve continuar sendo uma mudança só de dados.

# Roteiro (um passo por vez)

**Passo 2 — Texturas**

- Frente da tela: arte como `map` + trama de canvas como `normalMap` com `RepeatWrapping`
  (repetição independente da arte), `roughness` alto. A arte não pode distorcer: respeitar a proporção.
- Laterais da tela: arte esticada na borda (ou cor sólida configurável).
- Chassi: madeira clara (pinus). Moldura: madeira escura.
- Texturas PBR gratuitas (ambientCG/Poly Haven) em `public/textures/`, no máximo 1–2k, em WebP ou KTX2.
  Se não conseguir baixar, deixe os caminhos configurados e me diga quais arquivos colocar.
- Materiais/texturas definidos em `parts.ts`; carregar com `useTexture` dentro de Suspense.
- Luz rasante lateral para a trama aparecer quando o quadro gira.

**Passo 3 — Rotação no scroll**

- Trocar OrbitControls por `ScrollControls` + `useScroll` do drei.
- Timeline em uma constante única (ex.: `TIMELINE = { rotate: [0, 0.4], explode: [0.5, 0.4] }`),
  usando `scroll.range()`.
- Estado sempre derivado do scroll (rolar para cima desfaz a animação, sem estado extra).
- Suavizar com `easing.damp` do `maath`.

**Passo 4 — Vista explodida**

- Cada parte desloca em z por `part.explode * progresso` no trecho de explode da timeline.
- Leve rotação do grupo (~25–30°) para dar perspectiva às camadas.

**Passo 5 — Explicações**

- Label e descrição de cada parte vindas de `PARTS`, via `<Html>` do drei ancorado na parte
  ou seções em `<Scroll html>`, aparecendo em sincronia com o explode.
- Texto acessível (HTML real, legível por leitor de tela), não texto 3D.

**Passo 6 — Polimento**

- Responsivo: no mobile, menos separação e câmera/escala ajustadas pela largura do viewport.
- `prefers-reduced-motion`: sem animação de scroll; mostrar estados estáticos.
- Performance: `dpr={[1, 2]}`, sem `setState` dentro de `useFrame` (mutar refs), texturas comprimidas,
  sombras só onde fazem diferença. Medir com o r3f-perf em dev.
- Fallback de loading e de WebGL indisponível.

# Regras de trabalho

- Faça **um passo por vez**. Ao terminar cada um, rode `npm run build` e `npx tsc --noEmit`,
  resuma o que mudou e o que devo conferir visualmente, e **pare para eu validar** antes do próximo.
- TypeScript estrito, sem `any`. Componentes pequenos, funções puras para cálculo de geometria.
- Não adicione dependências além de three, @react-three/fiber, @react-three/drei e maath
  sem me perguntar antes.
- Valores mágicos (medidas, tempos, intensidades) em constantes nomeadas ou no `parts.ts`.
- Se algo do roteiro não fizer sentido técnico, diga e proponha alternativa em vez de forçar.

Comece pelo passo 2.
