import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

type MotionState =
  | "sit"
  | "wakeUp"
  | "standRight"
  | "standLeft"
  | "jumpUp"
  | "jumpDown"
  | "flyUp"
  | "flyDown"
  | "walkRight"
  | "walkLookBack"
  | "walkLeft"
  | "runRight"
  | "runLookBack"
  | "runLeft"
  | "backspaceLeft"
  | "backspaceRunLeft";
type LineChangeMotion = "jump" | "fly";
const PET_TYPES = [
  "cat",
  "dog",
  "fox",
  "bunny",
  "chicken",
  "cockatiel",
  "crab",
  "frog",
  "horse",
  "mod",
  "morph",
  "panda",
  "rat",
  "rocky",
  "rubber-duck",
  "skeleton",
  "snail",
  "snake",
  "squirrel",
  "totoro",
  "turtle",
  "zappy",
  "clippy",
  "deno"
] as const;
type PetType = (typeof PET_TYPES)[number];
interface PetProfile {
  petType: PetType;
  label: string;
  lineChangeMotion: LineChangeMotion;
  defaultSymbol: string;
}
type CursorBlinkingStyle =
  | "blink"
  | "smooth"
  | "phase"
  | "expand"
  | "solid"
  | "inherit";
type CursorStyleSetting =
  | "line"
  | "block"
  | "underline"
  | "line-thin"
  | "block-outline"
  | "underline-thin";

interface TypingState {
  lastTypeAt: number;
  smoothedCps: number;
  lastDeleteAt: number;
  lastDeleteBurstStartAt: number;
  deleteBurstChars: number;
  deleteSmoothedCps: number;
  completedWordsSincePause: number;
  lastWakeAt: number;
  lastNavAt: number;
  lastNavDirection: "left" | "right" | "none";
  lastJumpAt: number;
  lastJumpDirection: "up" | "down" | "none";
  lastJumpDistance: number;
  lastJumpColumnDelta: number;
  lastJumpDurationMs: number;
}

let extensionPath = "";
let catDecoration: vscode.TextEditorDecorationType | undefined;
let blinkCaretDecoration: vscode.TextEditorDecorationType | undefined;
let petStatusBarItem: vscode.StatusBarItem | undefined;
let enabled = true;
let minimizeNativeCursor = true;
let activePetType: PetType = "cat";
let activePetProfile: PetProfile = {
  petType: "cat",
  label: "Cat",
  lineChangeMotion: "jump",
  defaultSymbol: "cat"
};
let leftOffset = "0.01ch";
let verticalOffset = "-0.26em";
let fallbackSymbol = "cat";

let sitGifPath = "media/pet-cat-sit.gif";
let wakeUpGifPath = "media/pet-cat-wakeup.gif";
let standRightGifPath = "media/pet-cat-stand-right.gif";
let standLeftGifPath = "media/pet-cat-stand-left.gif";
let jumpUpGifPath = "media/pet-cat-jump-up.gif";
let jumpDownGifPath = "media/pet-cat-jump-down.gif";
let flyUpGifPath = "media/pet-cat-fly-up.gif";
let flyDownGifPath = "media/pet-cat-fly-down.gif";
let walkRightGifPath = "media/pet-cat-walk-right.gif";
let walkLookBackGifPath = "media/pet-cat-walk-right-lookback.gif";
let walkLeftGifPath = "media/pet-cat-walk-left.gif";
let runRightGifPath = "media/pet-cat-run-right.gif";
let runLookBackGifPath = "media/pet-cat-run-right-lookback.gif";
let runLeftGifPath = "media/pet-cat-run-left.gif";
let backspaceLeftGifPath = "media/pet-cat-backspace-left.gif";
let spriteWidthEm = 0.34;
let spriteHeightEm = 0.24;
let fitToLineHeight = true;
let lineHeightScale = 0.28;
let spriteAspectRatio = 1.1;

let idleDelayMs = 350;
let runThresholdCps = 4.5;
let runWordThreshold = 4;
let activeTypingWindowMs = 220;
let wakeUpDurationMs = 260;
let idleStandMs = 2600;
let idlePatrolMs = 5200;
let patrolFlipMs = 700;
let patrolStepsPerSide = 3;
let idleWanderCh = 1.2;
let standLookFlipMs = 1300;
let stateRefreshIntervalMs = 120;
let deleteTurnMs = 280;
let backspaceRunHoldMs = 380;
let backspaceRunThresholdCps = 9;
let navigationMoveMs = 220;
let navigationFaceMs = 420;
let jumpBaseMs = 240;
let jumpPerLineMs = 0;
let jumpMaxMs = 240;
let showBlinkCaret = true;
let blinkCaretIntervalMs = 520;
let blinkCaretSymbol = "|";
let blinkCaretVerticalOffset = "0em";
let disableNativeBlinking = true;
let hideNativeCursorColor = true;

let sitGifUri: vscode.Uri | undefined;
let wakeUpGifUri: vscode.Uri | undefined;
let standRightGifUri: vscode.Uri | undefined;
let standLeftGifUri: vscode.Uri | undefined;
let jumpUpGifUri: vscode.Uri | undefined;
let jumpDownGifUri: vscode.Uri | undefined;
let flyUpGifUri: vscode.Uri | undefined;
let flyDownGifUri: vscode.Uri | undefined;
let walkRightGifUri: vscode.Uri | undefined;
let walkLookBackGifUri: vscode.Uri | undefined;
let walkLeftGifUri: vscode.Uri | undefined;
let runRightGifUri: vscode.Uri | undefined;
let runLookBackGifUri: vscode.Uri | undefined;
let runLeftGifUri: vscode.Uri | undefined;
let backspaceLeftGifUri: vscode.Uri | undefined;

let stateRefreshTimer: ReturnType<typeof setInterval> | undefined;
let stateTick = 0;
const typingStates = new Map<string, TypingState>();
let nativeTweaksApplied = false;
let nativeTweaksTarget: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace;
let previousCursorBlinking: CursorBlinkingStyle | undefined;
let previousCursorStyle: CursorStyleSetting | undefined;
let previousColorCustomizations: Record<string, unknown> | undefined;

const originalCursorOptions = new WeakMap<
  vscode.TextEditor,
  { cursorStyle: vscode.TextEditorCursorStyle | undefined }
>();
const lastCursorSnapshots = new WeakMap<
  vscode.TextEditor,
  { offset: number; line: number; character: number }
>();

