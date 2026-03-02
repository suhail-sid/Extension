from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "media"
MEDIA.mkdir(parents=True, exist_ok=True)

W = 104
H = 64
PACK_PREFIX = "cat-pets"

PIXEL_DOWN_SCALE = 0.52
PIXEL_PALETTE_COLORS = 18
NEAREST = getattr(getattr(Image, "Resampling", Image), "NEAREST")

# Light brown + white realistic-ish palette
OUTLINE = (63, 45, 34, 255)
FUR_BASE = (194, 141, 95, 255)      # light brown
FUR_SHADOW = (150, 102, 64, 255)    # darker brown
FUR_HIGHLIGHT = (224, 176, 128, 255)
FUR_WHITE = (244, 238, 228, 255)    # warm white
EAR_INNER = (220, 173, 162, 255)
NOSE = (181, 125, 116, 255)
EYE_IRIS = (101, 145, 84, 255)
EYE_PUPIL = (24, 22, 19, 255)
WHISKER = (238, 235, 229, 230)
MOTION = (183, 183, 183, 170)


def pack_file(stem: str) -> Path:
    return MEDIA / f"{PACK_PREFIX}-{stem}.gif"


def new_frame() -> Image.Image:
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def crop_frames_tight(frames: list[Image.Image]) -> list[Image.Image]:
    if not frames:
        return frames

    left, top, right, bottom = W, H, 0, 0
    found = False
    for frame in frames:
        box = frame.getbbox()
        if not box:
            continue
        found = True
        left = min(left, box[0])
        top = min(top, box[1])
        right = max(right, box[2])
        bottom = max(bottom, box[3])

    if not found:
        return frames

    top = max(0, top - 1)
    bottom = min(H, bottom + 1)
    return [frame.crop((left, top, right, bottom)) for frame in frames]


def save_gif(path: Path, frames: list[Image.Image], duration_ms: int) -> None:
    frames = crop_frames_tight(frames)
    frames = [stylize_pet_frame(frame) for frame in frames]
    first, rest = frames[0], frames[1:]
    first.save(
        path,
        save_all=True,
        append_images=rest,
        duration=duration_ms,
        loop=0,
        disposal=2,
        optimize=True,
    )


def stylize_pet_frame(frame: Image.Image) -> Image.Image:
    # Downscale then upscale with nearest-neighbor to get crisp pixel-art blocks.
    down_w = max(24, int(round(frame.width * PIXEL_DOWN_SCALE)))
    down_h = max(16, int(round(frame.height * PIXEL_DOWN_SCALE)))
    down = frame.resize((down_w, down_h), resample=NEAREST)

    # Limit palette for a retro sprite feel close to vscode-pets style.
    quantized = down.convert("P", palette=Image.Palette.ADAPTIVE, colors=PIXEL_PALETTE_COLORS)
    restored = quantized.convert("RGBA")
    return restored.resize(frame.size, resample=NEAREST)


