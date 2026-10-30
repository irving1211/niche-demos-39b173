# Marine assets: credits and licences

| File | What it is | Source | Author | Licence | Used for |
|---|---|---|---|---|---|
| `photo-motor.jpg` (69 KB, 960x720) | Older Evinrude 115 "OceanPro" two-stroke on a white boat on its trailer, parking-lot phone photo | https://commons.wikimedia.org/wiki/File:Lancha-atras.jpg | Rodrigo César | Public domain (released by the author, per the file page) | Sample customer photo 1 in the scanner, step-chip thumbnail, owner-phone card thumbnail. Cropped to the motor + stern, resized, +3% contrast. The maker's name on the cowl is the customer's old motor in a customer-style photo (allowed by BRIEF-R3); the "115 hp two-stroke" tag sits over it. |
| `photo-plate.jpg` (68 KB, 960x720) | Close-up of a worn ID plate on a cream clamp bracket | Rendered in code: `src/gen-photos.html?w=plate` (three.js r186 + canvas phone-camera pass) | IC Business Systems (made for this demo) | Own work | Sample customer photo 2. Unbranded plate ("OUTBOARD MOTOR", model 115 TL, 115 hp / 85.8 kW, 20 in. shaft); the serial is a made-up number, blurred. |
| `photo-meter.jpg` (58 KB, 960x720) | Helm hour meter reading 01427.3 on a black gauge panel | Rendered in code: `src/gen-photos.html?w=meter` | IC Business Systems (made for this demo) | Own work | Sample customer photo 3. |
| `src/gen-photos.html` | Generator for the two rendered photos | This repo | IC Business Systems | Own work | Re-render with `?w=plate` / `?w=meter`; the JPEG lands in `window.OUT`. Not loaded by the page. |

Searched and not used: Wikimedia Commons had no free ID-plate photo that matched a 115 hp motor (the only CC0 plate is a 9.8 hp Tohatsu) and no free boat hour-meter close-up (the usable ones are CC BY-SA or panel meters). Pexels search pages were reachable but had no plate or hour-meter close-up either; Unsplash blocked scripted fetches; Openverse timed out. No paid generation was used. No 3D model was downloaded: the boat, trailer, motors, hoist and shop are built in code inside `a.html`.

## Round 4 (2026-10-30): all own work, rendered in code from the page's own 3D boat

| File | What it is | How it was made | Used for |
|---|---|---|---|
| `r4-bay-desk.webp` (58 KB, 2600x1000) | Still of the hero 3D bay, start state (cream 115 on the transom, hook up) | Read back from `a.html`'s own WebGL canvas on the real GPU (desktop camera, 2600x1000 so it covers any desktop width; the CSS pins the camera axis at 67% so it lines up with the live render) | Instant hero poster on desktop, so the first boat anyone sees is the 3D one |
| `r4-bay-desk-end.webp` (57 KB, 2600x1000) | Same bay, end state (graphite 150 on) | Same, page opened with `#done` | No-WebGL fallback: wipes down over the start still when the new motor goes on |
| `r4-bay-phone.webp` (26 KB, 1140x435) | Phone camera start state | Same, phone layout (760 CSS px wide at 1.5x = the phone canvas pixel ratio) | Instant hero poster on phone |
| `r4-bay-phone-end.webp` (26 KB, 1140x435) | Phone camera end state | Same, `#done` | No-WebGL fallback on phone |
| `r4-haul-a.webp` (33 KB, 760x380, transparent) | Boat on the tandem trailer, old 115 | `src/r4-gen-haul.html` (lifts the hull, deck, trailer and motor builders straight out of `a.html`, one amber key + cool rim, shadow catcher) | Haul-out & storage scenes 1, 2 and 3 |
| `r4-haul-b.webp` (29 KB) | Same boat shrink-wrapped (code-built wrap: tent over the T-top, straps, vents, zip door) | same generator | Scene 3 (wraps on top-down) and the dimmed yard boats behind it |
| `r4-haul-c.webp` (23 KB) | Wrapped boat on jack stands + keel blocks, no motor | same generator | Scene 4 |
| `r4-haul-d.webp` (3 KB) | The new graphite 150 alone, registered to scene 4 | same generator | Scene 4 (lowers onto the transom on the hoist) |
| `r4-haul-e.webp` (19 KB) | Boat with the new 150, no trailer | same generator | Scene 5 (launch) |
| `src/r4-gen-haul.html` | Generator for the five haul sprites | This repo | Re-render: open it over a local server on a real GPU; the webp data URLs land in `window.OUT` (+ guide points in `OUT.meta`). Not loaded by the page. |

No downloads and no paid generation in round 4.