const legacyGifPathMap: Record<string, string> = {
  "media/cat-sit.gif": "media/cat-vspets-sit.gif",
  "media/cat-wakeup.gif": "media/cat-vspets-wakeup.gif",
  "media/cat-stand-right.gif": "media/cat-vspets-stand-right.gif",
  "media/cat-stand-left.gif": "media/cat-vspets-stand-left.gif",
  "media/cat-walk.gif": "media/cat-vspets-walk-right.gif",
  "media/cat-walk-right.gif": "media/cat-vspets-walk-right.gif",
  "media/cat-walk-right-lookback.gif": "media/cat-vspets-walk-right-lookback.gif",
  "media/cat-walk-left.gif": "media/cat-vspets-walk-left.gif",
  "media/cat-run.gif": "media/cat-vspets-run-right.gif",
  "media/cat-run-right.gif": "media/cat-vspets-run-right.gif",
  "media/cat-run-right-lookback.gif": "media/cat-vspets-run-right-lookback.gif",
  "media/cat-run-left.gif": "media/cat-vspets-run-left.gif",
  "media/cat-push-left.gif": "media/cat-vspets-backspace-left.gif",
  "media/cat-backspace-left.gif": "media/cat-vspets-backspace-left.gif",
  "media/cat-pets-sit.gif": "media/cat-vspets-sit.gif",
  "media/cat-pets-wakeup.gif": "media/cat-vspets-wakeup.gif",
  "media/cat-pets-stand-right.gif": "media/cat-vspets-stand-right.gif",
  "media/cat-pets-stand-left.gif": "media/cat-vspets-stand-left.gif",
  "media/cat-pets-walk-right.gif": "media/cat-vspets-walk-right.gif",
  "media/cat-pets-walk-right-lookback.gif": "media/cat-vspets-walk-right-lookback.gif",
  "media/cat-pets-walk-left.gif": "media/cat-vspets-walk-left.gif",
  "media/cat-pets-run-right.gif": "media/cat-vspets-run-right.gif",
  "media/cat-pets-run-right-lookback.gif": "media/cat-vspets-run-right-lookback.gif",
  "media/cat-pets-run-left.gif": "media/cat-vspets-run-left.gif",
  "media/cat-pets-backspace-left.gif": "media/cat-vspets-backspace-left.gif",
  "media/cat-pets-jump-up.gif": "media/cat-vspets-jump-up.gif",
  "media/cat-pets-jump-down.gif": "media/cat-vspets-jump-down.gif",
  "media/cat-pro-sit.gif": "media/cat-vspets-sit.gif",
  "media/cat-pro-wakeup.gif": "media/cat-vspets-wakeup.gif",
  "media/cat-pro-stand-right.gif": "media/cat-vspets-stand-right.gif",
  "media/cat-pro-stand-left.gif": "media/cat-vspets-stand-left.gif",
  "media/cat-pro-walk-right.gif": "media/cat-vspets-walk-right.gif",
  "media/cat-pro-walk-right-lookback.gif": "media/cat-vspets-walk-right-lookback.gif",
  "media/cat-pro-walk-left.gif": "media/cat-vspets-walk-left.gif",
  "media/cat-pro-run-right.gif": "media/cat-vspets-run-right.gif",
  "media/cat-pro-run-right-lookback.gif": "media/cat-vspets-run-right-lookback.gif",
  "media/cat-pro-run-left.gif": "media/cat-vspets-run-left.gif",
  "media/cat-pro-backspace-left.gif": "media/cat-vspets-backspace-left.gif",
  "media/cat-pro-jump-up.gif": "media/cat-vspets-jump-up.gif",
  "media/cat-pro-jump-down.gif": "media/cat-vspets-jump-down.gif"
};

const PET_LABELS: Record<PetType, string> = {
  cat: "Cat",
  dog: "Dog",
  fox: "Fox",
  bunny: "Bunny",
  chicken: "Chicken",
  cockatiel: "Cockatiel",
  crab: "Crab",
  frog: "Frog",
  horse: "Horse",
  mod: "Mod",
  morph: "Morph",
  panda: "Panda",
  rat: "Rat",
  rocky: "Rocky",
  "rubber-duck": "Rubber Duck",
  skeleton: "Skeleton",
  snail: "Snail",
  snake: "Snake",
  squirrel: "Squirrel",
  totoro: "Totoro",
  turtle: "Turtle",
  zappy: "Zappy",
  clippy: "Clippy",
  deno: "Deno"
};
const PET_EMOJIS: Record<PetType, string> = {
  cat: "🐱",
  dog: "🐶",
  fox: "🦊",
  bunny: "🐰",
  chicken: "🐔",
  cockatiel: "🐦",
  crab: "🦀",
  frog: "🐸",
  horse: "🐴",
  mod: "🤖",
  morph: "🧿",
  panda: "🐼",
  rat: "🐀",
  rocky: "🪨",
  "rubber-duck": "🦆",
  skeleton: "💀",
  snail: "🐌",
  snake: "🐍",
  squirrel: "🐿️",
  totoro: "👾",
  turtle: "🐢",
  zappy: "⚡",
  clippy: "📎",
  deno: "🦕"
};
const FLYING_PETS = new Set<PetType>(["cockatiel", "chicken"]);

function isPetType(value: string): value is PetType {
  return (PET_TYPES as readonly string[]).includes(value);
}

function getPetProfile(petType: PetType): PetProfile {
  return {
    petType,
    label: PET_LABELS[petType] ?? petType,
    lineChangeMotion: FLYING_PETS.has(petType) ? "fly" : "jump",
    defaultSymbol: petType
  };
}

function getPetPackPath(petType: PetType, motion: string): string {
  return `media/pet-${petType}-${motion}.gif`;
}

function getPetPackDefaults(petType: PetType): {
  sit: string;
  wakeup: string;
  standRight: string;
  standLeft: string;
  jumpUp: string;
  jumpDown: string;
  flyUp: string;
  flyDown: string;
  walkRight: string;
  walkLookBack: string;
  walkLeft: string;
  runRight: string;
  runLookBack: string;
  runLeft: string;
  backspaceLeft: string;
} {
  return {
    sit: getPetPackPath(petType, "sit"),
    wakeup: getPetPackPath(petType, "wakeup"),
    standRight: getPetPackPath(petType, "stand-right"),
    standLeft: getPetPackPath(petType, "stand-left"),
    jumpUp: getPetPackPath(petType, "jump-up"),
    jumpDown: getPetPackPath(petType, "jump-down"),
    flyUp: getPetPackPath(petType, "fly-up"),
    flyDown: getPetPackPath(petType, "fly-down"),
    walkRight: getPetPackPath(petType, "walk-right"),
    walkLookBack: getPetPackPath(petType, "walk-right-lookback"),
    walkLeft: getPetPackPath(petType, "walk-left"),
    runRight: getPetPackPath(petType, "run-right"),
    runLookBack: getPetPackPath(petType, "run-right-lookback"),
    runLeft: getPetPackPath(petType, "run-left"),
    backspaceLeft: getPetPackPath(petType, "backspace-left")
  };
}

