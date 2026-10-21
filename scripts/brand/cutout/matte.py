"""Clean matte for character poses drawn on the cream background.

Removes every cream pixel (also the ones trapped inside curl loops, which a
flood fill from the border never reaches) and un-mixes the soft edge pixels
against the cream, so no light halo shows on ink backgrounds.

usage: python matte.py <in.png> <out.png>
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

CREAM = np.array([250, 248, 234], float)
T_BG, T_EDGE = 45, 170   # L1 distance from cream: below = background, below T_EDGE = maybe mixed

src, dst = sys.argv[1], sys.argv[2]
a = np.array(Image.open(src).convert('RGBA')).astype(float)
rgb, al = a[..., :3], a[..., 3] / 255
H, W = al.shape

d = np.abs(rgb - CREAM).sum(-1)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
# eye white is neutral (blue as high as red); cream is warm (blue ~15 lower)
eye_white = (r > 232) & (g > 232) & (b > 232) & (b >= r - 6)

# beige floor shadows under the feet: light, warm, low-saturation (pink has g far below r)
low = np.zeros((H, W), bool); low[int(H * 0.7):] = True   # shadows only sit under the feet
shadow = low & (rgb.mean(-1) > 165) & (r - g < 28) & (g - b > -4) & (r - b > 10) & ~eye_white
cand = ((d < T_BG) & ~eye_white) | shadow | (al == 0)

# label cream regions; keep the ones that are part of the drawing
# (phone screens, specks inside the eyes), drop the outside and the holes in curl loops
from collections import deque
lab = np.full((H, W), -1, np.int32)
bg = np.zeros((H, W), bool)
lum = rgb.mean(-1)
for sy, sx in zip(*np.nonzero(cand)):
    if lab[sy, sx] != -1:
        continue
    q = deque([(sy, sx)]); lab[sy, sx] = 1; px = []; ring = []; outside = False
    while q:
        y, x = q.popleft(); px.append((y, x))
        if al[y, x] == 0 or y in (0, H - 1) or x in (0, W - 1):
            outside = True
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and lab[ny, nx] == -1:
                if cand[ny, nx]:
                    lab[ny, nx] = 1; q.append((ny, nx))
                else:
                    ring.append(lum[ny, nx])
    drop = outside or (len(px) < 3000 and (not ring or np.mean(ring) < 215))
    if drop:
        ys_, xs_ = zip(*px); bg[ys_, xs_] = True
al = np.where(bg, 0, al)
solid = (al > 0.99) & (d >= T_EDGE)

# pixels near the background that look partly cream: un-mix them
near_bg = np.array(Image.fromarray((al < 0.5).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
mixed = near_bg & (al > 0) & ~solid & ~eye_white

# foreground estimate: the most "uncream" pixel in a 7x7 window
R = 3
pad_d = np.pad(np.where(al > 0, d, -1), R, constant_values=-1)
pad_rgb = np.pad(rgb, ((R, R), (R, R), (0, 0)), mode='edge')
ys, xs = np.nonzero(mixed)
out_rgb, out_al = rgb.copy(), al.copy()
for y, x in zip(ys, xs):
    win = pad_d[y:y + 2 * R + 1, x:x + 2 * R + 1]
    k = np.argmax(win)
    wy, wx = divmod(k, 2 * R + 1)
    f = pad_rgb[y + wy, x + wx]
    fb = f - CREAM
    den = (fb * fb).sum()
    if den < 1:
        continue
    t = np.clip(((rgb[y, x] - CREAM) * fb).sum() / den, 0, 1)
    out_al[y, x] = min(al[y, x], t)
    out_rgb[y, x] = f

# light 0.6px smoothing of the alpha edge only (no jaggies), keep interiors crisp
A = Image.fromarray(np.clip(out_al * 255, 0, 255).astype(np.uint8))
As = np.array(A.filter(ImageFilter.GaussianBlur(0.6))).astype(float) / 255
edge = np.array(A.filter(ImageFilter.FIND_EDGES)) > 0
edge = np.array(Image.fromarray(edge.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))) > 0
final_al = np.where(edge, As, out_al)
final_al = np.where(final_al < 0.04, 0, final_al)

o = np.dstack([out_rgb, final_al * 255]).clip(0, 255).astype(np.uint8)
im = Image.fromarray(o, 'RGBA')
im = im.crop(im.getbbox())
im.save(dst)
print(dst, im.size, 'bg removed', int(bg.sum()), 'unmixed', len(ys))
