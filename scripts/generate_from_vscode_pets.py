from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "media"
MEDIA.mkdir(parents=True, exist_ok=True)

PACK_PREFIX = "cat-vspets"
COLOR = "lightbrown"
FPS_DURATION_MS = 125


def find_vscode_pets_cat_dir() -> Path:
    base = Path.home() / ".vscode" / "extensions"
    candidates = sorted(base.glob("tonybaloney.vscode-pets-*"))
    if not candidates:
        raise FileNotFoundError("vscode-pets extension not found in ~/.vscode/extensions")
    # Latest installed folder by modified time.
    latest = max(candidates, key=lambda p: p.stat().st_mtime)
    cat_dir = latest / "media" / "cat"
    if not cat_dir.exists():
        raise FileNotFoundError(f"cat media directory not found: {cat_dir}")
    return cat_dir


def load_gif_frames(path: Path) -> tuple[list[Image.Image], list[int]]:
    with Image.open(path) as im:
        frames: list[Image.Image] = []
        durations: list[int] = []
        i = 0
        while True:
            try:
                im.seek(i)
            except EOFError:
                break
            frame = im.convert("RGBA").copy()
            duration = int(im.info.get("duration", FPS_DURATION_MS))
            if duration <= 0:
                duration = FPS_DURATION_MS
            frames.append(frame)
            durations.append(duration)
            i += 1
    return frames, durations


def crop_frames_tight(frames: list[Image.Image], pad: int = 1) -> list[Image.Image]:
    if not frames:
        return frames
    left = min((f.getbbox() or (0, 0, f.width, f.height))[0] for f in frames)
    top = min((f.getbbox() or (0, 0, f.width, f.height))[1] for f in frames)
    right = max((f.getbbox() or (0, 0, f.width, f.height))[2] for f in frames)
    bottom = max((f.getbbox() or (0, 0, f.width, f.height))[3] for f in frames)
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(frames[0].width, right + pad)
    bottom = min(frames[0].height, bottom + pad)
    return [f.crop((left, top, right, bottom)) for f in frames]


def save_gif(path: Path, frames: list[Image.Image], durations: Iterable[int]) -> None:
    durations_list = list(durations)
    if not frames:
        raise ValueError("No frames provided")
    if not durations_list:
        durations_list = [FPS_DURATION_MS] * len(frames)
    if len(durations_list) != len(frames):
        durations_list = [durations_list[0]] * len(frames)

    frames = crop_frames_tight(frames)
    first, rest = frames[0], frames[1:]
    first.save(
        path,
        save_all=True,
        append_images=rest,
        duration=durations_list,
        loop=0,
        disposal=2,
        optimize=True,
    )


def mirror_frames(frames: list[Image.Image]) -> list[Image.Image]:
    return [ImageOps.mirror(f) for f in frames]


def hold_first_frame(frames: list[Image.Image], count: int = 8) -> list[Image.Image]:
    first = frames[0]
    return [first.copy() for _ in range(count)]


def pet_name(stem: str) -> str:
    return f"{PACK_PREFIX}-{stem}.gif"


