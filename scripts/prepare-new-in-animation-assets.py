from pathlib import Path

import cv2
import numpy as np
from PIL import Image

SOURCE = Path(__file__).resolve().parents[1] / "assets/today/new-in-option3.png"
OUT = SOURCE.parent / "new-in-animated"
OUT.mkdir(exist_ok=True)

image = cv2.imread(str(SOURCE), cv2.IMREAD_COLOR)
h, w = image.shape[:2]

# The poster's background is a nearly uniform Uvel blue. The layer masks below
# are deliberately limited to the requested accent regions so product cutouts,
# typography, and the original framing remain untouched.
def poster_mask(x0, y0, x1, y1, mode):
    crop = image[y0:y1, x0:x1]
    b, g, r = cv2.split(crop)
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    hue, saturation, value = cv2.split(hsv)
    if mode == "sticker":
        # Everything that is not the blue poster field belongs to the sticker
        # or its doodles in this top-right region.
        blue_distance = np.sqrt((b.astype(float) - 230) ** 2 + (g.astype(float) - 90) ** 2 + r.astype(float) ** 2)
        raw = (blue_distance > 38).astype(np.uint8) * 255
    else:
        lime = ((hue >= 24) & (hue <= 48) & (saturation > 75) & (value > 120)).astype(np.uint8)
        pink = ((hue >= 145) & (hue <= 175) & (saturation > 75) & (value > 120)).astype(np.uint8)
        white = np.zeros_like(lime)
        if mode == "arrows":
            white = ((r > 205) & (g > 205) & (b > 205) & ((np.maximum.reduce([r, g, b]) - np.minimum.reduce([r, g, b])) < 48)).astype(np.uint8)
        raw = ((lime | pink | white) * 255).astype(np.uint8)

    # Fill holes inside letters and sticker shapes while retaining separate
    # arrows/lines as individual external components.
    contours, _ = cv2.findContours(raw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(raw)
    for contour in contours:
        area = cv2.contourArea(contour)
        if area >= 6:
            cv2.drawContours(filled, [contour], -1, 255, thickness=cv2.FILLED)
    # Include antialiased fringes without touching nearby product pixels.
    filled = cv2.dilate(filled, np.ones((3, 3), np.uint8), iterations=1)
    mask = np.zeros((h, w), dtype=np.uint8)
    mask[y0:y1, x0:x1] = filled
    return mask

# Separate layers: the sticker moves vertically; the lower callouts move with
# a subtle independent wobble; edge doodles share the lower accent layer.
sticker = poster_mask(455, 12, 690, 270, "sticker")
lower_left = cv2.bitwise_or(poster_mask(20, 630, 230, 822, "accents"), poster_mask(75, 760, 225, 822, "arrows"))
lower_right = cv2.bitwise_or(
    cv2.bitwise_or(poster_mask(560, 490, 696, 575, "accents"), poster_mask(610, 770, 696, 822, "accents")),
    poster_mask(595, 590, 696, 770, "arrows"),
)
edge_left = poster_mask(0, 250, 250, 822, "accents")
edge_right = poster_mask(585, 270, 696, 822, "accents")

layers = {
    "latest-sticker": sticker,
    "just-landed": lower_left,
    "today-callouts": lower_right,
    "edge-left": edge_left,
    "edge-right": edge_right,
}
all_mask = np.zeros((h, w), dtype=np.uint8)
for name, mask in layers.items():
    all_mask = cv2.bitwise_or(all_mask, mask)
    rgba = cv2.cvtColor(image, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = mask
    Image.fromarray(rgba).save(OUT / f"{name}.png", optimize=True)

# Repair only the pixels occupied by the moving accents. Each region samples a
# same-row poster-blue pixel outside the artwork, avoiding blur or invented
# texture and leaving every product and wordmark pixel from the source intact.
repaired = image.copy()
row_samples = {
    "latest-sticker": 410,
    "just-landed": 8,
    "today-callouts": 690,
    "edge-left": 8,
    "edge-right": None,
}
for name, mask in layers.items():
    sample_x = row_samples[name]
    for y in range(h):
        row = mask[y] > 0
        if np.any(row):
            repaired[y, row] = image[y, sample_x] if sample_x is not None else np.array([230, 90, 0], dtype=np.uint8)
base = cv2.cvtColor(repaired, cv2.COLOR_BGR2RGBA)
base[:, :, 3] = 255
Image.fromarray(base).save(OUT / "base.png", optimize=True)

print(f"source={SOURCE} size={w}x{h}")
for name, mask in layers.items():
    print(f"{name}: {int(np.count_nonzero(mask))} alpha pixels")
print(f"output={OUT}")