def draw_head_right(d: ImageDraw.ImageDraw, x: int, y: int, eye_open: bool, look_back: bool = False) -> None:
    d.ellipse((x + 57, y + 16, x + 77, y + 35), fill=FUR_BASE, outline=OUTLINE, width=1)
    d.polygon([(x + 58, y + 18), (x + 62, y + 8), (x + 66, y + 18)], fill=FUR_BASE, outline=OUTLINE)
    d.polygon([(x + 66, y + 18), (x + 71, y + 8), (x + 75, y + 18)], fill=FUR_BASE, outline=OUTLINE)

    # Inner ears
    d.polygon([(x + 60, y + 17), (x + 62, y + 11), (x + 64, y + 17)], fill=EAR_INNER)
    d.polygon([(x + 68, y + 17), (x + 70, y + 11), (x + 73, y + 17)], fill=EAR_INNER)

    if look_back:
        # Keep body moving right, but turn face features toward left.
        d.ellipse((x + 63, y + 24, x + 71, y + 31), fill=FUR_WHITE)
        d.ellipse((x + 59, y + 24, x + 67, y + 31), fill=FUR_WHITE)

        if eye_open:
            d.ellipse((x + 60, y + 20, x + 63, y + 24), fill=EYE_IRIS)
            d.ellipse((x + 66, y + 20, x + 69, y + 24), fill=EYE_IRIS)
            d.ellipse((x + 61, y + 21, x + 62, y + 23), fill=EYE_PUPIL)
            d.ellipse((x + 67, y + 21, x + 68, y + 23), fill=EYE_PUPIL)
        else:
            d.line((x + 60, y + 22, x + 63, y + 22), fill=EYE_PUPIL, width=1)
            d.line((x + 66, y + 22, x + 69, y + 22), fill=EYE_PUPIL, width=1)

        d.polygon([(x + 62, y + 25), (x + 64, y + 25), (x + 63, y + 27)], fill=NOSE)

        d.line((x + 62, y + 27, x + 56, y + 26), fill=WHISKER, width=1)
        d.line((x + 62, y + 28, x + 56, y + 29), fill=WHISKER, width=1)
        d.line((x + 66, y + 27, x + 72, y + 26), fill=WHISKER, width=1)
        d.line((x + 66, y + 28, x + 72, y + 29), fill=WHISKER, width=1)
    else:
        # White muzzle
        d.ellipse((x + 66, y + 24, x + 74, y + 31), fill=FUR_WHITE)
        d.ellipse((x + 62, y + 24, x + 70, y + 31), fill=FUR_WHITE)

        if eye_open:
            d.ellipse((x + 63, y + 20, x + 66, y + 24), fill=EYE_IRIS)
            d.ellipse((x + 69, y + 20, x + 72, y + 24), fill=EYE_IRIS)
            d.ellipse((x + 64, y + 21, x + 65, y + 23), fill=EYE_PUPIL)
            d.ellipse((x + 70, y + 21, x + 71, y + 23), fill=EYE_PUPIL)
        else:
            d.line((x + 63, y + 22, x + 66, y + 22), fill=EYE_PUPIL, width=1)
            d.line((x + 69, y + 22, x + 72, y + 22), fill=EYE_PUPIL, width=1)

        d.polygon([(x + 66, y + 25), (x + 68, y + 25), (x + 67, y + 27)], fill=NOSE)

        # Whiskers
        d.line((x + 69, y + 27, x + 75, y + 26), fill=WHISKER, width=1)
        d.line((x + 69, y + 28, x + 75, y + 29), fill=WHISKER, width=1)
        d.line((x + 65, y + 27, x + 59, y + 26), fill=WHISKER, width=1)
        d.line((x + 65, y + 28, x + 59, y + 29), fill=WHISKER, width=1)


def add_body_texture(d: ImageDraw.ImageDraw, x: int, y: int) -> None:
    # Subtle tabby stripes
    stripe = FUR_SHADOW
    d.line((x + 27, y + 25, x + 33, y + 27), fill=stripe, width=2)
    d.line((x + 35, y + 24, x + 41, y + 26), fill=stripe, width=2)
    d.line((x + 43, y + 24, x + 49, y + 26), fill=stripe, width=2)
    d.line((x + 51, y + 25, x + 57, y + 27), fill=stripe, width=2)


def draw_cat_right_sit(frame: Image.Image, x: int, y: int, eye_open: bool, tail_lift: int) -> None:
    d = ImageDraw.Draw(frame)

    # Body
    d.ellipse((x + 24, y + 22, x + 61, y + 43), fill=FUR_BASE, outline=OUTLINE, width=1)
    d.ellipse((x + 28, y + 24, x + 56, y + 39), fill=FUR_HIGHLIGHT, outline=FUR_SHADOW, width=1)
    d.ellipse((x + 34, y + 29, x + 52, y + 40), fill=FUR_WHITE)  # white chest

    # Tail up and curled
    ty = y + 22 - tail_lift
    d.line((x + 25, y + 33, x + 10, ty), fill=FUR_BASE, width=5)
    d.line((x + 25, y + 33, x + 10, ty), fill=OUTLINE, width=1)
    d.ellipse((x + 7, ty - 3, x + 15, ty + 5), fill=FUR_BASE, outline=OUTLINE, width=1)

    # Legs/paws
    d.line((x + 36, y + 38, x + 36, y + 47), fill=FUR_SHADOW, width=3)
    d.line((x + 46, y + 38, x + 46, y + 47), fill=FUR_SHADOW, width=3)
    d.ellipse((x + 33, y + 44, x + 40, y + 49), fill=FUR_WHITE)
    d.ellipse((x + 43, y + 44, x + 50, y + 49), fill=FUR_WHITE)

    add_body_texture(d, x, y)
    draw_head_right(d, x, y, eye_open=eye_open)