function getConfiguredString(config: vscode.WorkspaceConfiguration, key: string): string | undefined {
  const inspected = config.inspect<string>(key);
  const value = inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getConfiguredPetType(config: vscode.WorkspaceConfiguration): PetType {
  const raw = getConfiguredString(config, "petType");
  if (raw && isPetType(raw)) {
    return raw;
  }
  return "cat";
}

function getConfiguredPath(
  config: vscode.WorkspaceConfiguration,
  key: string,
  petDefault: string,
  legacyKey?: string
): string {
  const explicit = getConfiguredString(config, key);
  if (explicit) {
    return normalizeLegacyGifPath(explicit, petDefault);
  }
  if (legacyKey) {
    const legacy = getConfiguredString(config, legacyKey);
    if (legacy) {
      return normalizeLegacyGifPath(legacy, petDefault);
    }
  }
  return normalizeLegacyGifPath(petDefault, petDefault);
}

async function promptAndSelectPet(): Promise<void> {
  const picks = PET_TYPES.map((pet) => ({
    label: `${PET_EMOJIS[pet]} ${pet}`,
    description: PET_LABELS[pet],
    petType: pet
  }));
  const choice = await vscode.window.showQuickPick(picks, {
    title: "Select a pet",
    placeHolder: `Current: ${PET_EMOJIS[activePetType]} ${activePetType}`
  });
  if (!choice) {
    return;
  }
  const configTarget = getConfigTarget();
  await vscode.workspace.getConfiguration("catCursor").update("petType", choice.petType, configTarget);
  loadConfig();
  rebuildDecoration();
  updatePetStatusBarItem();
  refreshAllVisibleEditors();
  vscode.window.showInformationMessage(`Pet Cursor pet changed to ${choice.description}.`);
}

function updatePetStatusBarItem(): void {
  if (!petStatusBarItem) {
    return;
  }
  const icon = PET_EMOJIS[activePetType] ?? "🐾";
  const stateTag = enabled ? "" : " (off)";
  petStatusBarItem.text = `${icon} Pet${stateTag}`;
  petStatusBarItem.tooltip = `Pet Cursor\nCurrent pet: ${PET_LABELS[activePetType]}\nClick to select pet`;
}

export function activate(context: vscode.ExtensionContext): void {
  extensionPath = context.extensionPath;
  loadConfig();
  syncNativeCursorTweaks();

  catDecoration = createDecoration();
  blinkCaretDecoration = createDecoration();
  petStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 95);
  petStatusBarItem.name = "Pet Cursor Pet Selector";
  petStatusBarItem.command = "catCursor.selectPet";
  updatePetStatusBarItem();
  petStatusBarItem.show();
  const toggleCommand = vscode.commands.registerCommand("catCursor.toggle", () => {
    enabled = !enabled;
    syncNativeCursorTweaks();
    updatePetStatusBarItem();
    refreshAllVisibleEditors();
    vscode.window.showInformationMessage(
      enabled ? "Pet Cursor enabled." : "Pet Cursor disabled."
    );
  });
  const reloadAssetsCommand = vscode.commands.registerCommand("catCursor.reloadAssets", () => {
    loadConfig();
    rebuildDecoration();
    refreshAllVisibleEditors();
    vscode.window.showInformationMessage("Pet Cursor assets reloaded.");
  });
  const selectPetCommand = vscode.commands.registerCommand("catCursor.selectPet", async () => {
    await promptAndSelectPet();
  });

  const onSelectionChange = vscode.window.onDidChangeTextEditorSelection((event) => {
    if (!enabled) {
      clearDecoration(event.textEditor);
      return;
    }
    updateNavigationState(event);
    applyDecoration(event.textEditor);
  });

  const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor) {
      return;
    }
    if (!enabled) {
      clearDecoration(editor);
      return;
    }
    applyDecoration(editor);
  });

  const onVisibleEditorsChange = vscode.window.onDidChangeVisibleTextEditors(() => {
    refreshAllVisibleEditors();
  });

  const onTextChanged = vscode.workspace.onDidChangeTextDocument((event) => {
    if (!enabled) {
      return;
    }
    const stats = getChangeStats(event);
    if (stats.insertedChars === 0 && stats.deletedChars === 0) {
      return;
    }
    updateTypingState(event, stats);
    refreshVisibleEditorsForDocument(event.document);
  });

  const onConfigChange = vscode.workspace.onDidChangeConfiguration((event) => {
    if (!event.affectsConfiguration("catCursor")) {
      return;
    }
    loadConfig();
    rebuildDecoration();
    syncNativeCursorTweaks();
    restartStateLoop();
    updatePetStatusBarItem();
    refreshAllVisibleEditors();
  });

  context.subscriptions.push(
    toggleCommand,
    reloadAssetsCommand,
    selectPetCommand,
    onSelectionChange,
    onActiveEditorChange,
    onVisibleEditorsChange,
    onTextChanged,
    onConfigChange
  );
  context.subscriptions.push({
    dispose: () => stopStateLoop()
  });

  restartStateLoop();
  refreshAllVisibleEditors();
}

export function deactivate(): void {
  stopStateLoop();
  void restoreNativeCursorTweaks();
  for (const editor of vscode.window.visibleTextEditors) {
    restoreNativeCursor(editor);
  }
  if (catDecoration) {
    catDecoration.dispose();
    catDecoration = undefined;
  }
  if (blinkCaretDecoration) {
    blinkCaretDecoration.dispose();
    blinkCaretDecoration = undefined;
  }
  if (petStatusBarItem) {
    petStatusBarItem.dispose();
    petStatusBarItem = undefined;
  }
}

function refreshAllVisibleEditors(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    if (!enabled) {
      clearDecoration(editor);
      continue;
    }
    applyDecoration(editor);
  }
}

