# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-page static website hosted via GitHub Pages (custom domain via CNAME). The project contains several standalone HTML pages:

- `index.html` - Industrial-themed portfolio page (Tailwind CSS, vanilla JS theme switching)
- `rigveda.html` - 3D interactive wheel for Rigveda Mandal exploration (Three.js, post-processing bloom)
- `moon.html` - Moon phase 3D visualization
- `chess.html` - Chess game implementation
- `sudoku.html` - Sudoku puzzle with generator

## Key Architecture

### Rigveda 3D Experience (`rigveda.html` + `src/main.js`)

The main 3D application uses Three.js with these key systems:

**3D Scene Setup:**
- Uses Three.js with DRACO and KTX2 loaders for compressed GLTF models
- Post-processing pipeline with `EffectComposer` and `UnrealBloomPass` for glow effects
- Star fields (far/mid/near) with animated nebula sprites and fog
- Golden chariot wheel model (`assets/models/golden-chariot-wheel-draco-ktx2.glb`)

**Screen State Machine:**
Three screens managed via `currentScreen` variable: "start" → "main" → "overlay"
- Camera animates between positions using LERP
- Wheel spins on start screen, stops on main screen
- Radial text sprites fade in based on camera position

**Mandal Content System:**
- `assets/mandalas/manifest.json` maps mandal numbers (1-10) to content:
  - `Podcasts["1"]` → audio file path
  - `Videos["1"]` → video file path
  - `OriginalText["1"]` → PDF download
  - `Flashcards["1"]` → PDF flashcards
  - `Mandals["1"]` → array of thumbnail image paths
- Overlay dynamically loads content based on selected mandal index
- LocalStorage saves/resumes playback position for media

**Radial Text Sprites:**
- `createRadialTextSprites()` generates canvas-based text labels positioned around wheel
- Sprites track wheel rotation via `updateRadialTextSpriteTransformsWithOffset()`
- Fade in/out controlled by `textFadeProgress` (0-1)

**Controls:**
- On-screen buttons (bottom-right): info (ℹ), previous (◀), next (▶)
- Keyboard: Enter (advance), Escape (back), ArrowLeft/Right (rotate wheel)
- Accessibility: ARIA live region announces mandal changes, focus trap in overlay

### Audio Player (`src/player.js`)

Background audio player with context-aware volume:
- Start screen: 100% volume
- Main screen: 20% volume
- Mandal overlay: 10% volume
- Uses MutationObserver to detect overlay visibility changes
- Saves playback position to localStorage

### Industrial Portfolio (`index.html`)

Standalone HTML with:
- Tailwind CSS via CDN (no build step)
- Dark/light mode with CSS class toggling
- Theme color customization via CSS variables (`--primary`)
- Industrial design aesthetic with borders, shadows, monospace fonts

## Asset Structure

```
assets/
├── mandalas/manifest.json    # Content mapping for all mandals
├── models/*.glb              # 3D models (DRACO/KTX2 compressed)
├── podcasts/*.mp3            # Mandal audio content
├── videos/*.mp4              # Mandal video content
├── original_text/*.pdf       # Original Sanskrit text PDFs
├── flashcards/*.pdf          # Flashcard PDFs
└── music/                    # Background audio
```

## Development Commands

**No build process** - This is a static site served directly:

```bash
# Serve locally for development
python3 -m http.server 8000
# or
npx serve
```

**Deploy to GitHub Pages:**
```bash
git push origin main
```

## Important Patterns

**Camera Animation:**
- Uses non-linear LERP for smooth easing: `t = 1 - Math.pow(1 - t, 3)`
- `cameraAnimating` flag blocks interactions during transitions

**Wheel Rotation:**
- Step-based rotation: `getWheelRotateStep() = (Math.PI * 2) / spokeCount`
- Animates using cubic ease-out, updates text sprites in real-time

**Text Rendering:**
- Uses Papyrus font with fallbacks for canvas text
- Resolution adjusts based on camera distance (1024→2048px when close)

**Media Handling:**
- Lazy loading: `preload="none"` to save bandwidth
- Composed path handling for shadow DOM video controls
- Playback state persisted to localStorage per mandal

## Common Tasks

**Add new mandal content:**
1. Add media files to `assets/podcasts/`, `assets/videos/`, etc.
2. Update `assets/mandalas/manifest.json` with paths
3. No code changes needed - manifest drives all content

**Adjust 3D camera/scene:**
- Camera positions: `MAIN_SCREEN_POS`, `camInitial` in `src/main.js`
- Bloom settings: `UnrealBloomPass` constructor (strength, radius, threshold)
- Fog: `scene.fog = new THREE.FogExp2(color, density)`

**Modify radial text labels:**
- Edit the array passed to `createRadialTextSprites()` in wheel load callback
- Currently: `["Mandal 1", "Mandal 2", ..., "Mandal 10"]`
