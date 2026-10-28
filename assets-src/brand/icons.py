"""Generate the favicon, apple-touch-icon and Open Graph image from the prism logo.

The pages referenced /favicon.png and /og-image.png, but neither file ever existed,
so browser tabs showed no icon and shared links had no preview. The geometry and
colours are the ones in src/components/PrismLogo.astro.

Run from the landing root:  python3 assets-src/brand/icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
FONTS = PUBLIC / "fonts"

BG = (10, 10, 15)
PURPLE = (139, 92, 246)
CYAN = (6, 182, 212)
GREEN = (16, 185, 129)
TEXT = (241, 241, 243)
TEXT_DIM = (156, 163, 175)

# PrismLogo.astro viewBox 0 0 200 180
TRIANGLES = [
    (PURPLE, [(100, 5), (50, 90), (150, 90)]),
    (CYAN, [(5, 175), (50, 90), (100, 175)]),
    (GREEN, [(195, 175), (150, 90), (100, 175)]),
]

SUPERSAMPLE = 4


def draw_prism(draw: ImageDraw.ImageDraw, x: float, y: float, width: float) -> None:
    """Draw the three-triangle prism with its top-left corner at (x, y)."""
    scale = width / 200
    for colour, points in TRIANGLES:
        draw.polygon([(x + px * scale, y + py * scale) for px, py in points], fill=colour)


def icon(size: int, background: bool) -> Image.Image:
    """Square prism icon; the touch icon needs an opaque background, the favicon does not."""
    big = size * SUPERSAMPLE
    img = Image.new("RGBA", (big, big), BG + (255,) if background else (0, 0, 0, 0))
    pad = big * (0.16 if background else 0.02)
    width = big - 2 * pad
    height = width * 0.9
    draw_prism(ImageDraw.Draw(img), pad, (big - height) / 2, width)
    return img.resize((size, size), Image.LANCZOS)


def og_image() -> Image.Image:
    """1200x630 link preview: prism on the left, the hero claim on the right."""
    w, h = 1200, 630
    big_w, big_h = w * SUPERSAMPLE, h * SUPERSAMPLE
    img = Image.new("RGB", (big_w, big_h), BG)

    glow = Image.new("RGB", (big_w, big_h), BG)
    ImageDraw.Draw(glow).ellipse(
        (int(big_w * 0.02), int(big_h * 0.05), int(big_w * 0.5), int(big_h * 0.95)), fill=(38, 24, 72)
    )
    img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(120 * SUPERSAMPLE // 2)), 1.0)

    draw = ImageDraw.Draw(img)
    s = SUPERSAMPLE
    draw_prism(draw, 110 * s, 175 * s, 300 * s)

    head = ImageFont.truetype(str(FONTS / "unbounded-900-latin.woff2"), 64 * s)
    sub = ImageFont.truetype(str(FONTS / "outfit-400.woff2"), 30 * s)
    brand = ImageFont.truetype(str(FONTS / "unbounded-700-latin.woff2"), 26 * s)

    left = 500 * s
    draw.text((left, 150 * s), "PRIZMA", font=brand, fill=TEXT_DIM)
    draw.text((left, 215 * s), "Eine Idee.", font=head, fill=TEXT)
    draw.text((left, 300 * s), "Alle Formen.", font=head, fill=PURPLE)
    draw.text((left, 410 * s), "Content-Produktion als Service", font=sub, fill=TEXT_DIM)
    draw.text((left, 452 * s), "für Online-Händler und Hersteller", font=sub, fill=TEXT_DIM)
    return img.resize((w, h), Image.LANCZOS)


def favicon_svg() -> str:
    polys = "".join(
        f'<polygon points="{" ".join(f"{px},{py}" for px, py in points)}" fill="#{c[0]:02X}{c[1]:02X}{c[2]:02X}"/>'
        for c, points in TRIANGLES
    )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 200 200">{polys}</svg>\n'


def main() -> None:
    icon(32, background=False).save(PUBLIC / "favicon.png", optimize=True)
    icon(180, background=True).convert("RGB").save(PUBLIC / "apple-touch-icon.png", optimize=True)
    (PUBLIC / "favicon.svg").write_text(favicon_svg())
    og_image().save(PUBLIC / "og-image.png", optimize=True)


if __name__ == "__main__":
    main()
