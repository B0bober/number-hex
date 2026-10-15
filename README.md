# Number Hex

**[Play Number Hex](https://b0bober.github.io/number-hex/)** · [Classic paths](https://b0bober.github.io/number-hex/classic.html)

Six tiles in your hand. Keep building larger triangles, one number at a time.

## Larger triangles: the corrected rule

A triangle has **four hexes along each side**. Its three corner numbers must be equal, and the two interior numbers on every side must add to that corner digit, keeping only the final digit.

- **1–4–7–1** is a valid side: 4 + 7 = 11 → 1.
- **5–1–4–5** is a valid side: 1 + 4 = 5.

The small groups of three touching hexes are not the triangles used by this version.

Outlines show the larger triangles being tracked. A triangle begins being tracked when its six side-interior positions are filled, a complete four-hex side exists, or all three corners exist. Every tracked triangle must have compatible corner numbers and side sums. The initial circle establishes two overlapping large triangles. The sidebar reports forming and completed triangles and shows the last completed side.

## Play a round

1. Choose your center digit (0–9). The generator chooses the most distinct digits possible among the alternating patterns that support continued play. Normally the seven board tiles contain three distinct digits; centers 0 and 5 allow two in these extensible patterns. Equally varied patterns and their orientation are chosen randomly. The default center is 3.
2. Choose the time and mistake limits. Defaults: **3 minutes** and **3 mistakes**; either limit can be changed or disabled.
3. You receive **six different random hand digits**. Later replacement draws may repeat a digit already in your hand. Select a tile and an outlined empty hex.
4. Extend two consecutive numbers along a straight line, or fill a missing position in a tracked side. A new tile must fit every side and matching-corner requirement it touches. Filling an interior gap uses the side equation; it does not sum a corner again as if it were another interior number.
5. Every successful placement scores **one hex** and deals **one replacement tile** into the same hand slot. Keep placing tiles one after another. The starting seven tiles do not score.
6. Wrong digits use a mistake and leave your board and hand unchanged. The round ends at a time or mistake limit, or when no legal space remains.

**Hints** show a legal move using your actual hand. **Swap hand** deals six new random tiles. Each costs **10 seconds** in timed rounds and has no time cost in untimed rounds. A hint that finds no move charges nothing.

The clock starts at **Deal & start** and keeps running in help, other tabs, and after refresh. Progress and best scores are stored locally, with separate bests for each combination of limits. Version 3 starts a new save slot because boards created under the previous small-triangle rules are incompatible. Classic saves remain independent.

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
| Triangle outlines | Show or hide the larger guides |

On phones, tap a hand tile and then an outlined hex.

## Classic paths

The original sequence game remains at `classic.html`, with independent saved progress. Its three modes add the last two numbers, add the last three numbers, or multiply the last two. Classic has undo, hints, and editable starting digits, without time or mistake limits.

## Run locally

No installation or build step is needed. Serve `dist/` with a static server:

```sh
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080. Use HTTP rather than opening the HTML as a local file, since the game uses JavaScript modules.

## Development and verification

Vanilla JavaScript, CSS, and SVG; no runtime dependencies. Optional Google Fonts have local fallbacks. The sparse axial-coordinate board has no programmed size limit. Browser memory, storage, and the arithmetic constraints are the practical limits.

With Node.js 20 or newer:

```sh
npm test
```

Regression tests include the two user-provided side examples; rejection of the conflicting circle from the original screenshot; equal corners on all three sides; interior-gap placement; repeated side extensions; 40 consecutive scored moves for every center with legal continuations; 150-move growth; saves, timer, hand and mistake behavior; and the original classic modes.

## Deploy

GitHub Pages uses the included workflow, testing and deploying `dist/` on pushes to `main` or manual runs. Pages is configured to use **GitHub Actions**. The same files can be hosted anywhere; `.openai/hosting.json` retains the private ChatGPT Sites preview.

## License

MIT
