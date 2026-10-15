# Number Hex

A little arithmetic. An endless hexagon canvas.

Number Hex is a browser-based tile-laying game. Choose the next digit, then place it in an empty hexagon sharing a side with the most recently played tile. The board expands in every direction with no fixed boundary.

## Rules

“Precedents” are the most recent tiles **in play order**. Other tiles touching the new tile do not enter the calculation.

| Mode | Rule | Example |
| --- | --- | --- |
| Sum of 2 | Last digit of the sum of the last two tiles | 8 + 7 = 15 → **5** |
| Sum of 3 | Last digit of the sum of the last three tiles | 9 + 8 + 7 = 24 → **4** |
| Multiply | Last digit of the product of the last two tiles | 7 × 8 = 56 → **6** |

The game provides two or three starting tiles. Use **Start a new path** to choose your own starting digits. Choose a digit with the tray or keyboard, then click an outlined hex. You cannot overlap a tile. If your path becomes surrounded, undo a move and choose a different direction. Zero is a valid digit, including repeating zeros in multiplication mode.

No timer, lives, fixed-size board, or locked modes. Progress and a personal best for each mode are saved in the current browser's local storage. If local storage is unavailable, the game still runs for the current visit.

## Play locally

No installation or build step is needed. Serve `dist/` with any static web server:

```sh
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080 in a modern browser. Serve the files over HTTP; JavaScript modules do not load reliably from `file://` URLs.

## Controls

- **0–9**: select digit
- **Click / tap an outlined hex**: place selected digit
- **Drag**: pan the board; **scroll** or **+/−**: zoom
- **Arrow keys**: pan; **C**: center on the latest tile
- **Z**: undo; **H**: reveal a hint
- **Tab**, then **Enter / Space**: place on a focused hex

## Development and tests

Vanilla JavaScript, CSS, and SVG. There are no runtime dependencies. Google Fonts are optional; local fallback fonts keep the game functional if they are unavailable. The sparse axial-coordinate board has no programmed size limit. Only visible background cells and tiles are drawn; the chronological path is retained for rules, undo, and saving. Available memory and browser storage are the practical limits.

With Node.js 20 or newer:

```sh
npm test
```

Tests cover all three rules, wraparound, zero, turns, illegal moves, save validation, coordinate conversion, and paths longer than 1,200 moves in every mode.

## Hosting

Host the contents of `dist/` on any static hosting service. A GitHub Actions workflow is included for GitHub Pages: choose **Settings → Pages → Source → GitHub Actions**, then run the **Deploy Number Hex** workflow. It tests the rules before deploying. The repository also includes configuration for its private ChatGPT Sites preview.

## License

MIT
