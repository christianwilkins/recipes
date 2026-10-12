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

def card(filename, title):
    image = Image.new('RGB', (1200, 630), color('bg'))
    draw = ImageDraw.Draw(image)
    for size in range(92, 47, -2):
        serif = font(args.serif, size, 700)
        lines = wrap(draw, title, serif, 1056)
        if len(lines) <= 3:
            break
    y = (550 - len(lines) * (size + 8)) / 2
    for line in lines:
        draw.text((72, y), line, font=serif, fill=color('fg'), anchor='lt')
        y += size + 8
    draw.text((72, 550), 'recipes.chriswiki.com', font=font(args.sans, 28), fill=color('muted'), anchor='lt')
    image.save(out / f'{filename}.png', optimize=True)

card('recipes', 'Recipes')
for recipe in recipes:
    title = 'Quesadillas' if recipe['slug'] == 'quesadillas' else recipe['title']
    card(recipe['slug'], title)
    for variant in recipe.get('variants', []):
        title = variant['label']
        if recipe['slug'] == 'quesadillas':
            title += ' quesadillas'
        elif recipe['slug'] == 'protein-overnight-oats':
            title = 'Overnight oats' if variant['id'] == 'plain' else title + ' oats'
        elif recipe['slug'] == 'greek-yogurt-pudding':
            title = title.replace('Protein ', '').replace('protein ', '').removesuffix(' bowl') + ' yogurt'
        elif recipe['slug'] == 'cuban-style-black-beans':
            title = 'Cuban-style black beans'
        card(f"{recipe['slug']}-{variant['id']}", title)
print(f'Generated {1 + len(recipes) + sum(len(r.get("variants", [])) for r in recipes)} share images.')
