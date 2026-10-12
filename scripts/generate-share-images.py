"""Generate committed PNG cards for Messages. Requires Pillow and two local font files.

python3 scripts/generate-share-images.py --serif /path/to/serif.ttf --sans /path/to/sans.ttf
No image generation or font downloads happen during deployment.
"""
import argparse
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('--serif', required=True)
parser.add_argument('--sans', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
out = root / 'public' / 'social'
out.mkdir(parents=True, exist_ok=True)
recipes = json.loads((root / 'data' / 'recipes.json').read_text())
dark = (root / 'public' / 'style.css').read_text().split('@media(prefers-color-scheme:dark)')[1].split('}}')[0]

def color(name):
    lightness = float(re.search(r'--' + name + r':oklch\(([\d.]+) 0 0\)', dark).group(1))
    linear = lightness ** 3
    channel = round(255 * (12.92 * linear if linear <= .0031308 else 1.055 * linear ** (1 / 2.4) - .055))
    return (channel,) * 3

def font(path, size, weight=400):
    result = ImageFont.truetype(path, size)
    try:
        axes = result.get_variation_axes()
        result.set_variation_by_axes([
            weight if axis['name'] == b'Weight' else min(size, axis['maximum']) if axis['name'] == b'Optical Size' else axis['default']
            for axis in axes
        ])
    except OSError:
        pass  # Static font files are also supported.
    return result

def wrap(draw, text, font, width):
    lines = []
    for word in text.split():
        if lines and draw.textlength(lines[-1] + ' ' + word, font=font) <= width:
            lines[-1] += ' ' + word
        else:
            lines.append(word)
    return lines

def card(filename, title, category, detail):
    image = Image.new('RGB', (1200, 630), color('bg'))
    draw = ImageDraw.Draw(image)
    sans = font(args.sans, 28)
    small = font(args.sans, 25)
    brand = font(args.serif, 40, 700)
    draw.text((72, 40), 'Christian Wilkins', font=brand, fill=color('fg'))
    brand_width = draw.textlength('Christian Wilkins', font=brand)
    draw.text((72 + brand_width + 36, 40), 'Recipes', font=font(args.serif, 40), fill=color('fg'))
    draw.line((72, 106, 1128, 106), fill=color('line'), width=2)
    draw.text((72, 134), category.upper(), font=small, fill=color('muted'))
    for size in range(76, 37, -2):
        serif = font(args.serif, size, 700)
        lines = wrap(draw, title, serif, 1056)
        if len(lines) <= 3:
            break
    y = 185
    for line in lines:
        draw.text((69, y), line, font=serif, fill=color('fg'))
        y += size + 9
    details = wrap(draw, detail, sans, 1056)
    draw.text((72, 475), details[0] if details else '', font=sans, fill=color('muted'))
    draw.line((72, 538, 1128, 538), fill=color('line'), width=2)
    draw.text((72, 560), 'recipes.chriswiki.com', font=small, fill=color('muted'))
    draw.text((811, 560), 'Make it your own.', font=small, fill=color('muted'))
    image.save(out / f'{filename}.png', optimize=True)

card('recipes', 'Good things to make', 'The recipe notebook', 'Pick a flavor. Scale a batch. Make it your own.')
for recipe in recipes:
    card(recipe['slug'], recipe['title'], recipe.get('category', 'Recipe'),
         f"{len(recipe['variants'])} flavors and variations" if recipe.get('variants') else recipe['servings'])
    for variant in recipe.get('variants', []):
        card(f"{recipe['slug']}-{variant['id']}", variant['label'], recipe['title'], variant.get('servings', recipe['servings']))
print(f'Generated {1 + len(recipes) + sum(len(r.get("variants", [])) for r in recipes)} share images.')