def write_aliases() -> None:
    aliases = [
        # New compatibility aliases for our previous generated pack names.
        ("cat-vspets-sit.gif", "cat-pets-sit.gif"),
        ("cat-vspets-wakeup.gif", "cat-pets-wakeup.gif"),
        ("cat-vspets-stand-right.gif", "cat-pets-stand-right.gif"),
        ("cat-vspets-stand-left.gif", "cat-pets-stand-left.gif"),
        ("cat-vspets-jump-up.gif", "cat-pets-jump-up.gif"),
        ("cat-vspets-jump-down.gif", "cat-pets-jump-down.gif"),
        ("cat-vspets-walk-right.gif", "cat-pets-walk-right.gif"),
        ("cat-vspets-walk-right-lookback.gif", "cat-pets-walk-right-lookback.gif"),
        ("cat-vspets-walk-left.gif", "cat-pets-walk-left.gif"),
        ("cat-vspets-run-right.gif", "cat-pets-run-right.gif"),
        ("cat-vspets-run-right-lookback.gif", "cat-pets-run-right-lookback.gif"),
        ("cat-vspets-run-left.gif", "cat-pets-run-left.gif"),
        ("cat-vspets-backspace-left.gif", "cat-pets-backspace-left.gif"),
        # Legacy names.
        ("cat-vspets-sit.gif", "cat-sit.gif"),
        ("cat-vspets-wakeup.gif", "cat-wakeup.gif"),
        ("cat-vspets-stand-right.gif", "cat-stand-right.gif"),
        ("cat-vspets-stand-left.gif", "cat-stand-left.gif"),
        ("cat-vspets-jump-up.gif", "cat-jump-up.gif"),
        ("cat-vspets-jump-down.gif", "cat-jump-down.gif"),
        ("cat-vspets-walk-right.gif", "cat-walk-right.gif"),
        ("cat-vspets-walk-right-lookback.gif", "cat-walk-right-lookback.gif"),
        ("cat-vspets-walk-left.gif", "cat-walk-left.gif"),
        ("cat-vspets-run-right.gif", "cat-run-right.gif"),
        ("cat-vspets-run-right-lookback.gif", "cat-run-right-lookback.gif"),
        ("cat-vspets-run-left.gif", "cat-run-left.gif"),
        ("cat-vspets-backspace-left.gif", "cat-backspace-left.gif"),
        ("cat-vspets-walk-right.gif", "cat-walk.gif"),
        ("cat-vspets-run-right.gif", "cat-run.gif"),
        ("cat-vspets-backspace-left.gif", "cat-push-left.gif"),
    ]

    for src_name, dst_name in aliases:
        src = MEDIA / src_name
        dst = MEDIA / dst_name
        if src.exists():
            dst.write_bytes(src.read_bytes())


def main() -> None:
    cat_dir = find_vscode_pets_cat_dir()
    idle_frames, idle_durations = load_gif_frames(cat_dir / f"{COLOR}_idle_8fps.gif")
    walk_frames, walk_durations = load_gif_frames(cat_dir / f"{COLOR}_walk_8fps.gif")
    run_frames, run_durations = load_gif_frames(cat_dir / f"{COLOR}_run_8fps.gif")
    fast_frames, _ = load_gif_frames(cat_dir / f"{COLOR}_walk_fast_8fps.gif")
    fall_frames, _ = load_gif_frames(cat_dir / f"{COLOR}_fall_from_grab_8fps.gif")
    land_frames, land_durations = load_gif_frames(cat_dir / f"{COLOR}_land_8fps.gif")

    # Sit = original idle animation.
    save_gif(MEDIA / pet_name("sit"), idle_frames, idle_durations)

    # Stand states = full idle animation for subtle tail/body movement while waiting.
    stand_frames = [f.copy() for f in idle_frames]
    save_gif(MEDIA / pet_name("stand-right"), stand_frames, idle_durations)
    save_gif(MEDIA / pet_name("stand-left"), mirror_frames(stand_frames), idle_durations)

    # Line-change jump states.
    jump_down_frames = [fall_frames[0].copy(), fall_frames[-1].copy(), land_frames[0].copy()]
    jump_down_durations = [80, 80, 80]
    save_gif(MEDIA / pet_name("jump-down"), jump_down_frames, jump_down_durations)

    jump_up_frames = [fall_frames[-1].copy(), fall_frames[0].copy()]
    jump_up_durations = [90, 90]
    save_gif(MEDIA / pet_name("jump-up"), jump_up_frames, jump_up_durations)

    # Wakeup = quick transition from idle to movement.
    wake_frames = [idle_frames[0].copy(), idle_frames[1].copy(), fast_frames[0].copy(), fast_frames[1].copy()]
    save_gif(MEDIA / pet_name("wakeup"), wake_frames, [90, 90, 90, 90])

    save_gif(MEDIA / pet_name("walk-right"), walk_frames, walk_durations)
    save_gif(MEDIA / pet_name("walk-right-lookback"), walk_frames, walk_durations)
    save_gif(MEDIA / pet_name("walk-left"), mirror_frames(walk_frames), walk_durations)

    save_gif(MEDIA / pet_name("run-right"), run_frames, run_durations)
    save_gif(MEDIA / pet_name("run-right-lookback"), run_frames, run_durations)
    save_gif(MEDIA / pet_name("run-left"), mirror_frames(run_frames), run_durations)

    # Backspace motion uses left walk to stay readable.
    save_gif(MEDIA / pet_name("backspace-left"), mirror_frames(walk_frames), walk_durations)
    write_aliases()
    print("Generated vscode-pets based cat pack at", MEDIA)


if __name__ == "__main__":
    main()
