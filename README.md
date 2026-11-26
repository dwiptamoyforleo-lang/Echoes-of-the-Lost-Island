# Journey Home

*Every journey leads somewhere. Yours leads home.*

**Journey Home** is a third-person 3D adventure across a mysterious archipelago built with React, TypeScript, Three.js (`@react-three/fiber` & `@react-three/drei`), Rapier WASM physics (`@react-three/rapier`), Zustand, and Tailwind CSS. Explore five hand-crafted regions, solve environmental puzzles, collect resonant crystals and lore relics, and restore the five Ancient Echoes to rekindle the Sky Temple beacon.

## Regions & Features

1. **The Forgotten Shore** — Sunlit beaches, a hidden sea cave, moving stone ferry, pressure-plate courtyard, and the *Echo of the Tides* (20 crystals, 1 chest).
2. **Whispering Woods** — Bioluminescent forest with animated river & waterfalls, sequence-activated Spirit Totems, rotating counterweight wheels, and a secret briar grotto for the *Echo of the Gale* (25 crystals, 1 chest).
3. **The Sunken Kingdom** — Subterranean halls, interconnected water sluice locks, a drainable flooded cistern with visual underwater tint, and four Guardian Statues protecting the *Echo of the Stars* (30 crystals, 2 chests).
4. **The Frozen Peaks** — Aurora-lit mountain sanctuary with snowfall shaders, slippery glacial ice physics, breakable ice bridges, moving platforms, and solar prism mirror beams guarding the *Echo of the Frost* (30 crystals, 2 chests).
5. **The Sky Temple** — Golden-hour floating islands above a sea of clouds, self-assembling bridges, multi-wing resonance puzzles, Fragment Pedestals, and the *Echo of Eternity* finale (35 crystals, 2 chests).

Includes chunk-based streaming, reference-counted geometry/material caching, adaptive FPS quality scaling (Low / Medium / High / Auto), procedural Web Audio API music & SFX, and `localStorage` expedition saves.

## Controls

### Desktop (Keyboard & Mouse)
- **W / A / S / D** or **Arrow Keys**: Move
- **Left / Right Shift**: Sprint
- **Space**: Jump
- **Mouse Drag** or **Click Canvas (Pointer Lock)**: Orbit camera
- **E**: Interact with switches, chests, mechanisms, doors, and inscriptions
- **I** or **Tab**: Open / close Satchel (Inventory)
- **J**: Open / close Quest Log
- **Esc**: Pause / Resume or close open panels

### Mobile / Touch Devices
- **Left-Half Touch Drag (Virtual Joystick)**: Move (`Walk` / `Run`)
- **Right-Half Touch Drag**: Orbit follow camera
- **Touch Action Buttons (Bottom-Right)**: **Jump**, **Sprint** toggle, and contextual **Interact** button
- **Top HUD Buttons**: Compact Satchel, Quests, and Pause controls

## Local Development

Requirements: **Node.js 22+** and **npm**.

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Run TypeScript type check
npm run lint

# Build the production bundle into dist/
npm run build

# Preview the production build locally
npm run preview
```

## Deploying to GitHub Pages

This project is pre-configured for static hosting on GitHub Pages with relative asset paths (`base: './'` in `vite.config.ts`) and an automated GitHub Actions workflow (`.github/workflows/deploy.yml`).

### Step-by-Step Deployment Guide

1. **Push to `main`**:
   Ensure your code (including `.github/workflows/deploy.yml` and `package-lock.json`) is pushed to the `main` branch on GitHub.
2. **Enable GitHub Pages via GitHub Actions**:
   - Open your repository on GitHub and go to **Settings → Pages**.
   - Under **Build and deployment → Source**, select **GitHub Actions** (not "Deploy from a branch").
3. **Run the Deployment Workflow**:
   - Every push to `main` automatically runs the **Deploy Journey Home** workflow (or trigger it manually under **Actions → Deploy Journey Home → Run workflow**).
   - The workflow runs `npm ci`, `npm run build`, verifies that `dist/index.html` contains zero absolute `/assets/` or `/src/` URLs, and publishes `./dist` to GitHub Pages.
4. **Open Your Live URL**:
   - Once the workflow finishes, visit your Pages URL shown in the workflow summary or **Settings → Pages**, for example:
     `https://dwiptamoyforleo-lang.github.io/Journey-Home/`
5. **Renaming the Repository**:
   Because `vite.config.ts` sets `base: './'`, no asset paths or Vite config changes are needed if you fork or rename the repository—simply re-run the workflow in the renamed repository.

