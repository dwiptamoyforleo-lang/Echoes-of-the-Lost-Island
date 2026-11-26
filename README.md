# Journey Home

*Every journey leads somewhere. Yours leads home.*

Journey Home is a stylized third-person 3D adventure across a mysterious archipelago. Explore five distinct regions, solve environmental puzzles, recover ancient fragments, and restore the world.

## Play

The game is deployed on GitHub Pages. The current repository Pages URL is:

https://dwiptamoyforleo-lang.github.io/Journey-Home/

## Development

Requirements: Node.js 22 or later and npm.

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
npm run preview
```

Run the TypeScript check:

```bash
npm run lint
```

## Controls

- **WASD:** Move
- **Shift:** Sprint
- **Space:** Jump
- **E:** Interact

## Regions

1. The Forgotten Shore
2. Whispering Woods
3. The Sunken Kingdom
4. The Frozen Peaks
5. The Sky Temple

## GitHub Pages repository rename note

The Vite configuration uses `base: './'`, so no source asset paths need to change when the repository is renamed. If you rename this repository to `Journey-Home`, update the GitHub Pages URL above to:

`https://dwiptamoyforleo-lang.github.io/Journey-Home/`

Then check the repository's **Settings → Pages** configuration and allow the deployment workflow to publish the renamed repository. No Vite base-path change is required.
