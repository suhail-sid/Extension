from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "media"
MEDIA.mkdir(parents=True, exist_ok=True)

FPS_DURATION_MS = 125
EXCLUDED_PET_DIRS = {"backgrounds", "icon"}
KNOWN_STATES = [
    "fall_from_grab",
    "walk_fast",
    "with_ball",
    "wallclimb",
    "wallgrab",
    "stand",
    "jump",
    "idle",
    "walk",
    "run",
    "swipe",
    "land",
    "lie",
]
VARIANT_PRIORITY = [
    "lightbrown",
    "brown",
    "gray",
    "white",
    "orange",
    "black",
    "red",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
    "akita",
    "warrior",
    "magical",
]


def find_vscode_pets_media_root() -> Path:
    candidate_roots = [Path.home() / ".vscode" / "extensions"]
    appdata = os.getenv("APPDATA")
    if appdata:
        candidate_roots.append(Path(appdata) / "Code" / "extensions")

    candidates: list[Path] = []
    for base in candidate_roots:
        if not base.exists():
            continue
        candidates.extend(base.glob("tonybaloney.vscode-pets-*"))

    if not candidates:
        raise FileNotFoundError("vscode-pets extension not found in known extension directories")

    latest = max(candidates, key=lambda p: p.stat().st_mtime)
    media_root = latest / "media"
    if not media_root.exists():
        raise FileNotFoundError(f"vscode-pets media directory not found: {media_root}")
    return media_root


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


def pet_name(pet: str, stem: str) -> str:
    return f"pet-{pet}-{stem}.gif"


def frame_at(frames: list[Image.Image], index: int) -> Image.Image:
    if not frames:
        raise ValueError("No frames available")
    safe_index = max(0, min(len(frames) - 1, index))
    return frames[safe_index].copy()


def collect_variant_state_paths(pet_dir: Path) -> dict[str, dict[str, Path]]:
    variants: dict[str, dict[str, Path]] = {}
    for state in KNOWN_STATES:
        suffix = f"_{state}_8fps.gif"
        for path in pet_dir.glob(f"*_{state}_8fps.gif"):
            name = path.name
            if not name.endswith(suffix):
                continue
            variant = name[: -len(suffix)]
            if not variant:
                continue
            variants.setdefault(variant, {})[state] = path
    return variants


def pick_variant(variants: dict[str, dict[str, Path]]) -> str:
    if not variants:
        raise ValueError("No animation variants found")

    def score(item: tuple[str, dict[str, Path]]) -> tuple[int, int, str]:
        variant, states = item
        score_value = 0
        score_value += 5 if "idle" in states else 0
        score_value += 5 if "walk" in states else 0
        score_value += 5 if "run" in states else 0
        score_value += 3 if "stand" in states else 0
        score_value += 3 if "lie" in states else 0
        score_value += 2 if "walk_fast" in states else 0
        score_value += 2 if "jump" in states else 0
        score_value += 2 if "fall_from_grab" in states else 0
        score_value += 1 if "land" in states else 0
        try:
            priority = VARIANT_PRIORITY.index(variant)
        except ValueError:
            priority = len(VARIANT_PRIORITY) + 100
        return (score_value, -priority, variant)

    best = max(variants.items(), key=score)
    return best[0]


def load_state(
    variant_states: dict[str, Path], state: str
) -> tuple[list[Image.Image], list[int]] | None:
    path = variant_states.get(state)
    if not path or not path.exists():
        return None
    return load_gif_frames(path)


def choose_state(
    variant_states: dict[str, Path], candidates: list[str]
) -> tuple[list[Image.Image], list[int]]:
    for state in candidates:
        loaded = load_state(variant_states, state)
        if loaded:
            return loaded
    raise ValueError(f"Missing states from candidate list: {', '.join(candidates)}")