function rebuildDecoration(): void {
  if (catDecoration) {
    catDecoration.dispose();
  }
  if (blinkCaretDecoration) {
    blinkCaretDecoration.dispose();
  }
  catDecoration = createDecoration();
  blinkCaretDecoration = createDecoration();
}

function createDecoration(): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
  });
}

function applyDecoration(editor: vscode.TextEditor): void {
  if (!catDecoration) {
    return;
  }
  applyNativeCursorMode(editor);

  const motion = getMotionState(editor.document);
  const after = createAttachmentForMotion(motion, editor);
  const decorations: vscode.DecorationOptions[] = editor.selections.map((selection) => {
    const active = selection.active;
    return {
      range: new vscode.Range(active, active),
      renderOptions: { after }
    };
  });
  editor.setDecorations(catDecoration, decorations);
  applyBlinkCaret(editor);
  rememberCursorOffset(editor);
}

function applyBlinkCaret(editor: vscode.TextEditor): void {
  if (!blinkCaretDecoration || !showBlinkCaret || blinkCaretIntervalMs <= 0) {
    if (blinkCaretDecoration) {
      editor.setDecorations(blinkCaretDecoration, []);
    }
    return;
  }

  const visible = Math.floor(Date.now() / blinkCaretIntervalMs) % 2 === 0;
  if (!visible) {
    editor.setDecorations(blinkCaretDecoration, []);
    return;
  }

  const after: vscode.ThemableDecorationAttachmentRenderOptions = {
    contentText: blinkCaretSymbol,
    margin: `${blinkCaretVerticalOffset} -1ch 0 0`,
    color: new vscode.ThemeColor("editorCursor.foreground")
  };
  const decorations: vscode.DecorationOptions[] = editor.selections.map((selection) => {
    const active = selection.active;
    return {
      range: new vscode.Range(active, active),
      renderOptions: { after }
    };
  });
  editor.setDecorations(blinkCaretDecoration, decorations);
}

function clearDecoration(editor: vscode.TextEditor): void {
  restoreNativeCursor(editor);
  lastCursorSnapshots.delete(editor);
  if (!catDecoration) {
    return;
  }
  editor.setDecorations(catDecoration, []);
  if (blinkCaretDecoration) {
    editor.setDecorations(blinkCaretDecoration, []);
  }
}

function rememberCursorOffset(editor: vscode.TextEditor): void {
  if (editor.selections.length === 0) {
    return;
  }
  const active = editor.selections[0].active;
  lastCursorSnapshots.set(editor, {
    offset: editor.document.offsetAt(active),
    line: active.line,
    character: active.character
  });
}

function createAttachmentForMotion(
  motion: MotionState,
  editor: vscode.TextEditor
): vscode.ThemableDecorationAttachmentRenderOptions {
  const size = getSpriteSize(editor);
  const gifUri = getGifUriByMotion(motion);
  const horizontalOffset = getHorizontalOffset(editor.document);
  if (gifUri) {
    return {
      contentIconPath: gifUri,
      width: size.width,
      height: size.height,
      margin: `${verticalOffset} calc(-1 * ${size.width}) 0 ${horizontalOffset}`,
      textDecoration: "none; vertical-align:text-bottom;"
    };
  }

  return {
    contentText: fallbackSymbol,
    margin: `${verticalOffset} -${Math.max(1, Math.min(6, fallbackSymbol.length || 1))}ch 0 ${horizontalOffset}`
  };
}

function getHorizontalOffset(document: vscode.TextDocument): string {
  const extraCh = getIdleWanderOffsetCh(document) + getJumpApproachOffsetCh(document);
  if (Math.abs(extraCh) < 0.01) {
    return leftOffset;
  }
  const sign = extraCh >= 0 ? "+" : "-";
  const magnitude = Math.abs(extraCh).toFixed(2);
  return `calc(${leftOffset} ${sign} ${magnitude}ch)`;
}

function getIdleWanderOffsetCh(document: vscode.TextDocument): number {
  const state = typingStates.get(document.uri.toString());
  if (!state) {
    return 0;
  }

  const now = Date.now();
  const idleTime = now - state.lastTypeAt;
  if (idleTime <= idleStandMs || idleTime > idleStandMs + idlePatrolMs) {
    return 0;
  }

  // Let navigation and jump visuals stay precise at the cursor.
  const jumpDuration =
    state.lastJumpDurationMs > 0 ? state.lastJumpDurationMs : getJumpDurationMs(state.lastJumpDistance);
  if (state.lastJumpDirection !== "none" && now - state.lastJumpAt <= jumpDuration) {
    return 0;
  }
  if (state.lastNavDirection !== "none" && now - state.lastNavAt <= navigationFaceMs) {
    return 0;
  }

  const perStepMs = Math.max(120, patrolFlipMs);
  const patrolTime = idleTime - idleStandMs;
  const steps = Math.floor(patrolTime / perStepMs);
  const withinStep = (patrolTime % perStepMs) / perStepMs;
  const stepsPerSide = Math.max(1, patrolStepsPerSide);
  const sideSegment = Math.floor(steps / stepsPerSide);
  const direction = sideSegment % 2 === 0 ? 1 : -1;
  const stepOnSide = steps % stepsPerSide;
  const progressOnSide = (stepOnSide + withinStep) / stepsPerSide;
  return direction * idleWanderCh * progressOnSide;
}

function getJumpApproachOffsetCh(document: vscode.TextDocument): number {
  const state = typingStates.get(document.uri.toString());
  if (!state || state.lastJumpDirection === "none") {
    return 0;
  }
  const now = Date.now();
  const jumpDuration = state.lastJumpDurationMs > 0 ? state.lastJumpDurationMs : getJumpDurationMs(state.lastJumpDistance);
  const jumpAge = now - state.lastJumpAt;
  if (jumpAge < 0 || jumpAge > jumpDuration) {
    return 0;
  }

  // Start from old horizontal position and land at cursor's target word position.
  const progress = Math.max(0, Math.min(1, jumpAge / Math.max(1, jumpDuration)));
  const columnDelta = state.lastJumpColumnDelta;
  const deltaCh = Math.max(-4, Math.min(4, columnDelta * 0.35));
  return -deltaCh * (1 - progress);
}

