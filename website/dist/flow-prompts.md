# Vestigo: Google Flow motion kit

Six production prompts for the Vestigo landing page. The website currently uses code-driven motion and a generated reference image; no Google Flow video has been generated or charged through this project.

## Visual system

- Warm ivory studio: #f5f3ee.
- Vermilion orange translucent resin: #ed5427.
- Matte graphite: #24251f.
- Continuous ribbon, layered memory, precise slow movement.
- No generated UI, fake code, baked-in typography, statistics, or logos. Keep UI and copy in HTML so they stay crisp and accurate.

The approved reference is [assets/memory-sculpture.png](assets/memory-sculpture.png). Upload it as a first frame or reference ingredient where your selected Flow model supports that mode. Preserve the same palette, materials, geometry, lighting and object count across clips.

## How to generate efficiently

1. Start with prompt 01. Use one output and a draft setting available in your account before spending credits on final quality.
2. Select landscape 16:9 and an eight-second length where supported. For prompt 06 select portrait 9:16.
3. Use the reference image as a start frame. For a loop, use matching start and end framing when the model supports end frames. Review the join; seamless looping is an artistic target, not guaranteed by the prompt.
4. Ask for one slow camera movement. Generate background footage only; keep labels, product demonstrations and other precise information in code.
5. Download the selected clip. The website plays it muted. Export an H.264 MP4, ideally 1080p with a small web payload (target under 5 MB), then check visual quality on mobile.
6. Keep a still poster. The page respects reduced-motion settings, a manual pause control, and data-saving mode, with code-driven artwork as the default.

Availability, controls, clip lengths and generation charges vary by model, account and region. Check the settings shown in your Flow project before generating.

## Add the hero video to the website

Place the chosen hero MP4 at website/dist/media/hero-loop.mp4 and update website/dist/media/manifest.json to:

```json
{ "hero": "media/hero-loop.mp4" }
```

The page loads the video progressively and keeps the original artwork if it cannot play. Other prompts are assets for alternate hero cuts, social posts, or future sections; they are not wired into empty video players.

## Prompts

### 01 / The continuous thread

HERO LOOP · 16:9 · 8 SECONDS

Use the supplied Vestigo sculpture image as the first-frame reference. Premium photorealistic studio film: one continuous translucent vermilion orange resin ribbon spirals through three matte graphite slabs, suspended over a warm ivory seamless floor. Very slow five-degree clockwise camera orbit with a tiny upward drift; the ribbon makes one subtle breathing movement while keeping its shape and uninterrupted path. Soft afternoon light from upper left, realistic contact shadows, tactile frosted acrylic and fine graphite grain, 70mm product lens. Preserve the reference silhouette, object count and palette. Start and finish with near-identical framing for a quiet seamless website loop. Keep the object inside the central 65 percent, with clean space around it. No text, logos, UI, people, cuts, fast motion or flashing. No dialogue or music; the website uses muted playback.

### 02 / A decision finds its place

CAPTURE SCENE · 16:9 · 8 SECONDS

In the same warm ivory studio and material language as the supplied Vestigo sculpture, show three small matte graphite slabs floating separately, neatly aligned with breathing room. A single vermilion orange translucent ribbon slowly threads through them from lower left to upper right, connecting each layer in one continuous, elegant gesture. Each layer settles gently as it connects. One slow, stable camera push-in, soft side lighting, delicate shadows, premium macro industrial design film. Begin spacious, end with one coherent sculpture. Preserve physical material consistency. No text, numbers, interfaces, hands, extra objects, neon lighting, abrupt cuts or energetic particle effects. No speech or music.

### 03 / Pick up the thread

CONTEXT RESTORATION · 16:9 · 8 SECONDS

Match the supplied Vestigo orange-ribbon and graphite-slab reference exactly in palette and materials. Begin close on the smooth open end of a translucent orange ribbon resting beside three orderly graphite layers. A subtle warm highlight travels along the ribbon, revealing its existing continuous connection through each layer; the camera gently pulls back to reveal the complete sculpture. The idea is rediscovering a connection that was already there, not creating information from nothing. Ivory seamless studio, restrained cinematic product photography, soft side light, realistic shadows, calm deliberate movement. Hold the complete object for the final two seconds. No text, UI, people, light flashes, hard cuts, logos or voiceover.

### 04 / Small on purpose

COMPACT MEMORY · 16:9 · 8 SECONDS

A minimal physical metaphor for concise project memory, in an ivory product studio. Seven thin dark graphite slips lie in a loose but orderly fan. A short frosted vermilion orange ribbon gently gathers them into a compact, beautifully aligned layered object. Nothing is shredded, erased or discarded; the layers remain visible at the edges. Fixed three-quarter camera with a very slow macro push-in. Tactile materials, exact geometric edges, soft warm daylight, realistic gravity and contact shadows. Composition remains spacious. End with a two-second still hold. Do not add percentages, efficiency numbers, letters, interfaces, logos, people or extra props. No music or speech.

### 05 / Context travels with you

PORTABLE MEMORY · 16:9 · 8 SECONDS

A quiet architectural product film in the Vestigo visual language. Two simple graphite rectangular frames stand on an ivory studio floor, left and right. A compact layered graphite object bound by one translucent orange ribbon glides gently from the first frame into the second, staying intact and unchanged. One continuous stable lateral camera tracking shot. It conveys carrying a project handoff into a new workspace. Realistic material surfaces, subtle shadows, premium industrial design, no magic particles, no abrupt acceleration. Keep a clean central composition and leave negative space for HTML captions added outside the video. No generated text, symbols, numbers, code, logos, people or narration.

### 06 / Worth remembering

PORTRAIT TEASER · 9:16 · 8 SECONDS

Vertical 9:16 cinematic product teaser. Use the supplied Vestigo sculpture as the material and object reference. One vivid vermilion orange translucent resin ribbon wraps elegantly through three matte graphite slabs on a warm ivory seamless floor. Start on a macro detail of the orange ribbon edge, move smoothly into a three-quarter view of the full sculpture, and hold the final composition for two seconds. The motion is slow, tactile and precise, like an independent design studio film. Soft afternoon side light and realistic shadows. Keep the object centered in the middle 60 percent of the portrait frame, with generous clean space above and below for titles added in editing. No baked-in text, fake UI, logos, people, cuts, strobing, speech or music.

## Official Flow references

- [Create videos, including references and start/end frames](https://support.google.com/flow/answer/16353334?hl=en)
- [Models and supported features](https://support.google.com/flow/answer/16352836?hl=en)
- [Edit clips and build scenes](https://support.google.com/flow/answer/16935718?hl=en)

Research checked on 2026-11-03. Product settings can change.