def draw_cat_right_walk(
    frame: Image.Image, x: int, y: int, leg_a: int, leg_b: int, look_back: bool = False
) -> None:
    d = ImageDraw.Draw(frame)

    d.ellipse((x + 22, y + 21, x + 62, y + 39), fill=FUR_BASE, outline=OUTLINE, width=1)
    d.ellipse((x + 26, y + 23, x + 57, y + 36), fill=FUR_HIGHLIGHT, outline=FUR_SHADOW, width=1)
    d.ellipse((x + 34, y + 28, x + 50, y + 37), fill=FUR_WHITE)

    d.line((x + 23, y + 29, x + 9, y + 22), fill=FUR_BASE, width=5)
    d.line((x + 23, y + 29, x + 9, y + 22), fill=OUTLINE, width=1)

    d.line((x + 32, y + 36, x + 31 + leg_a, y + 47), fill=FUR_SHADOW, width=3)
    d.line((x + 42, y + 36, x + 43 - leg_a, y + 47), fill=FUR_SHADOW, width=3)
    d.line((x + 51, y + 36, x + 52 + leg_b, y + 47), fill=FUR_SHADOW, width=3)
    d.line((x + 59, y + 36, x + 59 - leg_b, y + 47), fill=FUR_SHADOW, width=3)

    d.ellipse((x + 28 + leg_a, y + 44, x + 35 + leg_a, y + 49), fill=FUR_WHITE)
    d.ellipse((x + 40 - leg_a, y + 44, x + 47 - leg_a, y + 49), fill=FUR_WHITE)
    d.ellipse((x + 50 + leg_b, y + 44, x + 57 + leg_b, y + 49), fill=FUR_WHITE)

    add_body_texture(d, x, y)
    draw_head_right(d, x, y, eye_open=True, look_back=look_back)


def draw_cat_right_run(
    frame: Image.Image, x: int, y: int, stride: int, speed_step: int, look_back: bool = False
) -> None:
    d = ImageDraw.Draw(frame)

    # Longer, lower body in run
    d.ellipse((x + 18, y + 23, x + 66, y + 38), fill=FUR_BASE, outline=OUTLINE, width=1)
    d.ellipse((x + 22, y + 24, x + 61, y + 34), fill=FUR_HIGHLIGHT, outline=FUR_SHADOW, width=1)
    d.ellipse((x + 34, y + 28, x + 53, y + 35), fill=FUR_WHITE)

    d.line((x + 19, y + 28, x + 7, y + 20), fill=FUR_BASE, width=4)
    d.line((x + 19, y + 28, x + 7, y + 20), fill=OUTLINE, width=1)

    # Extended legs
    d.line((x + 31, y + 35, x + 25 - stride, y + 46), fill=FUR_SHADOW, width=3)
    d.line((x + 41, y + 35, x + 48 + stride, y + 46), fill=FUR_SHADOW, width=3)
    d.line((x + 51, y + 35, x + 56 - stride, y + 46), fill=FUR_SHADOW, width=3)
    d.line((x + 61, y + 35, x + 67 + stride, y + 46), fill=FUR_SHADOW, width=3)

    # Fat white paws for visible realism
    d.ellipse((x + 22 - stride, y + 43, x + 29 - stride, y + 48), fill=FUR_WHITE)
    d.ellipse((x + 44 + stride, y + 43, x + 51 + stride, y + 48), fill=FUR_WHITE)
    d.ellipse((x + 53 - stride, y + 43, x + 60 - stride, y + 48), fill=FUR_WHITE)
    d.ellipse((x + 64 + stride, y + 43, x + 71 + stride, y + 48), fill=FUR_WHITE)

    # Strong run motion trails
    for i in range(4):
        yline = y + 22 + i * 3
        x1 = x + 1 - speed_step - i * 2
        x2 = x + 13 - speed_step - i * 2
        d.line((x1, yline, x2, yline), fill=MOTION, width=2)

    add_body_texture(d, x, y)
    draw_head_right(d, x, y, eye_open=True, look_back=look_back)