function getGifUriByMotion(motion: MotionState): vscode.Uri | undefined {
  if (motion === "wakeUp") {
    return wakeUpGifUri ?? standRightGifUri ?? sitGifUri;
  }
  if (motion === "standRight") {
    return standRightGifUri ?? sitGifUri;
  }
  if (motion === "standLeft") {
    return standLeftGifUri ?? standRightGifUri ?? sitGifUri;
  }
  if (motion === "jumpUp") {
    return jumpUpGifUri ?? runRightGifUri ?? walkRightGifUri ?? standRightGifUri ?? sitGifUri;
  }
  if (motion === "jumpDown") {
    return jumpDownGifUri ?? runRightGifUri ?? walkRightGifUri ?? standRightGifUri ?? sitGifUri;
  }
  if (motion === "flyUp") {
    return flyUpGifUri ?? jumpUpGifUri ?? runRightGifUri ?? walkRightGifUri ?? standRightGifUri ?? sitGifUri;
  }
  if (motion === "flyDown") {
    return flyDownGifUri ?? jumpDownGifUri ?? runRightGifUri ?? walkRightGifUri ?? standRightGifUri ?? sitGifUri;
  }
  if (motion === "walkRight") {
    return walkRightGifUri ?? standRightGifUri ?? sitGifUri;
  }
  if (motion === "walkLookBack") {
    return walkLookBackGifUri ?? walkRightGifUri ?? standRightGifUri ?? sitGifUri;
  }
  if (motion === "walkLeft") {
    return walkLeftGifUri ?? walkRightGifUri ?? standLeftGifUri ?? sitGifUri;
  }
  if (motion === "runRight") {
    return runRightGifUri ?? walkRightGifUri ?? sitGifUri;
  }
  if (motion === "runLookBack") {
    return runLookBackGifUri ?? runRightGifUri ?? walkRightGifUri ?? sitGifUri;
  }
  if (motion === "runLeft") {
    return runLeftGifUri ?? runRightGifUri ?? walkLeftGifUri ?? sitGifUri;
  }
  if (motion === "backspaceLeft") {
    return backspaceLeftGifUri ?? walkLeftGifUri ?? sitGifUri;
  }
  if (motion === "backspaceRunLeft") {
    return runLeftGifUri ?? backspaceLeftGifUri ?? walkLeftGifUri ?? sitGifUri;
  }
  return sitGifUri;
}

function applyNativeCursorMode(editor: vscode.TextEditor): void {
  if (!minimizeNativeCursor) {
    restoreNativeCursor(editor);
    return;
  }
  if (!originalCursorOptions.has(editor)) {
    originalCursorOptions.set(editor, {
      cursorStyle: editor.options.cursorStyle
    });
  }
  editor.options = {
    ...editor.options,
    cursorStyle: vscode.TextEditorCursorStyle.LineThin
  };
}

function restoreNativeCursor(editor: vscode.TextEditor): void {
  const original = originalCursorOptions.get(editor);
  if (!original) {
    return;
  }
  editor.options = {
    ...editor.options,
    cursorStyle: original.cursorStyle
  };
  originalCursorOptions.delete(editor);
}

function loadConfig(): void {
  const config = vscode.workspace.getConfiguration("catCursor");

  enabled = config.get<boolean>("enabled", true);
  minimizeNativeCursor = config.get<boolean>("minimizeNativeCursor", true);
  activePetType = getConfiguredPetType(config);
  activePetProfile = getPetProfile(activePetType);
  const petDefaults = getPetPackDefaults(activePetType);
  leftOffset = config.get<string>("leftOffset", "0.01ch");
  verticalOffset = config.get<string>("verticalOffset", "-0.26em");
  fallbackSymbol = getConfiguredString(config, "symbol") ?? activePetProfile.defaultSymbol;

  sitGifPath = getConfiguredPath(config, "sitGifPath", petDefaults.sit);
  wakeUpGifPath = getConfiguredPath(config, "wakeUpGifPath", petDefaults.wakeup);
  standRightGifPath = getConfiguredPath(config, "standRightGifPath", petDefaults.standRight);
  standLeftGifPath = getConfiguredPath(config, "standLeftGifPath", petDefaults.standLeft);
  jumpUpGifPath = getConfiguredPath(config, "jumpUpGifPath", petDefaults.jumpUp);
  jumpDownGifPath = getConfiguredPath(config, "jumpDownGifPath", petDefaults.jumpDown);
  flyUpGifPath = getConfiguredPath(config, "flyUpGifPath", petDefaults.flyUp);
  flyDownGifPath = getConfiguredPath(config, "flyDownGifPath", petDefaults.flyDown);
  walkRightGifPath = getConfiguredPath(config, "walkRightGifPath", petDefaults.walkRight, "walkGifPath");
  walkLookBackGifPath = getConfiguredPath(config, "walkLookBackGifPath", petDefaults.walkLookBack);
  walkLeftGifPath = getConfiguredPath(config, "walkLeftGifPath", petDefaults.walkLeft);
  runRightGifPath = getConfiguredPath(config, "runRightGifPath", petDefaults.runRight, "runGifPath");
  runLookBackGifPath = getConfiguredPath(config, "runLookBackGifPath", petDefaults.runLookBack);
  runLeftGifPath = getConfiguredPath(config, "runLeftGifPath", petDefaults.runLeft);
  backspaceLeftGifPath = getConfiguredPath(
    config,
    "backspaceLeftGifPath",
    petDefaults.backspaceLeft,
    "deleteGifPath"
  );
  spriteWidthEm = Math.min(0.8, Math.max(0.16, config.get<number>("spriteWidthEm", 0.34)));
  spriteHeightEm = Math.min(0.6, Math.max(0.14, config.get<number>("spriteHeightEm", 0.24)));
  fitToLineHeight = config.get<boolean>("fitToLineHeight", true);
  lineHeightScale = Math.max(0.1, Math.min(0.9, config.get<number>("lineHeightScale", 0.28)));
  spriteAspectRatio = Math.max(0.6, Math.min(2.2, config.get<number>("spriteAspectRatio", 1.1)));

  idleDelayMs = Math.max(100, config.get<number>("idleDelayMs", 350));
  runThresholdCps = Math.max(0.5, config.get<number>("runThresholdCps", 4.5));
  runWordThreshold = Math.max(1, config.get<number>("runWordThreshold", 4));
  activeTypingWindowMs = Math.max(80, config.get<number>("activeTypingWindowMs", 220));
  wakeUpDurationMs = Math.max(80, config.get<number>("wakeUpDurationMs", 260));
  idleStandMs = Math.max(100, config.get<number>("idleStandMs", 2600));
  idlePatrolMs = Math.max(100, config.get<number>("idlePatrolMs", 5200));
  patrolFlipMs = Math.max(120, config.get<number>("patrolFlipMs", 700));
  patrolStepsPerSide = Math.max(1, config.get<number>("patrolStepsPerSide", 3));
  idleWanderCh = Math.max(0, config.get<number>("idleWanderCh", 1.2));
  standLookFlipMs = Math.max(200, config.get<number>("standLookFlipMs", 1300));
  stateRefreshIntervalMs = Math.max(50, config.get<number>("stateRefreshIntervalMs", 120));
  deleteTurnMs = Math.max(80, config.get<number>("deleteTurnMs", 280));
  backspaceRunHoldMs = Math.max(120, config.get<number>("backspaceRunHoldMs", 380));
  backspaceRunThresholdCps = Math.max(1, config.get<number>("backspaceRunThresholdCps", 9));
  navigationMoveMs = Math.max(80, config.get<number>("navigationMoveMs", 220));
  navigationFaceMs = Math.max(120, config.get<number>("navigationFaceMs", 420));
  jumpBaseMs = Math.max(120, config.get<number>("jumpBaseMs", 240));
  jumpPerLineMs = Math.max(0, config.get<number>("jumpPerLineMs", 0));
  jumpMaxMs = Math.max(jumpBaseMs, config.get<number>("jumpMaxMs", 240));
  showBlinkCaret = config.get<boolean>("showBlinkCaret", true);
  blinkCaretIntervalMs = Math.max(120, config.get<number>("blinkCaretIntervalMs", 520));
  blinkCaretSymbol = config.get<string>("blinkCaretSymbol", "|");
  blinkCaretVerticalOffset = config.get<string>("blinkCaretVerticalOffset", "0em");
  disableNativeBlinking = config.get<boolean>("disableNativeBlinking", true);
  hideNativeCursorColor = config.get<boolean>("hideNativeCursorColor", true);

  sitGifUri = buildGifUri(sitGifPath);
  wakeUpGifUri = buildGifUri(wakeUpGifPath);
  standRightGifUri = buildGifUri(standRightGifPath);
  standLeftGifUri = buildGifUri(standLeftGifPath);
  jumpUpGifUri = buildGifUri(jumpUpGifPath);
  jumpDownGifUri = buildGifUri(jumpDownGifPath);
  flyUpGifUri = buildGifUri(flyUpGifPath);
  flyDownGifUri = buildGifUri(flyDownGifPath);
  walkRightGifUri = buildGifUri(walkRightGifPath);
  walkLookBackGifUri = buildGifUri(walkLookBackGifPath);
  walkLeftGifUri = buildGifUri(walkLeftGifPath);
  runRightGifUri = buildGifUri(runRightGifPath);
  runLookBackGifUri = buildGifUri(runLookBackGifPath);
  runLeftGifUri = buildGifUri(runLeftGifPath);
  backspaceLeftGifUri = buildGifUri(backspaceLeftGifPath);
  updatePetStatusBarItem();
}

