#!/usr/bin/env python3
"""Generate og-image.png — a 1200x630 social card matching the essay's aesthetic."""
from PIL import Image, ImageDraw, ImageFont
import math

W, H = 1200, 630

# Palette — matches the essay
BG       = (251, 247, 238)   # warm paper
PAPER    = (254, 252, 246)
INK      = (42, 37, 32)
INK_SOFT = (107, 95, 85)
PREY     = (46, 139, 87)     # bluish green
PRED     = (213, 94, 0)      # vermillion
TICK     = (230, 159, 0)     # amber
RULE     = (216, 205, 186)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# Subtle inner paper panel with border
margin = 32
d.rectangle([margin, margin, W - margin, H - margin], fill=PAPER, outline=RULE, width=2)

# --- Fonts ---
def load(paths, size):
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()

serif_bold = load([
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
], 78)
serif_bold_sm = load([
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
], 40)
serif_italic = load([
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf",
], 30)
mono = load([
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
], 22)

# --- Eyebrow / kicker (monospace, letterspaced) ---
kicker = "A N   I N T E R A C T I V E   E S S A Y"
d.text((72, 78), kicker, font=mono, fill=INK_SOFT)

# --- Title (two lines) ---
d.text((70, 130), "The Tick, the Coyote,", font=serif_bold, fill=INK)
d.text((70, 218), "and the Deer", font=serif_bold, fill=INK)

# --- Subtitle (italic) ---
sub1 = "What happens to a herd when its predator"
sub2 = "can no longer eat it."
d.text((72, 322), sub1, font=serif_italic, fill=INK_SOFT)
d.text((72, 360), sub2, font=serif_italic, fill=INK_SOFT)

# --- Predator-prey curve motif (bottom band) ---
# A stylized Lotka-Volterra oscillation: prey green, predator vermillion
plot_x0, plot_x1 = 72, W - 72
plot_y0, plot_y1 = 452, 556
baseline = plot_y1

# faint baseline
d.line([(plot_x0, baseline), (plot_x1, baseline)], fill=RULE, width=2)

def curve(phase, amp, color, width):
    pts = []
    span = plot_x1 - plot_x0
    for i in range(0, span + 1, 3):
        t = i / span
        # damped-free LV-ish wave
        y = baseline - amp * (0.5 + 0.5 * math.sin(2 * math.pi * 2.2 * t + phase))
        pts.append((plot_x0 + i, y))
    d.line(pts, fill=color, width=width, joint="curve")

curve(phase=0.0, amp=86, color=PREY, width=6)
curve(phase=1.5, amp=64, color=PRED, width=6)

# --- Tick bloom marker — a vertical amber line + dot, ~62% across ---
bx = plot_x0 + int((plot_x1 - plot_x0) * 0.62)
d.line([(bx, plot_y0 - 4), (bx, baseline)], fill=TICK, width=4)
r = 12
d.ellipse([bx - r, plot_y0 - 4 - r, bx + r, plot_y0 - 4 + r], fill=TICK)

# --- Small legend dots above the curve band ---
ly = 408
for label_x, color in [(72, PREY), (210, PRED), (360, TICK)]:
    d.ellipse([label_x, ly, label_x + 14, ly + 14], fill=color)
d.text((94, ly - 4), "deer", font=mono, fill=INK_SOFT)
d.text((232, ly - 4), "predator", font=mono, fill=INK_SOFT)
d.text((382, ly - 4), "tick bloom", font=mono, fill=INK_SOFT)

# --- URL footer — right-aligned in the kicker row, clear of the curves ---
url = "ultimape.github.io/alpha-gal-ecology"
ubox = d.textbbox((0, 0), url, font=mono)
uw = ubox[2] - ubox[0]
d.text((W - 72 - uw, 78), url, font=mono, fill=INK_SOFT)

img.save("og-image.png", "PNG")
print(f"Wrote og-image.png ({W}x{H})")
