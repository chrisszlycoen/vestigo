# Vestigo product website

A standalone, buildless landing page for the VS Code extension. `dist/` contains
the authored HTML, CSS, JavaScript, and original visual assets; there is no framework
build or dependency installation. Keep this folder independent from the extension bundle.

## Preview

From the Vestigo repository root:

```sh
python3 -m http.server 3210 --bind 127.0.0.1 --directory website/dist
```

Open http://127.0.0.1:3210. Use a different free port if necessary.

## Experience

- Original orange-ribbon memory sculpture and matching SVG brand mark.
- Coordinated headline entrances, a scroll-drawn orange thread, and responsive motion.
- An original eight-second, 30 fps H.264 motion film (about 0.8 MB), rendered locally.
- An autoplaying, pauseable three-scene task handoff; manual interaction stops auto-advance.
- Three interactive, explicitly illustrative VS Code scenarios.
- Working keyword search over example memories and keyboard-accessible scenario tabs.
- Installation dialog with a copyable build command; no fabricated marketplace URL.
- Native FAQ disclosures and a copyable Google Flow motion kit.
- Reduced-motion support, a manual motion toggle, and optional muted video playback.

The product example is a marketing demonstration, not a connection to a visitor's
local VS Code project. Product claims reflect the current 0.2.0 extension. There
are no invented customers, testimonials, measured token savings, or signup backend.

## Google Flow videos

Read [the full prompt kit](dist/flow-prompts.md). It includes six prompts, reference
image guidance, video export recommendations, and links to official Google help.
The reference image is [memory-sculpture.png](dist/assets/memory-sculpture.png).

The cinematic section uses an original procedural film, not a Google Flow generation.
The source renderer is `tools/render_memory_film.py` (Pillow and FFmpeg required).
Video and the walkthrough pause offscreen, in background tabs, and when motion is paused.
Reduced-motion and data-saving visitors get still artwork until explicitly choosing playback.
No Flow clips have been generated. To add an alternate hero clip, place the selected MP4 at
`dist/media/hero-loop.mp4` and set `dist/media/manifest.json` to:

```json
{ "hero": "media/hero-loop.mp4" }
```

The page keeps the still artwork if playback fails, avoids requesting video in
data-saving/reduced-motion modes, and provides a pause control. The other prompts
are optional campaign assets rather than empty players on the current page.

## Source and hosting

`.openai/hosting.json` contains the private Sites project identity and static directory.
There are no credentials in the checkout. Publish through the Sites source workflow
and retain the selected project's audience. Preview screenshots and deployment
archives belong outside this source folder. The extension's `.vscodeignore`
excludes this website from the VSIX package.
