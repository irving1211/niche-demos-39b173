# Asset credits: Kettle Rock diesel, Blender test (2026-10-30)

All third-party assets are CC0 (public domain): free for client work, no attribution required. Credited anyway.

## Used in a-blender.html
| Asset | Source | Licence | Link | Used as |
|---|---|---|---|---|
| Metal052C (1K-JPG) | ambientCG.com | CC0 | https://ambientcg.com/view?id=Metal052C | `tex/iron.webp` (bare cast-iron colour), `tex/detail.webp` R (casting height for bump), `tex/detail2.webp` G (iron roughness) |
| SurfaceImperfections008 (1K-JPG) | ambientCG.com | CC0 | https://ambientcg.com/view?id=SurfaceImperfections008 | `tex/detail.webp` G (grime and oil-smear breakup, drip streaks) |
| PaintedMetal014 (1K-JPG) | ambientCG.com | CC0 | https://ambientcg.com/view?id=PaintedMetal014 | `tex/detail.webp` B (paint chip pattern; roughness map only, its rust colour is not used) |
| Metal046B (1K-JPG) | ambientCG.com | CC0 | https://ambientcg.com/view?id=Metal046B | `tex/detail2.webp` R (dark oily-grime variation) |
| Metal009 (1K-JPG) | ambientCG.com | CC0 | https://ambientcg.com/view?id=Metal009 | `tex/detail2.webp` B (brushed / machined roughness on steel, liners, pistons, journals) |

## Our own work (no third-party content)
- `engine.glb`: modelled from scratch in Blender 5.2.3 by `../_src/build_engine.py` (unbranded inline-6, Cat C7 / Cummins ISB-class proportions). The baked mask atlas (local AO, wide AO, edge mask) inside it comes from the same script (Cycles bake).

## Downloaded, evaluated, not used
Metal027 (black powder coat), Metal055A (iron), Rubber004: all ambientCG, CC0. Raw downloads sit in `../_src/cc0/`.

No HDRI is used: the page keeps its RoomEnvironment + spot lights (the Night Shop look). A Poly Haven workshop HDRI at 1k is about 1.5 MB, and the reflections were already good enough on the machined parts.
