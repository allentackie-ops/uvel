from __future__ import annotations

import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "today"
FRAME_DIR = ROOT / ".tmp-finishing-pieces-frames"
OUT_DIR.mkdir(parents=True, exist_ok=True)
FRAME_DIR.mkdir(parents=True, exist_ok=True)

W, H = 1056, 1308
FPS = 24
DURATION = 8
BG = (32, 167, 154, 255)  # Today banner color for accessories/collage
INK = (14, 63, 61, 255)
CREAM = (250, 241, 218, 255)
LIME = (205, 239, 113, 255)
WHITE = (255, 255, 255, 255)


def font(size: int, bold: bool = False):
    name = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(name, size)


def fit_crop(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    image = image.convert("RGB")
    scale = max(size[0] / image.width, size[1] / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (image.width - size[0]) // 2
    top = (image.height - size[1]) // 2
    return image.crop((left, top, left + size[0], top + size[1])).convert("RGBA")


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def item_card(photo: Path, label: str, accent: tuple[int, int, int, int], size: tuple[int, int] = (250, 290)) -> Image.Image:
    card = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=30, fill=(248, 241, 218, 255), outline=accent, width=5)
    photo_size = (size[0] - 28, size[1] - 70)
    image = fit_crop(Image.open(photo), photo_size)
    image.putalpha(rounded_mask(photo_size, 22))
    card.alpha_composite(image, (14, 14))
    draw.text((18, size[1] - 48), label.upper(), font=font(16, True), fill=INK)
    return card


def alpha_for(t: float, phase: float) -> float:
    # Four-second cosine pulse: every card fully exits and re-enters, with phase offsets.
    p = (t / 4.0 + phase) % 1.0
    wave = 0.5 + 0.5 * math.cos(2 * math.pi * p)
    # A crisp-but-soft editorial vanish: present, then gone, then back.
    return max(0.0, min(1.0, (wave - 0.12) / 0.88))


def draw_text(draw: ImageDraw.ImageDraw, xy, text, fnt, fill, anchor=None, spacing=4):
    draw.multiline_text(xy, text, font=fnt, fill=fill, anchor=anchor, spacing=spacing)


items = [
    (ROOT / "assets/catalog/cowboy-boots.jpg", "western boot", (14, 63, 61, 255), (0.00, 70, 690, 246, 350, -8)),
    (ROOT / "assets/catalog/loafer.jpg", "quiet loafer", (205, 239, 113, 255), (0.25, 640, 705, 248, 355, 8)),
    (ROOT / "assets/catalog/leather-trench.jpg", "leather layer", (14, 63, 61, 255), (0.50, 32, 875, 236, 286, 7)),
    (ROOT / "assets/catalog/poet-blouse.jpg", "soft contrast", (205, 239, 113, 255), (0.75, 710, 930, 230, 300, -6)),
]

# Render the same 8-second cycle at 24fps. The first and last playback states meet cleanly.
for frame_index in range(FPS * DURATION):
    t = frame_index / FPS
    canvas = Image.new("RGBA", (W, H), BG)
    draw = ImageDraw.Draw(canvas)

    # Calm editorial texture and a playful lime orbit line.
    for y in range(0, H, 18):
        draw.line((0, y, W, y), fill=(255, 255, 255, 13), width=1)
    orbit = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(orbit)
    od.arc((110, 470, 950, 1320), 205, 337, fill=LIME, width=5)
    od.arc((170, 530, 890, 1250), 205, 337, fill=(250, 241, 218, 115), width=2)
    orbit = orbit.rotate(math.sin(t * math.pi / 2) * 1.7, resample=Image.Resampling.BICUBIC, center=(528, 900))
    canvas.alpha_composite(orbit)

    # Header: intentionally matches the app copy in lib/todayBannerEngine.ts.
    draw_text(draw, (52, 54), "ACCESSORIES / 04", font(18, True), INK)
    draw_text(draw, (52, 100), "The\nfinishing\npieces", font(88, True), CREAM, spacing=-3)
    draw_text(draw, (56, 397), "Bags, shoes, jewelry, and the small\ndecisions that change the whole look.", font(24), CREAM, spacing=8)

    # Tiny system cue makes the motion legible as a product banner, not a random montage.
    draw.rounded_rectangle((56, 508, 300, 558), radius=25, fill=INK)
    draw_text(draw, (178, 533), "BUILD THE LOOK  →", font(17, True), LIME, anchor="mm")

    for photo, label, accent, motion in items:
        phase, x, y, cw, ch, angle = motion
        alpha = alpha_for(t, phase)
        # Slight breathing gives the vanish/reappear action a physical, fashion-editorial feel.
        breath = 1.0 + 0.035 * math.sin(2 * math.pi * (t / 4.0 + phase))
        card = item_card(photo, label, accent, (cw, ch))
        card = card.resize((round(cw * breath), round(ch * breath)), Image.Resampling.BICUBIC)
        card = card.rotate(angle + 2.0 * math.sin(2 * math.pi * (t / 4.0 + phase)), resample=Image.Resampling.BICUBIC, expand=True)
        card.putalpha(card.getchannel("A").point(lambda a: round(a * alpha)))
        px = round(x + (cw - card.width) / 2)
        py = round(y + (ch - card.height) / 2)
        # Soft shadow mirrors the live poster’s layered card feel.
        shadow = Image.new("RGBA", card.size, (0, 0, 0, 0))
        shadow.alpha_composite(card)
        shadow = shadow.filter(ImageFilter.GaussianBlur(11))
        shadow.putalpha(shadow.getchannel("A").point(lambda a: round(a * 0.18)))
        canvas.alpha_composite(shadow, (px + 10, py + 14))
        canvas.alpha_composite(card, (px, py))

    # Footer lockup stays stable while the pieces cycle, so the value proposition remains readable.
    draw.line((56, 1231, 1000, 1231), fill=(250, 241, 218, 150), width=2)
    draw_text(draw, (56, 1254), "UVEL / TODAY EDIT", font(16, True), CREAM)
    draw_text(draw, (1000, 1254), "SWIPE TO SHOP", font(16, True), LIME, anchor="ra")

    canvas.convert("RGB").save(FRAME_DIR / f"frame-{frame_index:04d}.jpg", quality=94, optimize=True)

output = OUT_DIR / "finishing-pieces-loop.mp4"
subprocess.run([
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
    "-framerate", str(FPS), "-i", str(FRAME_DIR / "frame-%04d.jpg"),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high",
    "-crf", "18", "-movflags", "+faststart", str(output),
], check=True)
print(output)
