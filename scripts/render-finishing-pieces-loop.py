from __future__ import annotations

import math
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/today/finishing-pieces-loop.mp4"
FRAMES = ROOT / ".tmp-finishing-pieces-frames"
FRAMES.mkdir(exist_ok=True)
W, H, FPS, SECONDS = 1056, 1308, 24, 8
BG = (25, 164, 153, 255)
INK = (22, 55, 62, 255)
CREAM = (255, 246, 220, 255)
PINK = (242, 74, 140, 255)
ORANGE = (255, 139, 53, 255)
PURPLE = (125, 88, 229, 255)
YELLOW = (222, 244, 82, 255)
BLUE = (42, 114, 232, 255)


def F(size: int, bold=False):
    path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(path, size)


def cycle(t: float, phase: float):
    """A soft full vanish/reveal cycle, phase-shifted per collage piece."""
    x = (t / 4.0 + phase) % 1.0
    return max(0.0, min(1.0, (0.5 + 0.5 * math.cos(2 * math.pi * x) - 0.12) / 0.88))


def alpha(im, value):
    im = im.copy()
    im.putalpha(im.getchannel("A").point(lambda p: round(p * value)))
    return im


def sticker_cutout(path: Path, size: tuple[int, int], outline=CREAM):
    src = Image.open(path).convert("RGBA")
    scale = min(size[0] / src.width, size[1] / src.height)
    src = src.resize((round(src.width * scale), round(src.height * scale)), Image.Resampling.LANCZOS)
    art = Image.new("RGBA", size, (0, 0, 0, 0))
    art.alpha_composite(src, ((size[0] - src.width) // 2, (size[1] - src.height) // 2))
    mask = art.getchannel("A")
    expanded = mask.filter(ImageFilter.MaxFilter(25))
    border = Image.new("RGBA", size, outline)
    border.putalpha(ImageChops.subtract(expanded, mask))
    art = Image.alpha_composite(border, art)
    return art


def tag(text, fill, fg=INK, angle=0, size=(230, 62)):
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((2, 2, size[0] - 3, size[1] - 3), radius=18, fill=fill, outline=CREAM, width=4)
    d.text((size[0] // 2, size[1] // 2), text, font=F(19, True), fill=fg, anchor="mm")
    return im.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)


def bag_icon(size=(240, 280)):
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((27, 55, 213, 230), radius=34, fill=PINK, outline=CREAM, width=10)
    d.arc((72, 4, 168, 105), 180, 360, fill=CREAM, width=15)
    d.line((72, 120, 168, 120), fill=YELLOW, width=7)
    d.ellipse((102, 108, 138, 144), fill=YELLOW)
    return im


def jewelry_icon(size=(210, 210)):
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((20, 20, 190, 190), outline=CREAM, width=14)
    d.ellipse((77, 77, 133, 133), fill=YELLOW, outline=INK, width=7)
    d.polygon([(105, 64), (122, 92), (154, 98), (130, 120), (137, 153), (105, 136), (73, 153), (80, 120), (56, 98), (88, 92)], fill=PINK, outline=CREAM)
    return im


def sunglasses_icon(size=(240, 160)):
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((12, 42, 102, 132), fill=BLUE, outline=CREAM, width=9)
    d.ellipse((138, 42, 228, 132), fill=BLUE, outline=CREAM, width=9)
    d.line((102, 68, 138, 68), fill=CREAM, width=9)
    d.arc((0, 5, 110, 65), 190, 350, fill=INK, width=8)
    d.arc((130, 5, 240, 65), 190, 350, fill=INK, width=8)
    return im


def paint_blob(d, box, color, slant=0):
    x0, y0, x1, y1 = box
    pts = [(x0 + 24, y0 + 10), (x0 + (x1-x0)*.54, y0 - 8 + slant), (x1 - 18, y0 + 20),
           (x1 + 5, y0 + (y1-y0)*.55), (x1 - 26, y1 - 5), (x0 + (x1-x0)*.46, y1 + 10),
           (x0 - 6, y1 - 28), (x0 + 18, y0 + (y1-y0)*.45)]
    d.polygon(pts, fill=color)


def arrow(d, points, color=CREAM, width=9):
    d.line(points, fill=color, width=width, joint="curve")
    (x1, y1), (x2, y2) = points[-2], points[-1]
    angle = math.atan2(y2 - y1, x2 - x1)
    left = (x2 - 25 * math.cos(angle - .55), y2 - 25 * math.sin(angle - .55))
    right = (x2 - 25 * math.cos(angle + .55), y2 - 25 * math.sin(angle + .55))
    d.polygon([(x2, y2), left, right], fill=color)


boots = sticker_cutout(ROOT / "assets/catalog/cutouts/cowboy-boots.png", (470, 490))
trench = sticker_cutout(ROOT / "assets/catalog/cutouts/leather-trench.png", (430, 520))
denim = sticker_cutout(ROOT / "assets/catalog/cutouts/vintage-denim.png", (360, 420))
visuals = [
    (boots, 0.00, 515, 735, -8, (0.72, 0.68)),
    (bag_icon(), 0.25, 745, 655, 7, (0.90, 0.90)),
    (trench, 0.50, 250, 835, 8, (0.78, 0.80)),
    (jewelry_icon(), 0.75, 455, 1020, -10, (0.92, 0.92)),
    (sunglasses_icon(), 0.125, 740, 1000, -4, (0.76, 0.76)),
]

for n in range(FPS * SECONDS):
    t = n / FPS
    im = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(im)

    # Existing Uvel banner language: bold color field + paper-like collage blocks.
    paint_blob(d, (0, 560, 460, 1080), PURPLE, 20)
    paint_blob(d, (330, 650, 800, 1180), PINK, -20)
    paint_blob(d, (650, 540, 1080, 1060), ORANGE, 12)
    paint_blob(d, (120, 850, 600, 1320), YELLOW, -8)
    d.ellipse((370, 510, 730, 870), fill=(255, 247, 225, 75), outline=CREAM, width=3)
    d.arc((80, 440, 1030, 1330), 208, 338, fill=YELLOW, width=9)

    # Clear header hierarchy, matching the other banners.
    d.text((54, 54), "ACCESSORIES / TODAY", font=F(18, True), fill=INK)
    d.multiline_text((54, 108), "The finishing\npieces", font=F(82, True), fill=CREAM, spacing=-5)
    d.multiline_text((58, 370), "Bags, shoes, jewelry, and the small\ndecisions that change the whole look.", font=F(24), fill=CREAM, spacing=7)

    # Sticker labels, arrows, and graphic marks inspired by Trending/New in/Deals.
    im.alpha_composite(tag("COMPLETE THE LOOK", YELLOW, angle=-5, size=(285, 62)), (54, 500))
    d.text((826, 500), "THE\nDETAILS", font=F(26, True), fill=CREAM, spacing=-2)
    arrow(d, [(835, 610), (780, 640), (746, 684)], CREAM, 7)
    arrow(d, [(160, 1085), (220, 1115), (275, 1100)], INK, 8)
    for x, y, c in [(920, 702, YELLOW), (95, 690, CREAM), (590, 575, PINK), (910, 1140, CREAM)]:
        d.line((x, y, x + 22, y - 34), fill=c, width=8)
        d.line((x + 26, y + 8, x + 58, y - 8), fill=c, width=8)

    # Each recognizable collage visual exits and returns on its own beat.
    for art, phase, cx, cy, angle, scale in visuals:
        a = cycle(t, phase)
        drift = math.sin(2 * math.pi * (t / 4 + phase))
        factor = scale[0] * (1 + .04 * drift)
        w, h = art.size
        piece = art.resize((round(w * factor), round(h * factor)), Image.Resampling.LANCZOS)
        piece = piece.rotate(angle + 2.5 * drift, expand=True, resample=Image.Resampling.BICUBIC)
        piece = alpha(piece, a)
        px, py = round(cx - piece.width / 2 + drift * 20), round(cy - piece.height / 2 - drift * 12)
        shadow = alpha(piece.filter(ImageFilter.GaussianBlur(18)), a * .18)
        im.alpha_composite(shadow, (px + 12, py + 20))
        im.alpha_composite(piece, (px, py))

    d.text((760, 1200), "A LITTLE\nEXTRA", font=F(24, True), fill=INK, spacing=-2)
    d.line((56, 1225, 1000, 1225), fill=(255, 246, 220, 150), width=2)
    d.text((56, 1250), "UVEL / TODAY", font=F(17, True), fill=CREAM)
    d.text((1000, 1250), "SWIPE TO SHOP  ›", font=F(17, True), fill=YELLOW, anchor="ra")
    im.convert("RGB").save(FRAMES / f"frame-{n:04d}.jpg", quality=94, optimize=True)

subprocess.run([
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-framerate", str(FPS),
    "-i", str(FRAMES / "frame-%04d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
    "-profile:v", "high", "-crf", "17", "-movflags", "+faststart", str(OUT)
], check=True)
print(OUT)
