# Prompts dos ambientes da vista "Na parede"

Fotos geradas no Gemini (em inglês: ele segue medidas e restrições com mais precisão), sem quadro e
sem escrita; o quadro em 3D é colocado na parede pela página (`src/components/especial/PhotoRoom.tsx`).

Para cada ambiente são duas imagens: gere primeiro a do **computador (16:9)** e depois a do
**celular (9:16)** com a do computador anexada, para sair o mesmo cômodo.

## Por que todos seguem o mesmo padrão

- **Câmera de frente para a parede** (perspectiva de um ponto, a 1,30 m de altura, lente 35 mm):
  a foto não pode entortar, senão o quadro em 3D não "cola" na parede.
- **Pé-direito de 2,80 m e a parede inteira, do piso ao teto, no computador:** a escala da foto é
  medida pelas linhas do piso e do teto (`floorLine`, `ceilingLine` em `AMBIENT`).
- **Um móvel de referência com largura e altura exatas, centralizado:** no celular o teto não
  aparece e a escala vem da altura dele; e o quadro é pendurado acima dele (como acima do encosto
  do sofá: `sofaTop` + `hangGap`).
- **Luz de janela à esquerda:** a sombra do quadro na parede é pintada caindo para a direita
  (`AMBIENT.light`). Todos os ambientes com a mesma luz.
- **Parede vazia e uniforme acima do móvel:** é onde o quadro entra (qualquer tamanho, até 150 cm).

Depois de gerar: salve em `public/ambiente/` (ex.: `quarto-computador.png`, `quarto-celular.png`)
e confira se o móvel saiu do tamanho pedido e se a luz veio da esquerda.

---

## Sala de estar (a que já está na página)

Móvel de referência: sofá de 2,10 m de largura, encosto a 0,85 m.

```
Photorealistic interior photograph of a modern, cozy Brazilian living room. Straight-on frontal view of one wall: one-point perspective, the camera perpendicular to the wall, centered, at about 1.30 m height. 35mm lens, no distortion, all vertical lines perfectly vertical, horizon perfectly level. Architectural interior photography on a full-frame camera, f/8, everything sharp (deep depth of field), natural colors, high dynamic range.

The frame shows the full height of the wall, from the floor to the ceiling (ceiling height 2.80 m). The wall spans the whole image width (about 5 m visible).

THE WALL: smooth matte paint in warm off-white / light greige, uniform, with a simple white baseboard at the bottom. The wall must be COMPLETELY EMPTY: nothing hanging, nothing mounted. A large clear area is centered above the sofa, at least 1.8 m wide, from 20 cm above the sofa backrest up to the ceiling. The upper-left part of the wall is also empty and clean.

FURNITURE (centered, against the wall):
- a modern, low 3-seat sofa, exactly 2.10 m wide, backrest 0.85 m high, in a warm greige textured fabric (linen or wool), with slim wooden legs;
- on the sofa, three throw pillows: terracotta, olive green and a cream bouclé;
- on the left of the sofa, a large potted plant on the floor (philodendron or fiddle-leaf fig, about 1.2 m tall) in a matte ceramic pot;
- on the right of the sofa, a small round light-oak side table with a single matte ceramic vase;
- a light natural oak wood floor and a cream natural-fiber rug under the sofa.

LIGHTING: soft natural daylight from a large window just out of frame on the left, late morning, slightly warm. Gentle, soft shadows falling to the right. Smooth, even light on the wall, with no sun patches, no light beams and no strong gradients in the empty wall area.

Palette: warm neutrals — sand, beige, cream, light oak — with terracotta and olive accents. Calm, minimal, elegant.

DO NOT include: picture frames, paintings, posters, art, mirrors, shelves, wall lamps, sconces, TV, clocks, plants hanging on the wall, wallpaper, wall patterns, moldings on the wall, curtains on the wall area, text, letters, numbers, logos, signatures, watermarks, people, animals, clutter, fisheye, tilted perspective, heavy vignette, blur.

Aspect ratio 16:9, highest resolution available (ideally 3840×2160).
```

---

## Quarto

