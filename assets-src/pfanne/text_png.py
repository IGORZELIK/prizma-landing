"""Плашка финала без цены и бренда: заголовок и строка товара над затемнением. python3 -I text_png.py W H"""
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = int(sys.argv[1]), int(sys.argv[2])
F = "/System/Library/Fonts/Helvetica.ttc"
k = W / 720
big, small = ImageFont.truetype(F, int(60 * k), index=1), ImageFont.truetype(F, int(30 * k), index=0)
top = H - (big.size * 2 + 28 + small.size) - int(90 * k)
im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
g0 = top - int(80 * k)
for yy in range(g0, H):
    d.line([(0, yy), (W, yy)], fill=(0, 0, 0, int(175 * min(1, (yy - g0) / (120 * k)))))
y = top
for txt, f, c in (("Grillstreifen", big, (255, 255, 255, 255)), ("wie vom Rost.", big, (255, 255, 255, 255)),
                  ("Gusseisen-Grillpfanne", small, (255, 255, 255, 210))):
    if f is small:
        y += 14
    d.text(((W - d.textlength(txt, font=f)) / 2, y), txt, font=f, fill=c)
    y += f.size + 14
im.save(f"t_{W}x{H}.png")