def mirror_frame(frame: Image.Image) -> Image.Image:
    return ImageOps.mirror(frame)


def make_sit() -> None:
    frames: list[Image.Image] = []
    for eye_open, tail_lift in [
        (True, 2),
        (True, 3),
        (False, 3),
        (True, 2),
        (True, 1),
        (True, 2),
        (False, 2),
        (True, 3),
    ]:
        f = new_frame()
        draw_cat_right_sit(f, x=7, y=6, eye_open=eye_open, tail_lift=tail_lift)
        frames.append(f)
    save_gif(pack_file("sit"), frames, 125)


def draw_cat_right_stand(frame: Image.Image, x: int, y: int, eye_open: bool, crouch: int) -> None:
    d = ImageDraw.Draw(frame)

    # Body is higher and legs are more extended than sit.
    d.ellipse((x + 23, y + 18 + crouch, x + 62, y + 36 + crouch), fill=FUR_BASE, outline=OUTLINE, width=1)
    d.ellipse((x + 27, y + 19 + crouch, x + 58, y + 33 + crouch), fill=FUR_HIGHLIGHT, outline=FUR_SHADOW, width=1)
    d.ellipse((x + 35, y + 24 + crouch, x + 53, y + 34 + crouch), fill=FUR_WHITE)

    d.line((x + 24, y + 26 + crouch, x + 10, y + 16 + crouch), fill=FUR_BASE, width=5)
    d.line((x + 24, y + 26 + crouch, x + 10, y + 16 + crouch), fill=OUTLINE, width=1)

    # Straight standing legs
    d.line((x + 33, y + 34 + crouch, x + 33, y + 47), fill=FUR_SHADOW, width=3)
    d.line((x + 43, y + 34 + crouch, x + 43, y + 47), fill=FUR_SHADOW, width=3)
    d.line((x + 53, y + 34 + crouch, x + 53, y + 47), fill=FUR_SHADOW, width=3)
    d.line((x + 61, y + 34 + crouch, x + 61, y + 47), fill=FUR_SHADOW, width=3)
    d.ellipse((x + 30, y + 45, x + 36, y + 49), fill=FUR_WHITE)
    d.ellipse((x + 40, y + 45, x + 46, y + 49), fill=FUR_WHITE)
    d.ellipse((x + 50, y + 45, x + 56, y + 49), fill=FUR_WHITE)
    d.ellipse((x + 58, y + 45, x + 64, y + 49), fill=FUR_WHITE)

    add_body_texture(d, x, y + crouch)
    draw_head_right(d, x, y - 2 + crouch, eye_open=eye_open)


def make_stand_right() -> list[Image.Image]:
    frames: list[Image.Image] = []
    for eye_open, crouch in [
        (True, 0),
        (True, 1),
        (False, 1),
        (True, 0),
        (True, 0),
        (True, 1),
        (False, 1),
        (True, 0),
    ]:
        f = new_frame()
        draw_cat_right_stand(f, x=7, y=6, eye_open=eye_open, crouch=crouch)
        frames.append(f)
    save_gif(pack_file("stand-right"), frames, 125)
    return frames


def make_stand_left(stand_right_frames: list[Image.Image]) -> list[Image.Image]:
    frames = [mirror_frame(f) for f in stand_right_frames]
    save_gif(pack_file("stand-left"), frames, 125)
    return frames


def make_wakeup() -> None:
    frames: list[Image.Image] = []

    # Sit frame
    f1 = new_frame()
    draw_cat_right_sit(f1, x=7, y=6, eye_open=True, tail_lift=2)
    frames.append(f1)

    # Mid transition frame
    f2 = new_frame()
    draw_cat_right_stand(f2, x=7, y=6, eye_open=True, crouch=4)
    frames.append(f2)

    # Final stand frame
    f3 = new_frame()
    draw_cat_right_stand(f3, x=7, y=6, eye_open=True, crouch=0)
    frames.append(f3)

    save_gif(pack_file("wakeup"), frames, 95)


def make_walk() -> None:
    frames: list[Image.Image] = []
    for leg_a, leg_b in [(-2, 2), (-1, 1), (1, -1), (2, -2), (2, -2), (1, -1), (-1, 1), (-2, 2)]:
        f = new_frame()
        draw_cat_right_walk(f, x=7, y=6, leg_a=leg_a, leg_b=leg_b)
        frames.append(f)
    save_gif(pack_file("walk-right"), frames, 125)
    save_gif(pack_file("walk-left"), [mirror_frame(f) for f in frames], 125)


