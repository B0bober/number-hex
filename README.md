# Number Hex

**[Play Number Hex](https://b0bober.github.io/number-hex/)** · [Classic paths](https://b0bober.github.io/number-hex/classic.html)

Six tiles in your hand. A growing hex board. Make every triangle count.

## Circle challenge

1. Choose your center digit (0–9). Six random neighbors form a starting circle. All six triangles, including the closing triangle, are checked before the circle is dealt.
2. Choose a time and mistake limit. Defaults are **3 minutes** and **3 mistakes**. Both can be changed or disabled.
3. You get **six random hand tiles**. Select one, then an outlined empty hex that completes a triangle with two touching tiles.
4. Each triangle contains three mutually adjacent hexes. One digit must equal the **last digit of the sum of the other two**, regardless of play order. For example: 3 + 4 = 7; 8 + 7 = 15 → 5. Zero and repeated digits are allowed.
5. Every triangle completed by the placement must comply. A tile can be placed anywhere around the board, not only next to the last tile.
6. A successful placement adds **one point** and deals **one replacement tile** into the same hand slot. Your hand always has six tiles. The seven starting tiles do not score.
7. Wrong placements use a mistake without changing your hand or the board. The round ends when time runs out or the mistake limit is reached. If no further digit could fit anywhere, the round ends as a blocked board.

A **hint** shows a legal move using your actual hand. A **hand swap** deals six new random tiles. Each costs **10 seconds** in timed games; in untimed games they have no time cost. A hint that finds no move charges nothing. These let you continue after an unlucky draw.

The clock begins at **Deal & start**, keeps running in help and other tabs, and survives refresh using an absolute deadline. Progress and best scores are stored locally. Best scores are tracked separately for each combination of time and mistake limits. If storage is unavailable, the round still works in the current tab.

## Classic paths

The original sequence game remains available at `classic.html`, with its independent saved progress. Its three modes use the last two numbers added, the last three numbers added, or the last two numbers multiplied. Keep only the last digit, then place next to the latest tile. Classic has undo, hints, and editable starting digits, with no timer or mistakes.

## Controls

| Circle challenge | Action |
| --- | --- |
| 1–6 | Select a hand slot |
| Click / tap an outlined hex | Place the selected tile |
| Tab, then Enter / Space | Place on a focused hex |
| Drag / arrow keys | Pan |
| Scroll / + / − | Zoom |
| C | Center |
| H | Hint |
| R | Swap hand |

On phones, tap a hand tile and then an outlined hex.

## Run locally

No installation or build step is needed. Serve `dist/` with any static server:

```sh
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080 in a modern browser. Use HTTP rather than opening the HTML as a local file, since the game uses JavaScript modules.

## Development

Vanilla JavaScript, CSS, and SVG; no runtime dependencies. Optional Google Fonts have local fallbacks. The board stores sparse axial coordinates and draws only the visible background and tiles. There is no programmed board-size limit; browser memory and storage are the practical limits.

With Node.js 20 or newer:

```sh
npm test
```

Tests cover all centers and randomized starting rings, every completed triangle, hand replacement, scoring, mistake limits, real-time deadlines, save validation, hint and swap penalties, unlimited practice settings, unbounded coordinates, and the original classic modes.

## Deploy

GitHub Pages uses the included workflow. It tests the game and deploys `dist/` on pushes to `main` or when run manually. Pages is configured to use **GitHub Actions**. The same static source can be hosted anywhere; `.openai/hosting.json` maintains the existing private ChatGPT Sites preview.

## License

MIT
