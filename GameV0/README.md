# বাংলা বাবার দৌড় (Bangla Babar Dour)

A 2D endless runner game built with vanilla HTML5 Canvas.

The player chases a runner through a scrolling Bangladesh-themed backdrop while avoiding obstacles, using jump and double-jump mechanics.

## Features

- Endless runner gameplay with increasing speed
- Desktop controls (keyboard)
- Mobile controls (swipe up to jump, swipe up again for double jump)
- Landscape-first mobile experience (portrait orientation prompt)
- Custom sprites for both characters and jump state
- Custom obstacle sprites with tuned hitboxes
- Dynamic high score using `localStorage`
- Audio integration:
  - `gameplay.mp3` during gameplay
  - `jump.mp3` on jump
  - `obstacle_hit.mp3` on obstacle collision
  - `outro.mp3` on game over screen

## Project Structure

- `index.html` - Full game (HTML, CSS, JS in one file)
- `bg.png` - Background image
- `chaser1.png`, `chaser2.png` - Main character run sprites
- `chase1.png`, `chase2.png` - Chased character run sprites
- `jump.png` - Main character jump sprite
- `obstacle1.png`, `obstacle2.png`, `obstacle3.png` - Obstacle sprites
- `gameplay.mp3`, `jump.mp3`, `obstacle_hit.mp3`, `outro.mp3` - Audio assets

## Controls

### Desktop

- `Space` / `Arrow Up`: Jump
- Hold jump key for longer jump
- Press jump again in air for double jump

### Mobile

- Swipe up: Jump
- Swipe up again in air: Double jump
- Best played in landscape mode

## Run Locally

Because this is a static game, you can run it with any local server.

### Option 1: Python

```bash
cd /Users/sifatislam/Downloads/Endless_runner
python3 -m http.server 8080
```

Then open: `http://localhost:8080`

### Option 2: VS Code Live Server

Open `index.html` with a live server extension.

## Notes

- Best experience is in a modern browser (Chrome, Edge, Safari, Firefox).
- Audio playback may require a user gesture on some browsers.
- High score persists in browser storage.