def make_walk_lookback() -> None:
    frames: list[Image.Image] = []
    for leg_a, leg_b in [(-2, 2), (-1, 1), (1, -1), (2, -2), (2, -2), (1, -1), (-1, 1), (-2, 2)]:
        f = new_frame()
        draw_cat_right_walk(f, x=7, y=6, leg_a=leg_a, leg_b=leg_b, look_back=True)
        frames.append(f)
    save_gif(pack_file("walk-right-lookback"), frames, 125)


def make_run() -> None:
    frames: list[Image.Image] = []
    for stride, speed_step in [(-5, 0), (-2, 2), (3, 4), (5, 6), (5, 7), (3, 8), (-2, 10), (-5, 12)]:
        f = new_frame()
        draw_cat_right_run(f, x=7, y=6, stride=stride, speed_step=speed_step)
        frames.append(f)
    save_gif(pack_file("run-right"), frames, 70)
    save_gif(pack_file("run-left"), [mirror_frame(f) for f in frames], 70)


def make_run_lookback() -> None:
    frames: list[Image.Image] = []
    for stride, speed_step in [(-5, 0), (-2, 2), (3, 4), (5, 6), (5, 7), (3, 8), (-2, 10), (-5, 12)]:
        f = new_frame()
        draw_cat_right_run(f, x=7, y=6, stride=stride, speed_step=speed_step, look_back=True)
        frames.append(f)
    save_gif(pack_file("run-right-lookback"), frames, 70)


def make_backspace_left() -> None:
    # Backspace state: walk left while looking toward deleted text.
    frames: list[Image.Image] = []
    for leg_a, leg_b in [(2, -2), (1, -1), (-1, 1), (-2, 2), (-2, 2), (-1, 1), (1, -1), (2, -2)]:
        base = new_frame()
        draw_cat_right_walk(base, x=7, y=6, leg_a=leg_a, leg_b=leg_b)
        frames.append(mirror_frame(base))
    save_gif(pack_file("backspace-left"), frames, 125)


def write_legacy_aliases() -> None:
    # Keep old filenames so existing user settings still work.
    aliases = [
        (f"{PACK_PREFIX}-sit.gif", "cat-sit.gif"),
        (f"{PACK_PREFIX}-wakeup.gif", "cat-wakeup.gif"),
        (f"{PACK_PREFIX}-stand-right.gif", "cat-stand-right.gif"),
        (f"{PACK_PREFIX}-stand-left.gif", "cat-stand-left.gif"),
        (f"{PACK_PREFIX}-walk-right.gif", "cat-walk-right.gif"),
        (f"{PACK_PREFIX}-walk-right-lookback.gif", "cat-walk-right-lookback.gif"),
        (f"{PACK_PREFIX}-walk-left.gif", "cat-walk-left.gif"),
        (f"{PACK_PREFIX}-run-right.gif", "cat-run-right.gif"),
        (f"{PACK_PREFIX}-run-right-lookback.gif", "cat-run-right-lookback.gif"),
        (f"{PACK_PREFIX}-run-left.gif", "cat-run-left.gif"),
        (f"{PACK_PREFIX}-backspace-left.gif", "cat-backspace-left.gif"),
        (f"{PACK_PREFIX}-walk-right.gif", "cat-walk.gif"),
        (f"{PACK_PREFIX}-run-right.gif", "cat-run.gif"),
        (f"{PACK_PREFIX}-backspace-left.gif", "cat-push-left.gif"),
    ]
    for source_name, alias_name in aliases:
        src = MEDIA / source_name
        dst = MEDIA / alias_name
        if src.exists():
            dst.write_bytes(src.read_bytes())


def main() -> None:
    make_sit()
    stand_right = make_stand_right()
    make_stand_left(stand_right)
    make_wakeup()
    make_walk()
    make_walk_lookback()
    make_run()
    make_run_lookback()
    make_backspace_left()
    write_legacy_aliases()
    print("Generated cat GIFs in", MEDIA)


if __name__ == "__main__":
    main()
