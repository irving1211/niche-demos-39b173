# rigging/assets — credits

| File | What it is | Source | Licence |
|---|---|---|---|
| `still-phone.webp`, `still-desk.webp`, `still-d160/170/178/186/195/205/220.webp` | Pre-rendered first frame of the page's own 3D scene (06:00 opening shot), captured from `a.html` on the real GPU (Chrome `canvas.toDataURL('image/webp', 0.8)`). Shown at first paint until the live scene is ready. Phone = 960x1281; desktop = 1920 wide, one per window aspect band (4:3 default, 16:10, 1.70, 16:9, 1.86, 1.95, 2.05, 2.2). | Made for this demo (no outside material) | Ours |
| `three-rig.min.js` | three.js r186 (`../vendor/three.module.js` + addons RoomEnvironment, RoundedBoxGeometry, BufferGeometryUtils), trimmed to the classes the page uses and minified with `bun build --minify` (0.61 MB instead of 2.2 MB). Same code, same version as `../vendor`. | https://github.com/mrdoob/three.js (vendored copy in `../vendor`) | MIT, Copyright 2010-2026 three.js authors (licence header added at the top of the bundle) |

Rebuild the stills after any change to the opening shot (camera key p=0, lighting, models): see "Round 4" in `../NOTES.md`.