function buildGifUri(configPath: string): vscode.Uri | undefined {
  const resolved = resolvePath(configPath);
  if (!resolved || !fs.existsSync(resolved)) {
    return undefined;
  }
  const fileUri = vscode.Uri.file(resolved);
  try {
    const mtimeMs = Math.round(fs.statSync(resolved).mtimeMs);
    return fileUri.with({ query: `v=${mtimeMs}` });
  } catch {
    return fileUri;
  }
}

function resolvePath(configPath: string): string | undefined {
  const value = configPath.trim();
  if (!value) {
    return undefined;
  }
  if (path.isAbsolute(value)) {
    return value;
  }
  return path.join(extensionPath, value);
}

function normalizeLegacyGifPath(configValue: string, defaultValue: string): string {
  const trimmed = configValue.trim();
  if (!trimmed) {
    return defaultValue;
  }
  const normalized = trimmed.replace(/\\/g, "/");
  return legacyGifPathMap[normalized] ?? trimmed;
}

function getChangeStats(event: vscode.TextDocumentChangeEvent): {
  insertedChars: number;
  deletedChars: number;
  completedWords: number;
} {
  let insertedChars = 0;
  let deletedChars = 0;
  let completedWords = 0;
  for (const change of event.contentChanges) {
    insertedChars += change.text.length;
    deletedChars += change.rangeLength;
    completedWords += countCompletedWords(change, event.document);
  }
  return { insertedChars, deletedChars, completedWords };
}

function updateTypingState(
  event: vscode.TextDocumentChangeEvent,
  stats: { insertedChars: number; deletedChars: number; completedWords: number }
): void {
  const documentKey = event.document.uri.toString();
  const now = Date.now();
  const state = typingStates.get(documentKey) ?? {
    lastTypeAt: now,
    smoothedCps: 0,
    lastDeleteAt: 0,
    lastDeleteBurstStartAt: now,
    deleteBurstChars: 0,
    deleteSmoothedCps: 0,
    completedWordsSincePause: 0,
    lastWakeAt: now,
    lastNavAt: 0,
    lastNavDirection: "none" as const,
    lastJumpAt: 0,
    lastJumpDirection: "none" as const,
    lastJumpDistance: 0,
    lastJumpColumnDelta: 0,
    lastJumpDurationMs: 0
  };

  if (stats.insertedChars > 0) {
    if (now - state.lastTypeAt > activeTypingWindowMs) {
      state.lastWakeAt = now;
      state.completedWordsSincePause = 0;
    }

    const deltaMs = Math.max(16, now - state.lastTypeAt);
    const instantCps = stats.insertedChars / (deltaMs / 1000);
    const alpha = state.smoothedCps > 0 ? 0.35 : 1;

    state.smoothedCps = state.smoothedCps * (1 - alpha) + instantCps * alpha;
    state.lastTypeAt = now;

    if (stats.completedWords > 0) {
      state.completedWordsSincePause += stats.completedWords;
    }

    // Break delete burst once user is typing new content.
    state.deleteBurstChars = 0;
    state.deleteSmoothedCps *= 0.7;
  }
  if (stats.deletedChars > 0) {
    if (now - state.lastDeleteAt > Math.max(deleteTurnMs, 320)) {
      state.lastDeleteBurstStartAt = now;
      state.deleteBurstChars = 0;
      state.deleteSmoothedCps = 0;
    }
    const deleteDeltaMs = Math.max(16, now - Math.max(state.lastDeleteAt, state.lastDeleteBurstStartAt));
    const deleteInstantCps = stats.deletedChars / (deleteDeltaMs / 1000);
    const alphaDelete = state.deleteSmoothedCps > 0 ? 0.4 : 1;
    state.deleteSmoothedCps = state.deleteSmoothedCps * (1 - alphaDelete) + deleteInstantCps * alphaDelete;
    state.deleteBurstChars += stats.deletedChars;
    state.lastDeleteAt = now;
    if (stats.insertedChars === 0) {
      state.smoothedCps *= 0.9;
    }
  }
  typingStates.set(documentKey, state);
}

