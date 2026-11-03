"""Square cliff tiles for Ant Wars Square (44x44 pixel art, drawn at 2x).

A cliff is raised ground: a pale, see-through plateau with a sheer rock face
on three sides and a ramp on the fourth. Writes public/sprites/terrain/
cliff_n.png, cliff_e.png, cliff_s.png and cliff_w.png (named by the side the
ramp faces). Same colours as the hex game's cliff art.

Run: python3 gen/square_cliffs.py
"""
import random
from PIL import Image

S = 44
TOP = (176, 162, 132, 185)      # plateau, lets a little ground show through
SPECK = (120, 108, 90, 220)
RIM = (188, 172, 140, 255)      # lit lip along the top of a face
RAMP = (214, 196, 150, 220)     # pale slope down the ramp side
RAMP_EDGE = (180, 162, 136, 255)
FACE_DARK = (40, 30, 24, 255)
FACE = (58, 46, 36, 255)
FACE_MID = (78, 64, 52, 255)
BRICK = (112, 96, 78, 255)
BRICK_LIT = (150, 132, 106, 255)
SHADOW = (60, 46, 34, 150)

FRONT = 11  # height of the south (front) face, seen head-on
SIDE = 5    # width of an east / west face
BACK = 3    # the north face is seen from above: just a thin rim


def bricks(img, x0, y0, w, h, rows=3):
    """Rough stone courses inside a face, offset every other row."""
    rng = random.Random(7)
    row_h = max(2, h // rows)
    for i, y in enumerate(range(y0, y0 + h, row_h)):
        x = x0 + (i % 2) * 3
        while x < x0 + w:
            bw = rng.choice([4, 5, 6])
            for yy in range(y + 1, min(y + row_h, y0 + h)):
                for xx in range(x + 1, min(x + bw, x0 + w)):
                    img.putpixel((xx, yy), BRICK if yy < y + row_h - 1 else BRICK_LIT)
            x += bw


def make(ramp):
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    faces = {'n', 'e', 's', 'w'} - {ramp}
    # plateau bounds (the faces sit outside it)
    left = SIDE if 'w' in faces else 0
    right = S - (SIDE if 'e' in faces else 0)
    top = BACK if 'n' in faces else 0
    bottom = S - (FRONT if 's' in faces else 0)

    rng = random.Random(3)
    for y in range(top, bottom):
        for x in range(left, right):
            img.putpixel((x, y), SPECK if rng.random() < 0.06 else TOP)

    # north rim: the back face, seen from above
    if 'n' in faces:
        for x in range(S):
            for y in range(BACK):
                img.putpixel((x, y), FACE_DARK if y == 0 else FACE)
            img.putpixel((x, BACK), RIM)
    # side faces
    for side in ('w', 'e'):
        if side not in faces:
            continue
        xs = range(0, SIDE) if side == 'w' else range(S - SIDE, S)
        for x in xs:
            edge = x == 0 or x == S - 1
            for y in range(top, S):
                img.putpixel((x, y), FACE_DARK if edge else (FACE_MID if (y // 3) % 2 else FACE))
        lip = SIDE if side == 'w' else S - SIDE - 1
        for y in range(top + 1, bottom):
            img.putpixel((lip, y), RIM)
    # front face: tall stone wall
    if 's' in faces:
        for y in range(bottom, S):
            for x in range(left, right):
                img.putpixel((x, y), FACE_DARK if y == S - 1 else FACE)
        bricks(img, left, bottom + 1, right - left, FRONT - 2)
        for x in range(left, right):
            img.putpixel((x, bottom), RIM)
            img.putpixel((x, bottom - 1), SHADOW)
    # ramp: a pale slope band on the open side
    band = 5
    if ramp == 'n':
        cells = [(x, y) for y in range(0, band) for x in range(left, right)]
    elif ramp == 's':
        cells = [(x, y) for y in range(S - band, S) for x in range(left, right)]
    elif ramp == 'w':
        cells = [(x, y) for x in range(0, band) for y in range(top, bottom)]
    else:
        cells = [(x, y) for x in range(S - band, S) for y in range(top, bottom)]
    for x, y in cells:
        stripe = (x + y) % 4 == 0
        img.putpixel((x, y), RAMP_EDGE if stripe else RAMP)
    return img


if __name__ == '__main__':
    import os
    out = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'terrain')
    for ramp in 'nesw':
        make(ramp).save(os.path.join(out, f'cliff_{ramp}.png'))
    print('wrote cliff_n/e/s/w.png')
