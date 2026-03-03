# Pet Cursor (VS Code Extension)

This extension overlays a pet GIF at your typing cursor position.
VS Code does not expose an API to fully replace the native caret, so this extension renders the pet as an overlay and can minimize/hide the native caret.

## Features

- Cursor overlay with animated pet states
- Multiple pets from vscode-pets media packs
- Command Palette actions:
- `Pet Cursor: Toggle`
- `Pet Cursor: Reload Assets`
- `Pet Cursor: Select Pet`
- Status bar pet icon/button appears after install; click it to open pet selection
- Motion flow:
  `sit -> wakeup -> walk -> run -> stand wait -> patrol -> sit`
- Long backspace hold escalates from walk to run
- Arrow-key cursor moves turn/walk pet left or right
- Line changes:
  - Birds (`cockatiel`, `chicken`) use fly-up/fly-down
  - Other pets use jump-up/jump-down
- Optional blinking caret marker at exact cursor position

## Run locally

1. Install dependencies:
   ```powershell
   npm install
   ```
2. Generate all pet GIF packs from installed `vscode-pets` extension:
   ```powershell
   npm run generate:gifs
   ```
3. Compile:
   ```powershell
   npm run compile
   ```
4. Press `F5` in VS Code to launch Extension Development Host.

## Settings

- `catCursor.petType` (`string`, default `cat`) selects active pet
- `catCursor.enabled` (`boolean`, default `true`)
- `catCursor.leftOffset` (`string`, default `0.01ch`)
- `catCursor.verticalOffset` (`string`, default `-0.26em`)
- `catCursor.minimizeNativeCursor` (`boolean`, default `true`)
- `catCursor.disableNativeBlinking` (`boolean`, default `true`)
- `catCursor.hideNativeCursorColor` (`boolean`, default `true`)
- `catCursor.sitGifPath` (`string`, default `"media/pet-cat-sit.gif"`)
- `catCursor.wakeUpGifPath` (`string`, default `"media/pet-cat-wakeup.gif"`)
- `catCursor.standRightGifPath` (`string`, default `"media/pet-cat-stand-right.gif"`)
- `catCursor.standLeftGifPath` (`string`, default `"media/pet-cat-stand-left.gif"`)
- `catCursor.jumpUpGifPath` (`string`, default `"media/pet-cat-jump-up.gif"`)
- `catCursor.jumpDownGifPath` (`string`, default `"media/pet-cat-jump-down.gif"`)
- `catCursor.flyUpGifPath` (`string`, default `"media/pet-cat-fly-up.gif"`)
- `catCursor.flyDownGifPath` (`string`, default `"media/pet-cat-fly-down.gif"`)
- `catCursor.walkRightGifPath` (`string`, default `"media/pet-cat-walk-right.gif"`)
- `catCursor.walkLookBackGifPath` (`string`, default `"media/pet-cat-walk-right-lookback.gif"`)
- `catCursor.walkLeftGifPath` (`string`, default `"media/pet-cat-walk-left.gif"`)
- `catCursor.runRightGifPath` (`string`, default `"media/pet-cat-run-right.gif"`)
- `catCursor.runLookBackGifPath` (`string`, default `"media/pet-cat-run-right-lookback.gif"`)
- `catCursor.runLeftGifPath` (`string`, default `"media/pet-cat-run-left.gif"`)
- `catCursor.backspaceLeftGifPath` (`string`, default `"media/pet-cat-backspace-left.gif"`)
- `catCursor.spriteWidthEm` (`number`, default `0.34`)
- `catCursor.spriteHeightEm` (`number`, default `0.24`)
- `catCursor.fitToLineHeight` (`boolean`, default `true`)
- `catCursor.lineHeightScale` (`number`, default `0.28`)
- `catCursor.spriteAspectRatio` (`number`, default `1.1`)
- `catCursor.symbol` (`string`, default `cat`) fallback text if GIF load fails
- `catCursor.idleDelayMs` (`number`, default `350`)
- `catCursor.runThresholdCps` (`number`, default `4.5`)
- `catCursor.runWordThreshold` (`number`, default `4`)
- `catCursor.activeTypingWindowMs` (`number`, default `220`)
- `catCursor.wakeUpDurationMs` (`number`, default `260`)
- `catCursor.idleStandMs` (`number`, default `2600`)
- `catCursor.idlePatrolMs` (`number`, default `5200`)
- `catCursor.patrolFlipMs` (`number`, default `700`)
- `catCursor.patrolStepsPerSide` (`number`, default `3`)
- `catCursor.idleWanderCh` (`number`, default `1.2`)
- `catCursor.standLookFlipMs` (`number`, default `1300`)
- `catCursor.stateRefreshIntervalMs` (`number`, default `120`)
- `catCursor.deleteTurnMs` (`number`, default `280`)
- `catCursor.backspaceRunHoldMs` (`number`, default `380`)
- `catCursor.backspaceRunThresholdCps` (`number`, default `9`)
- `catCursor.navigationMoveMs` (`number`, default `220`)
- `catCursor.navigationFaceMs` (`number`, default `420`)
- `catCursor.jumpBaseMs` (`number`, default `240`)
- `catCursor.jumpPerLineMs` (`number`, default `0`)
- `catCursor.jumpMaxMs` (`number`, default `240`)
- `catCursor.showBlinkCaret` (`boolean`, default `true`)
- `catCursor.blinkCaretIntervalMs` (`number`, default `520`)
- `catCursor.blinkCaretSymbol` (`string`, default `"|"`)
- `catCursor.blinkCaretVerticalOffset` (`string`, default `"0em"`)

## Example settings

```json
{
  "catCursor.petType": "cockatiel",
  "catCursor.leftOffset": "0.01ch",
  "catCursor.verticalOffset": "-0.26em",
  "catCursor.fitToLineHeight": true,
  "catCursor.lineHeightScale": 0.28,
  "catCursor.spriteAspectRatio": 1.1,
  "catCursor.showBlinkCaret": true,
  "catCursor.blinkCaretSymbol": "|"
}
```

## Publish to VS Code Marketplace

1. Create a publisher at `https://marketplace.visualstudio.com/manage/publishers/`.
2. Create an Azure DevOps Personal Access Token with Marketplace publish/manage scope.
3. Set your publisher id in `package.json` (`publisher` field).
4. Repository/homepage/bugs in `package.json` now point to `https://github.com/suhail-sid/Extension`.
5. Package:
   ```powershell
   npm run package:vsix
   ```
6. Publish:
   ```powershell
   npx @vscode/vsce login <your-publisher-id>
   npm run publish:patch
   ```

