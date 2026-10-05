from __future__ import annotations

import math
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/today/finishing-pieces-loop.mp4"
FRAMES = ROOT / ".tmp-finishing-pieces-frames"
FRAMES.mkdir(exist_ok=True)
W, H, FPS, SECONDS = 1056, 1308, 24, 8
BG = (31, 177, 165, 255)
INK = (20, 57, 68, 255)
CREAM = (255, 247, 225, 255)
PINK = (244, 73, 139, 255)
ORANGE = (255, 143, 49, 255)
PURPLE = (126, 91, 232, 255)
YELLOW = (229, 247, 87, 255)
BLUE = (47, 119, 239, 255)


def F(size, bold=False):
    p = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(p, size)


def pulse(t, phase=0.0):
    # Fully cyclical disappear / reappear motion, with each element on a different beat.
    x = (t / 4.0 + phase) % 1.0
    return max(0.0, min(1.0, (0.5 + 0.5 * math.cos(2 * math.pi * x) - 0.10) / 0.90))


def layer_alpha(im, a):
    im = im.copy()
    im.putalpha(im.getchannel("A").point(lambda p: round(p * a)))
    return im


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def star(draw, cx, cy, r1, r2, fill, points=8, rotation=0):
    pts = []
    for i in range(points * 2):
        a = rotation + math.pi * i / points
        r = r1 if i % 2 == 0 else r2
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    draw.polygon(pts, fill=fill)


def ribbon(size, color, angle, label):
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rounded(d, (0, 0, size[0] - 1, size[1] - 1), 28, color)
    d.line((22, size[1] // 2, size[0] - 22, size[1] // 2), fill=CREAM, width=3)
    d.text((size[0] // 2, size[1] // 2 - 2), label, font=F(18, True), fill=INK, anchor="mm")
    return im.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)


def icon_disc(d, cx, cy, r, color, kind, t):
    d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=color, outline=CREAM, width=5)
    if kind == 0:  # abstract bag
        d.rounded_rectangle((cx-r*0.48, cy-r*0.18, cx+r*0.48, cy+r*0.45), radius=13, fill=INK)
        d.arc((cx-r*0.32, cy-r*0.55, cx+r*0.32, cy+r*0.05), 180, 360, fill=INK, width=9)
    elif kind == 1:  # abstract shoe
        d.ellipse((cx-r*0.48, cy-r*0.05, cx+r*0.50, cy+r*0.30), fill=INK)
        d.polygon([(cx-r*0.40, cy+r*0.07), (cx-r*0.18, cy-r*0.43), (cx+r*0.12, cy-r*0.10), (cx+r*0.50, cy+r*0.16), (cx+r*0.42, cy+r*0.30), (cx-r*0.42, cy+r*0.30)], fill=INK)
    elif kind == 2:  # jewelry
        d.ellipse((cx-r*0.42, cy-r*0.42, cx+r*0.42, cy+r*0.42), outline=INK, width=12)
        d.ellipse((cx-r*0.12, cy-r*0.12, cx+r*0.12, cy+r*0.12), fill=INK)
    else:  # sparkle
        star(d, cx, cy, r*0.50, r*0.13, INK, points=6, rotation=t)


for n in range(FPS * SECONDS):
    t = n / FPS
    im = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(im)

    # Playful color fields behind the collage.
    d.ellipse((-250 + math.sin(t * 0.8) * 40, 510, 380 + math.sin(t * 0.8) * 40, 1140), fill=PURPLE)
    d.ellipse((645 + math.cos(t * 0.65) * 35, 510, 1200 + math.cos(t * 0.65) * 35, 1080), fill=ORANGE)
    d.ellipse((230, 805 + math.sin(t * 0.7) * 28, 860, 1450 + math.sin(t * 0.7) * 28), fill=PINK)
    d.arc((-140, 320, 1190, 1350), 204, 335, fill=YELLOW, width=10)
    d.arc((30, 470, 1040, 1380), 204, 335, fill=CREAM, width=4)

    # Header remains simple and high-contrast for readability in the real card.
    d.text((54, 58), "THE EDIT / ACCESSORIES", font=F(18, True), fill=INK)
    d.multiline_text((54, 112), "The finishing\npieces", font=F(82, True), fill=CREAM, spacing=-5)
    d.multiline_text((58, 370), "Bags, shoes, jewelry, and the small\ndecisions that change the whole look.", font=F(24), fill=CREAM, spacing=7)

    # Small neon label gives the card an editorial campaign feel.
    label = ribbon((260, 54), YELLOW, -5 + 2 * math.sin(t), "MAKE IT YOURS  →")
    im.alpha_composite(label, (50, 500))

    # Four visual “finishing” elements cycle independently and completely vanish/reappear.
    specs = [
        (0.00, 152, 735, 118, PINK, 0),
        (0.25, 490, 650, 150, YELLOW, 1),
        (0.50, 760, 790, 112, BLUE, 2),
        (0.75, 455, 940, 132, CREAM, 3),
    ]
    for phase, cx, cy, r, color, kind in specs:
        a = pulse(t, phase)
        drift = math.sin(2 * math.pi * (t / 4 + phase))
        disc = Image.new("RGBA", (r * 2 + 30, r * 2 + 30), (0, 0, 0, 0))
        dd = ImageDraw.Draw(disc)
        icon_disc(dd, r + 15, r + 15, r, color, kind, t + phase)
        disc = disc.rotate(8 * drift, expand=True, resample=Image.Resampling.BICUBIC)
        disc = layer_alpha(disc, a)
        x = round(cx - disc.width / 2 + drift * 16)
        y = round(cy - disc.height / 2 - drift * 11)
        shadow = layer_alpha(disc.filter(ImageFilter.GaussianBlur(16)), a * 0.24)
        im.alpha_composite(shadow, (x + 12, y + 18))
        im.alpha_composite(disc, (x, y))

    # A few quick graphic beats add energy without competing with the title.
    for i, (x, y, c, ph) in enumerate([(880, 475, YELLOW, .15), (212, 1190, CREAM, .38), (820, 1110, PINK, .63), (330, 640, BLUE, .86)]):
        a = pulse(t, ph)
        s = 22 + 9 * math.sin(2 * math.pi * (t / 4 + ph))
        sparkle = Image.new("RGBA", (90, 90), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sparkle)
        star(sd, 45, 45, s, s * .18, c, points=4, rotation=math.pi / 4)
        sparkle = layer_alpha(sparkle, a)
        im.alpha_composite(sparkle, (x - 45, y - 45))

    # Stable footer creates a clear destination cue.
    d.line((56, 1222, 1000, 1222), fill=(255, 247, 225, 155), width=2)
    d.text((56, 1247), "UVEL / TODAY", font=F(17, True), fill=CREAM)
    d.text((1000, 1247), "SWIPE TO SHOP  ›", font=F(17, True), fill=YELLOW, anchor="ra")
    im.convert("RGB").save(FRAMES / f"frame-{n:04d}.jpg", quality=94, optimize=True)

subprocess.run([
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-framerate", str(FPS),
    "-i", str(FRAMES / "frame-%04d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
    "-profile:v", "high", "-crf", "17", "-movflags", "+faststart", str(OUT)
], check=True)
print(OUT)