function updateNavigationState(event: vscode.TextEditorSelectionChangeEvent): void {
  if (event.selections.length === 0) {
    return;
  }
  const editor = event.textEditor;
  const active = event.selections[0].active;
  const currentOffset = editor.document.offsetAt(active);
  const currentLine = active.line;
  const currentCharacter = active.character;
  const previous = lastCursorSnapshots.get(editor);
  lastCursorSnapshots.set(editor, { offset: currentOffset, line: currentLine, character: currentCharacter });

  if (!previous) {
    return;
  }

  const lineDelta = currentLine - previous.line;
  const now = Date.now();
  const documentKey = editor.document.uri.toString();
  const state = typingStates.get(documentKey) ?? {
    lastTypeAt: 0,
    smoothedCps: 0,
    lastDeleteAt: 0,
    lastDeleteBurstStartAt: 0,
    deleteBurstChars: 0,
    deleteSmoothedCps: 0,
    completedWordsSincePause: 0,
    lastWakeAt: 0,
    lastNavAt: 0,
    lastNavDirection: "none" as const,
    lastJumpAt: 0,
    lastJumpDirection: "none" as const,
    lastJumpDistance: 0,
    lastJumpColumnDelta: 0,
    lastJumpDurationMs: 0
  };

  if (lineDelta !== 0) {
    const jumpDistance = Math.abs(lineDelta);
    state.lastJumpAt = now;
    state.lastJumpDirection = lineDelta < 0 ? "up" : "down";
    state.lastJumpDistance = jumpDistance;
    state.lastJumpColumnDelta = currentCharacter - previous.character;
    state.lastJumpDurationMs = getJumpDurationMs(jumpDistance);
    typingStates.set(documentKey, state);
    return;
  }

  if (currentOffset === previous.offset) {
    return;
  }
  if (event.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
    return;
  }

  const direction: "left" | "right" = currentOffset < previous.offset ? "left" : "right";
  state.lastNavAt = now;
  state.lastNavDirection = direction;
  typingStates.set(documentKey, state);
}

function refreshVisibleEditorsForDocument(document: vscode.TextDocument): void {
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.uri.toString() !== document.uri.toString()) {
      continue;
    }
    if (!enabled) {
      clearDecoration(editor);
      continue;
    }
    applyDecoration(editor);
  }
}

function getMotionState(document: vscode.TextDocument): MotionState {
  const state = typingStates.get(document.uri.toString());
  if (!state) {
    return "sit";
  }

  const now = Date.now();

  if (now - state.lastDeleteAt <= deleteTurnMs) {
    const deleteHeldMs = now - state.lastDeleteBurstStartAt;
    const shouldRunBackspace =
      deleteHeldMs >= backspaceRunHoldMs &&
      (state.deleteBurstChars >= 6 || state.deleteSmoothedCps >= backspaceRunThresholdCps);
    return shouldRunBackspace ? "backspaceRunLeft" : "backspaceLeft";
  }

  if (state.lastJumpDirection !== "none") {
    const jumpAge = now - state.lastJumpAt;
    const jumpDuration =
      state.lastJumpDurationMs > 0 ? state.lastJumpDurationMs : getJumpDurationMs(state.lastJumpDistance);
    if (jumpAge <= jumpDuration) {
      if (activePetProfile.lineChangeMotion === "fly") {
        return state.lastJumpDirection === "up" ? "flyUp" : "flyDown";
      }
      return state.lastJumpDirection === "up" ? "jumpUp" : "jumpDown";
    }
    state.lastJumpDirection = "none";
    state.lastJumpDistance = 0;
    state.lastJumpColumnDelta = 0;
    state.lastJumpDurationMs = 0;
  }

  const idleTime = now - state.lastTypeAt;

  // Typing burst: stand up, then walk/run.
  if (idleTime <= activeTypingWindowMs) {
    if (now - state.lastWakeAt <= wakeUpDurationMs) {
      return "wakeUp";
    }

    const shouldRun =
      (state.completedWordsSincePause >= runWordThreshold && state.smoothedCps >= 2.2) ||
      state.smoothedCps >= runThresholdCps;
    if (shouldRun) {
      return isPlayfulLookBack(true) ? "runLookBack" : "runRight";
    }
    return isPlayfulLookBack(false) ? "walkLookBack" : "walkRight";
  }

  // Cursor-navigation taps (arrow keys / keyboard movement): move and face by direction.
  if (state.lastNavDirection !== "none") {
    const navAge = now - state.lastNavAt;
    if (navAge <= navigationMoveMs) {
      return state.lastNavDirection === "left" ? "walkLeft" : "walkRight";
    }
    if (navAge <= navigationFaceMs) {
      return state.lastNavDirection === "left" ? "standLeft" : "standRight";
    }
  }

  // Just stopped typing: stand and wait, occasionally looking around.
  if (idleTime <= idleStandMs) {
    return Math.floor(idleTime / standLookFlipMs) % 2 === 0 ? "standRight" : "standLeft";
  }

  // Idle attention phase: patrol left and right.
  if (idleTime <= idleStandMs + idlePatrolMs) {
    const patrolTime = idleTime - idleStandMs;
    const steps = Math.floor(patrolTime / patrolFlipMs);
    const sideSegment = Math.floor(steps / patrolStepsPerSide);
    return sideSegment % 2 === 0 ? "walkRight" : "walkLeft";
  }

  // Tired: sit down.
  state.completedWordsSincePause = 0;
  return "sit";
}

function getJumpDurationMs(lineDistance: number): number {
  if (jumpPerLineMs <= 0) {
    return jumpBaseMs;
  }
  const scaled = jumpBaseMs + lineDistance * jumpPerLineMs;
  return Math.min(jumpMaxMs, Math.max(120, scaled));
}

function restartStateLoop(): void {
  stopStateLoop();
  stateRefreshTimer = setInterval(() => {
    stateTick += 1;
    pruneTypingStates();
    if (!enabled) {
      return;
    }
    refreshAllVisibleEditors();
  }, stateRefreshIntervalMs);
}