Móvel de referência: cama queen com cabeceira estofada de 1,70 m de largura e 1,20 m de altura.

```
Photorealistic interior photograph of a modern, cozy Brazilian bedroom. Straight-on frontal view of the wall behind the bed: one-point perspective, the camera perpendicular to the wall, centered on the bed, at about 1.30 m height. 35mm lens, no distortion, all vertical lines perfectly vertical, horizon perfectly level. Architectural interior photography on a full-frame camera, f/8, everything sharp (deep depth of field), natural colors, high dynamic range.

The frame shows the full height of the wall, from the floor to the ceiling (ceiling height 2.80 m). The wall spans the whole image width (about 5 m visible).

THE WALL: smooth matte paint in warm off-white / light greige, uniform, with a simple white baseboard at the bottom. The wall must be COMPLETELY EMPTY: nothing hanging, nothing mounted. A large clear area is centered above the headboard, at least 1.8 m wide, from 20 cm above the headboard up to the ceiling. The upper-left part of the wall is also empty and clean.

FURNITURE (centered, against the wall):
- a queen-size bed with a freestanding upholstered headboard attached to the bed (not a wall panel), the headboard exactly 1.70 m wide and 1.20 m high from the floor, in a warm greige textured fabric;
- crisp white and cream bedding, a linen duvet, a cream bouclé throw folded at the foot of the bed, pillows in cream, terracotta and olive green;
- on each side of the bed, a small light-oak nightstand, 0.50 m wide and 0.55 m high; on the left one, a ceramic table lamp with a linen shade (switched off); on the right one, a small ceramic vase and two books;
- a light natural oak wood floor and a cream natural-fiber rug under the bed.

LIGHTING: soft natural daylight from a large window just out of frame on the left, late morning, slightly warm. Gentle, soft shadows falling to the right. Smooth, even light on the wall, with no sun patches, no light beams and no strong gradients in the empty wall area.

Palette: warm neutrals — sand, beige, cream, light oak — with terracotta and olive accents. Calm, minimal, elegant.

DO NOT include: picture frames, paintings, posters, art, mirrors, shelves, wall-mounted headboard panels, wall lamps, sconces, reading lights on the wall, TV, clocks, plants hanging on the wall, wallpaper, wall patterns, moldings on the wall, curtains on the wall area, text, letters, numbers, logos, signatures, watermarks, people, animals, clutter, fisheye, tilted perspective, heavy vignette, blur.

Aspect ratio 16:9, highest resolution available (ideally 3840×2160).
```

---

## Escritório

Móvel de referência: escrivaninha de 1,40 m de largura e 0,75 m de altura.

```
Photorealistic interior photograph of a modern, cozy Brazilian home office. Straight-on frontal view of one wall: one-point perspective, the camera perpendicular to the wall, centered on the desk, at about 1.30 m height. 35mm lens, no distortion, all vertical lines perfectly vertical, horizon perfectly level. Architectural interior photography on a full-frame camera, f/8, everything sharp (deep depth of field), natural colors, high dynamic range.

The frame shows the full height of the wall, from the floor to the ceiling (ceiling height 2.80 m). The wall spans the whole image width (about 5 m visible).

THE WALL: smooth matte paint in warm off-white / light greige, uniform, with a simple white baseboard at the bottom. The wall must be COMPLETELY EMPTY: nothing hanging, nothing mounted. A large clear area is centered above the desk, at least 1.6 m wide, from 30 cm above the desk top up to the ceiling. The upper-left part of the wall is also empty and clean.

FURNITURE (centered, against the wall):
- a simple light-oak desk with slim legs, exactly 1.40 m wide and 0.75 m high, its back edge touching the wall;
- on the desk: a closed laptop, a ceramic mug, a small potted plant and a ceramic desk lamp (switched off) on the right side; nothing tall in the middle of the desk;
- a modern office chair in cream fabric with a low backrest, pushed in under the desk, its backrest not higher than 0.95 m;
- on the left of the desk, a large potted plant on the floor (about 1.2 m tall) in a matte ceramic pot;
- a light natural oak wood floor and a cream natural-fiber rug under the chair.

LIGHTING: soft natural daylight from a large window just out of frame on the left, late morning, slightly warm. Gentle, soft shadows falling to the right. Smooth, even light on the wall, with no sun patches, no light beams and no strong gradients in the empty wall area.

Palette: warm neutrals — sand, beige, cream, light oak — with terracotta and olive accents. Calm, minimal, elegant.

DO NOT include: picture frames, paintings, posters, art, mirrors, shelves, bookcases, pegboards, whiteboards, monitors, wall lamps, sconces, TV, clocks, plants hanging on the wall, wallpaper, wall patterns, moldings on the wall, curtains on the wall area, text, letters, numbers, logos, signatures, watermarks, people, animals, clutter, cables, fisheye, tilted perspective, heavy vignette, blur.

Aspect ratio 16:9, highest resolution available (ideally 3840×2160).
```

