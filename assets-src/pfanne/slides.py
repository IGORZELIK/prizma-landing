"""Карусель (5 слайдов) и пост 4:5 для примера производителя: фото из kie.py, текст кодом, без бренда и цены.
Стиль производителя: тёмное фото, затемнение снизу, заголовок Georgia, медная акцентная линия."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1350
SERIF = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
SANS = "/System/Library/Fonts/Helvetica.ttc"
COPPER = (205, 127, 70, 255)
head, body, small = ImageFont.truetype(SERIF, 76), ImageFont.truetype(SANS, 36), ImageFont.truetype(SANS, 28)

SLIDES = [
    ("c1", "Gusseisen,\ndas bleibt.", "Grillpfanne aus einem Guss.", "Wisch weiter"),
    ("c2", "Speichert Hitze.", "Einmal heiß, bleibt sie heiß,\nauch wenn das Steak kalt reinkommt.", None),
    ("c3", "Grillstreifen\nwie vom Rost.", "Die Rippen zeichnen das Muster,\ndas Fett läuft ab.", None),
    ("c4", "Vom Herd\nin den Ofen.", "Ohne Beschichtung, ohne Kunststoff.\nHält jede Temperatur aus.", None),
    ("c5", "Pflege in\neiner Minute.", "Auswaschen, trocknen, dünn einölen.\nMit jedem Mal wird sie besser.", None),
]
POST = ("img3", "Grillabend,\nauch wenn es regnet.", "Gusseisen-Grillpfanne für den Herd.", None)


def render(src: str, title: str, sub: str, cta: str | None, out: str, counter: str | None) -> None:
    im = Image.open(f"{src}.png").convert("RGB")
    s = W / im.width
    im = im.resize((W, round(im.height * s)), Image.LANCZOS)
    top = max(0, min(im.height - H, round((im.height - H) * 0.45)))
    im = im.crop((0, top, W, top + H)).convert("RGBA")
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    t_lines, s_lines = title.split("\n"), sub.split("\n")
    block = len(t_lines) * 88 + 40 + len(s_lines) * 48 + (70 if cta else 0)
    y0 = H - block - 90
    g0 = y0 - 200
    for yy in range(g0, H):
        d.line([(0, yy), (W, yy)], fill=(8, 6, 5, int(215 * min(1, (yy - g0) / 260))))
    if counter:
        d.text((W - 80 - d.textlength(counter, font=small), 64), counter, font=small, fill=(255, 255, 255, 200))
    x, y = 80, y0
    d.rectangle([x, y - 34, x + 64, y - 28], fill=COPPER)
    for ln in t_lines:
        d.text((x, y), ln, font=head, fill=(255, 255, 255, 255))
        y += 88
    y += 30
    for ln in s_lines:
        d.text((x, y), ln, font=body, fill=(255, 255, 255, 215))
        y += 48
    if cta:
        d.text((x, y + 28), cta, font=small, fill=COPPER)
        # Стрелка линиями: в Helvetica нет глифа →
        ax, ay = x + d.textlength(cta, font=small) + 18, y + 28 + small.size // 2 + 2
        d.line([(ax, ay), (ax + 34, ay)], fill=COPPER, width=3)
        d.line([(ax + 24, ay - 9), (ax + 34, ay), (ax + 24, ay + 9)], fill=COPPER, width=3)
    Image.alpha_composite(im, ov).convert("RGB").save(out, quality=92)


for i, (src, t, s, c) in enumerate(SLIDES, 1):
    render(src, t, s, c, f"slide-{i}.jpg", f"{i}/{len(SLIDES)}")
render(*POST, "post.jpg", None)
