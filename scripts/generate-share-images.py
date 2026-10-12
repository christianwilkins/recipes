"""Generate committed PNG cards for Messages. Requires Pillow and two local font files.

python3 scripts/generate-share-images.py --serif /path/to/serif.ttf --sans /path/to/sans.ttf
No image generation or font downloads happen during deployment.
"""
import argparse
import json
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

def wrap(draw, text, font, width):
    lines = []
    for word in text.split():
        if lines and draw.textlength(lines[-1] + ' ' + word, font=font) <= width:
            lines[-1] += ' ' + word
        else:
            lines.append(word)
    return lines

def card(filename, title, category, detail):
    image = Image.new('RGB', (1200, 630), '#f3f3f3')
    draw = ImageDraw.Draw(image)
    sans = ImageFont.truetype(args.sans, 28)
    small = ImageFont.truetype(args.sans, 25)
    draw.text((72, 49), 'CHRISTIAN WILKINS  /  RECIPES', font=small, fill='#505050')
    draw.line((72, 106, 1128, 106), fill='#cccccc', width=2)
    draw.text((72, 134), category.upper(), font=small, fill='#777777')
    for size in range(76, 37, -2):
        serif = ImageFont.truetype(args.serif, size)
        lines = wrap(draw, title, serif, 1056)
        if len(lines) <= 3:
            break
    y = 185
    for line in lines:
        draw.text((69, y), line, font=serif, fill='#171717')
        y += size + 9
    details = wrap(draw, detail, sans, 1056)
    draw.text((72, 475), details[0] if details else '', font=sans, fill='#505050')
    draw.line((72, 538, 1128, 538), fill='#cccccc', width=2)
    draw.text((72, 560), 'recipes.chriswiki.com', font=small, fill='#505050')
    draw.text((811, 560), 'Make it your own.', font=small, fill='#505050')
    image.save(out / f'{filename}.png', optimize=True)

card('recipes', 'Good things to make', 'The recipe notebook', 'Pick a flavor. Scale a batch. Make it your own.')
for recipe in recipes:
    card(recipe['slug'], recipe['title'], recipe.get('category', 'Recipe'),
         f"{len(recipe['variants'])} flavors and variations" if recipe.get('variants') else recipe['servings'])
    for variant in recipe.get('variants', []):
        card(f"{recipe['slug']}-{variant['id']}", variant['label'], recipe['title'], variant.get('servings', recipe['servings']))
print(f'Generated {1 + len(recipes) + sum(len(r.get("variants", [])) for r in recipes)} share images.')