function stopStateLoop(): void {
  if (!stateRefreshTimer) {
    return;
  }
  clearInterval(stateRefreshTimer);
  stateRefreshTimer = undefined;
}

function pruneTypingStates(): void {
  const now = Date.now();
  for (const [key, state] of typingStates.entries()) {
    const mostRecent = Math.max(state.lastTypeAt, state.lastDeleteAt, state.lastNavAt, state.lastJumpAt);
    if (now - mostRecent > Math.max(idleDelayMs, 700) * 20) {
      typingStates.delete(key);
    }
  }
}

function syncNativeCursorTweaks(): void {
  if (enabled) {
    void applyNativeCursorTweaks();
    return;
  }
  void restoreNativeCursorTweaks();
}

async function applyNativeCursorTweaks(): Promise<void> {
  if (nativeTweaksApplied) {
    return;
  }
  nativeTweaksTarget = getConfigTarget();

  try {
    if (disableNativeBlinking) {
      const editorConfig = vscode.workspace.getConfiguration("editor");
      const inspected = editorConfig.inspect<CursorBlinkingStyle>("cursorBlinking");
      const styleInspected = editorConfig.inspect<CursorStyleSetting>("cursorStyle");
      previousCursorBlinking =
        nativeTweaksTarget === vscode.ConfigurationTarget.Workspace
          ? inspected?.workspaceValue
          : inspected?.globalValue;
      previousCursorStyle =
        nativeTweaksTarget === vscode.ConfigurationTarget.Workspace
          ? styleInspected?.workspaceValue
          : styleInspected?.globalValue;
      await editorConfig.update("cursorBlinking", "solid", nativeTweaksTarget);
      await editorConfig.update("cursorStyle", "line-thin", nativeTweaksTarget);
    }

    if (hideNativeCursorColor) {
      const workbenchConfig = vscode.workspace.getConfiguration("workbench");
      const inspected = workbenchConfig.inspect<Record<string, unknown>>("colorCustomizations");
      const current =
        (nativeTweaksTarget === vscode.ConfigurationTarget.Workspace
          ? inspected?.workspaceValue
          : inspected?.globalValue) ?? {};
      previousColorCustomizations = { ...current };
      await workbenchConfig.update(
        "colorCustomizations",
        {
          ...current,
          "editorCursor.foreground": "#00000000",
          "editorCursor.background": "#00000000"
        },
        nativeTweaksTarget
      );
    }
    nativeTweaksApplied = true;
  } catch {
    // Ignore settings update failures and continue with decoration-only mode.
  }
}

async function restoreNativeCursorTweaks(): Promise<void> {
  if (!nativeTweaksApplied) {
    return;
  }
  try {
    if (disableNativeBlinking) {
      const editorConfig = vscode.workspace.getConfiguration("editor");
      await editorConfig.update("cursorBlinking", previousCursorBlinking, nativeTweaksTarget);
      await editorConfig.update("cursorStyle", previousCursorStyle, nativeTweaksTarget);
    }
    if (hideNativeCursorColor) {
      const workbenchConfig = vscode.workspace.getConfiguration("workbench");
      await workbenchConfig.update(
        "colorCustomizations",
        previousColorCustomizations,
        nativeTweaksTarget
      );
    }
  } catch {
    // Ignore restore failures; user can still manually adjust settings.
  } finally {
    nativeTweaksApplied = false;
    previousCursorBlinking = undefined;
    previousCursorStyle = undefined;
    previousColorCustomizations = undefined;
  }
}

function getConfigTarget(): vscode.ConfigurationTarget {
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    return vscode.ConfigurationTarget.Workspace;
  }
  return vscode.ConfigurationTarget.Global;
}

function countCompletedWords(change: vscode.TextDocumentContentChangeEvent, doc: vscode.TextDocument): number {
  if (change.text.length === 0) {
    return 0;
  }

  // Multi-character insertions are likely paste/auto-completion: count words directly.
  if (change.text.length > 1) {
    return countWords(change.text);
  }

  const ch = change.text;
  if (!isWordDelimiter(ch)) {
    return 0;
  }

  const insertOffset = doc.offsetAt(change.range.start);
  if (insertOffset <= 0) {
    return 0;
  }

  const prevStart = doc.positionAt(insertOffset - 1);
  const prevEnd = doc.positionAt(insertOffset);
  const prevChar = doc.getText(new vscode.Range(prevStart, prevEnd));
  return isWordChar(prevChar) ? 1 : 0;
}

function countWords(text: string): number {
  const matches = text.match(/[A-Za-z0-9_]+(?:'[A-Za-z0-9_]+)?/g);
  return matches ? matches.length : 0;
}

function isWordDelimiter(ch: string): boolean {
  return /[\s.,;:!?()[\]{}"']/u.test(ch);
}

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_]/u.test(ch);
}

function isPlayfulLookBack(isRun: boolean): boolean {
  // Occasionally glance backward while moving forward as if playing with incoming words.
  if (isRun) {
    return stateTick % 10 >= 7;
  }
  return stateTick % 14 >= 11;
}

function getSpriteSize(editor: vscode.TextEditor): { width: string; height: string } {
  if (!fitToLineHeight) {
    return {
      width: `${spriteWidthEm}em`,
      height: `${spriteHeightEm}em`
    };
  }

  const lineHeightPx = getEditorLineHeightPx(editor);
  // Keep sprite safely inside one text line and allow smaller-than-before rendering.
  const targetHeightPx = Math.round(lineHeightPx * lineHeightScale);
  const maxHeightPx = Math.max(4, Math.round(lineHeightPx - 2));
  const heightPx = Math.max(4, Math.min(maxHeightPx, targetHeightPx));
  const widthPx = Math.max(4, Math.round(heightPx * spriteAspectRatio));

  return {
    width: `${widthPx}px`,
    height: `${heightPx}px`
  };
}

function getEditorLineHeightPx(editor: vscode.TextEditor): number {
  const editorConfig = vscode.workspace.getConfiguration("editor", editor.document.uri);
  const fontSize = toPositiveNumber(editorConfig.get<unknown>("fontSize")) ?? 14;
  const configuredLineHeight = toPositiveNumber(editorConfig.get<unknown>("lineHeight"));
  if (configuredLineHeight && configuredLineHeight > 0) {
    return configuredLineHeight;
  }

  // VS Code default line-height behavior when not explicitly configured.
  return Math.round(fontSize * 1.5);
}

function toPositiveNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value > 0 ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}