---

## Sala de jantar

Móvel de referência: buffet de 1,80 m de largura e 0,80 m de altura (a mesa fica na frente, mais baixa).

```
Photorealistic interior photograph of a modern, cozy Brazilian dining room. Straight-on frontal view of one wall: one-point perspective, the camera perpendicular to the wall, centered, at about 1.30 m height. 35mm lens, no distortion, all vertical lines perfectly vertical, horizon perfectly level. Architectural interior photography on a full-frame camera, f/8, everything sharp (deep depth of field), natural colors, high dynamic range.

The frame shows the full height of the wall, from the floor to the ceiling (ceiling height 2.80 m). The wall spans the whole image width (about 5 m visible).

THE WALL: smooth matte paint in warm off-white / light greige, uniform, with a simple white baseboard at the bottom. The wall must be COMPLETELY EMPTY: nothing hanging, nothing mounted. A large clear area is centered above the sideboard, at least 1.8 m wide, from 20 cm above the sideboard top up to the ceiling. The upper-left part of the wall is also empty and clean.

FURNITURE (centered):
- against the wall, a long low light-oak sideboard (buffet) with slatted doors, exactly 1.80 m wide and 0.80 m high; on it, a ceramic vase with a few dried branches on the right and a small stack of plates on the left, nothing tall in the middle;
- in front of it, the far half of a round light-oak dining table (0.75 m high) with two cream upholstered dining chairs, cut by the bottom edge of the image; the table and chairs do not cover the top of the sideboard;
- a light natural oak wood floor.

LIGHTING: soft natural daylight from a large window just out of frame on the left, late morning, slightly warm. Gentle, soft shadows falling to the right. Smooth, even light on the wall, with no sun patches, no light beams and no strong gradients in the empty wall area.

Palette: warm neutrals — sand, beige, cream, light oak — with terracotta and olive accents. Calm, minimal, elegant.

DO NOT include: pendant lamps, chandeliers, picture frames, paintings, posters, art, mirrors, shelves, wall lamps, sconces, TV, clocks, plants hanging on the wall, wallpaper, wall patterns, moldings on the wall, curtains on the wall area, text, letters, numbers, logos, signatures, watermarks, people, animals, clutter, fisheye, tilted perspective, heavy vignette, blur.

Aspect ratio 16:9, highest resolution available (ideally 3840×2160).
```

---

## Hall de entrada

Móvel de referência: aparador de 1,20 m de largura e 0,80 m de altura.