def generate_pet_pack(pet_name_key: str, pet_dir: Path) -> tuple[str, str]:
    variants = collect_variant_state_paths(pet_dir)
    variant = pick_variant(variants)
    variant_states = variants[variant]

    idle_frames, idle_durations = choose_state(variant_states, ["idle", "stand", "lie", "walk"])
    stand_frames, stand_durations = choose_state(variant_states, ["stand", "idle", "walk"])
    sit_frames, sit_durations = choose_state(variant_states, ["lie", "idle", "stand"])
    walk_frames, walk_durations = choose_state(variant_states, ["walk", "idle", "stand"])
    run_frames, run_durations = choose_state(variant_states, ["run", "walk", "idle"])
    fast_frames, fast_durations = choose_state(variant_states, ["walk_fast", "run", "walk"])
    fall_frames, _ = choose_state(variant_states, ["fall_from_grab", "jump", "run", "walk"])
    land_frames, land_durations = choose_state(variant_states, ["land", "stand", "idle"])

    save_gif(MEDIA / pet_name(pet_name_key, "sit"), sit_frames, sit_durations)
    save_gif(MEDIA / pet_name(pet_name_key, "stand-right"), stand_frames, stand_durations)
    save_gif(MEDIA / pet_name(pet_name_key, "stand-left"), mirror_frames(stand_frames), stand_durations)

    wake_frames = [
        frame_at(stand_frames, 0),
        frame_at(stand_frames, 1),
        frame_at(fast_frames, 0),
        frame_at(fast_frames, 1),
    ]
    save_gif(MEDIA / pet_name(pet_name_key, "wakeup"), wake_frames, [90, 90, 90, 90])

    save_gif(MEDIA / pet_name(pet_name_key, "walk-right"), walk_frames, walk_durations)
    save_gif(MEDIA / pet_name(pet_name_key, "walk-right-lookback"), walk_frames, walk_durations)
    save_gif(MEDIA / pet_name(pet_name_key, "walk-left"), mirror_frames(walk_frames), walk_durations)

    save_gif(MEDIA / pet_name(pet_name_key, "run-right"), run_frames, run_durations)
    save_gif(MEDIA / pet_name(pet_name_key, "run-right-lookback"), run_frames, run_durations)
    save_gif(MEDIA / pet_name(pet_name_key, "run-left"), mirror_frames(run_frames), run_durations)

    save_gif(MEDIA / pet_name(pet_name_key, "backspace-left"), mirror_frames(walk_frames), walk_durations)

    jump_down_frames = [frame_at(fall_frames, 0), frame_at(fall_frames, len(fall_frames) - 1), frame_at(land_frames, 0)]
    save_gif(MEDIA / pet_name(pet_name_key, "jump-down"), jump_down_frames, [80, 80, 80])

    jump_up_frames = [frame_at(fall_frames, len(fall_frames) - 1), frame_at(fall_frames, 0)]
    save_gif(MEDIA / pet_name(pet_name_key, "jump-up"), jump_up_frames, [90, 90])

    fly_up_frames = [frame_at(fast_frames, 0), frame_at(fast_frames, 1), frame_at(fast_frames, 2)]
    save_gif(MEDIA / pet_name(pet_name_key, "fly-up"), fly_up_frames, [75, 75, 75])

    fly_down_frames = [frame_at(fast_frames, 2), frame_at(fast_frames, 1), frame_at(fast_frames, 0)]
    save_gif(MEDIA / pet_name(pet_name_key, "fly-down"), fly_down_frames, [75, 75, 75])

    return pet_name_key, variant


def write_cat_legacy_aliases() -> None:
    aliases = [
        ("pet-cat-sit.gif", "cat-vspets-sit.gif"),
        ("pet-cat-wakeup.gif", "cat-vspets-wakeup.gif"),
        ("pet-cat-stand-right.gif", "cat-vspets-stand-right.gif"),
        ("pet-cat-stand-left.gif", "cat-vspets-stand-left.gif"),
        ("pet-cat-jump-up.gif", "cat-vspets-jump-up.gif"),
        ("pet-cat-jump-down.gif", "cat-vspets-jump-down.gif"),
        ("pet-cat-walk-right.gif", "cat-vspets-walk-right.gif"),
        ("pet-cat-walk-right-lookback.gif", "cat-vspets-walk-right-lookback.gif"),
        ("pet-cat-walk-left.gif", "cat-vspets-walk-left.gif"),
        ("pet-cat-run-right.gif", "cat-vspets-run-right.gif"),
        ("pet-cat-run-right-lookback.gif", "cat-vspets-run-right-lookback.gif"),
        ("pet-cat-run-left.gif", "cat-vspets-run-left.gif"),
        ("pet-cat-backspace-left.gif", "cat-vspets-backspace-left.gif"),
    ]

    for src_name, dst_name in aliases:
        src = MEDIA / src_name
        dst = MEDIA / dst_name
        if src.exists():
            dst.write_bytes(src.read_bytes())


def main() -> None:
    media_root = find_vscode_pets_media_root()
    pet_dirs = sorted(
        [d for d in media_root.iterdir() if d.is_dir() and d.name not in EXCLUDED_PET_DIRS],
        key=lambda d: d.name,
    )
    generated: list[tuple[str, str]] = []
    for pet_dir in pet_dirs:
        try:
            generated.append(generate_pet_pack(pet_dir.name, pet_dir))
        except Exception as ex:  # noqa: BLE001
            print(f"Skipping {pet_dir.name}: {ex}")

    write_cat_legacy_aliases()
    if not generated:
        raise RuntimeError("No pet packs were generated")

    print(f"Generated {len(generated)} pet packs in {MEDIA}")
    for pet_name_key, variant in generated:
        print(f" - {pet_name_key}: {variant}")


if __name__ == "__main__":
    main()
