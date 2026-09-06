from pathlib import Path
from PIL import Image

source = Path("/home/ubuntu/uvel/docs/app-store/uvel-app-store-listing-creative.png")
target = Path("/home/ubuntu/uvel/docs/app-store/uvel-app-store-listing-creative-1290x2796.png")
canvas_size = (1290, 2796)

with Image.open(source).convert("RGB") as image:
    scale = min(canvas_size[0] / image.width, canvas_size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", canvas_size, "#080805")
    offset = ((canvas.width - resized.width) // 2, (canvas.height - resized.height) // 2)
    canvas.paste(resized, offset)
    canvas.save(target, format="PNG", optimize=True)
    print(f"saved {target} at {canvas.size[0]}x{canvas.size[1]}")