```
Photorealistic interior photograph of a modern, cozy Brazilian entryway (hall). Straight-on frontal view of one wall: one-point perspective, the camera perpendicular to the wall, centered on the console table, at about 1.30 m height. 35mm lens, no distortion, all vertical lines perfectly vertical, horizon perfectly level. Architectural interior photography on a full-frame camera, f/8, everything sharp (deep depth of field), natural colors, high dynamic range.

The frame shows the full height of the wall, from the floor to the ceiling (ceiling height 2.80 m). The wall spans the whole image width (about 4 m visible).

THE WALL: smooth matte paint in warm off-white / light greige, uniform, with a simple white baseboard at the bottom. The wall must be COMPLETELY EMPTY: nothing hanging, nothing mounted. A large clear area is centered above the console table, at least 1.4 m wide, from 20 cm above the console top up to the ceiling. The upper-left part of the wall is also empty and clean.

FURNITURE (centered, against the wall):
- a slim light-oak console table (aparador), exactly 1.20 m wide, 0.80 m high and 0.35 m deep;
- on it: a ceramic vase with a few dried branches on the left (not taller than 0.45 m above the console), a small wooden tray with keys and a ceramic bowl on the right;
- under the console, two round woven baskets;
- on the right, a small upholstered bench in cream bouclé; on the left, a tall potted plant on the floor (about 1.2 m) in a matte ceramic pot;
- a light natural oak wood floor and a small cream natural-fiber rug.

LIGHTING: soft natural daylight from a window just out of frame on the left, late morning, slightly warm. Gentle, soft shadows falling to the right. Smooth, even light on the wall, with no sun patches, no light beams and no strong gradients in the empty wall area.

Palette: warm neutrals — sand, beige, cream, light oak — with terracotta and olive accents. Calm, minimal, elegant.

DO NOT include: picture frames, paintings, posters, art, mirrors, shelves, coat hooks, wall lamps, sconces, TV, clocks, plants hanging on the wall, wallpaper, wall patterns, moldings on the wall, doors on the wall area, curtains on the wall area, text, letters, numbers, logos, signatures, watermarks, people, animals, clutter, fisheye, tilted perspective, heavy vignette, blur.

Aspect ratio 16:9, highest resolution available (ideally 3840×2160).
```

---

## Celular (9:16), para qualquer ambiente

Anexe a imagem do computador do mesmo ambiente e troque `[MÓVEL]` pelo móvel de referência dele
(em inglês, com as medidas), por exemplo:

- sala: `the sofa (2.10 m wide, backrest 0.85 m high)`
- quarto: `the bed headboard (1.70 m wide, 1.20 m high)`
- escritório: `the desk (1.40 m wide, 0.75 m high)`
- sala de jantar: `the sideboard (1.80 m wide, 0.80 m high)`
- hall: `the console table (1.20 m wide, 0.80 m high)`

```
Using the attached image as the exact reference, recreate THE SAME room in vertical 9:16 format: the same wall color, furniture, objects, floor, rug, light direction and color. Same straight-on frontal one-point perspective, camera perpendicular to the wall and centered on [MÓVEL], vertical lines perfectly vertical.

Frame it so [MÓVEL] fills about 85% of the image width, standing in the lower third of the image. Keep its exact size and proportions from the reference. Above it, the empty wall goes up to the ceiling, with a large clear area for a picture (at least 1.2 m tall above it). The top quarter of the image is clean, empty wall.

The wall must stay COMPLETELY EMPTY. No frames, paintings, posters, mirrors, shelves, lamps on the wall, text, letters, logos or watermarks. Photorealistic, sharp, natural colors.

Aspect ratio 9:16, highest resolution available (ideally 2160×3840).
```

---

## Larguras do móvel (Sala e Quarto) — 11/10

A página deixa escolher a largura do móvel, como o simulador do site antigo: **sofá de 1,60, 2,00 ou
2,40 m** e **cama casal, queen ou king**. Cada largura é uma foto (computador e celular) do MESMO
cômodo, só com o móvel trocado. Os prompts estão em `paredes-vazias/prompts/` (`sala-160|200|240-*`,
`quarto-casal|queen|king-*`).

O que mudou em relação aos prompts acima: o gerador acerta as alturas pedidas, mas faz os móveis mais
largos (o sofá de 2,10 m saiu com ~2,80 m). Por isso a largura agora vai também como **posição na
imagem** (onde o móvel começa e termina, em % da largura, com a parede de ~6 m no computador e de
~2,2 m no celular) e as variações saem **com a base anexada** ("change ONLY the sofa").

Ordem: 1) as bases `sala-200-16x9` e `quarto-queen-16x9`; 2) as variações de computador com a base
anexada; 3) cada celular com o computador da mesma largura anexado. Ao calibrar, conferir a largura
medida (pontas do móvel ÷ px por metro, que vem da altura dele) contra a pedida: mais de ~10 cm de
diferença, gerar de novo.
