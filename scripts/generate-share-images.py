"""Render all share cards from the shared manifest. Run npm run share:images."""
import hashlib
import itertools
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent


def font(path, size, weight=400):
    result = ImageFont.truetype(str(path), size)
    try:
        result.set_variation_by_axes([
            weight if axis['name'] == b'Weight' else min(size, axis['maximum']) if axis['name'] == b'Optical Size' else axis['default']
            for axis in result.get_variation_axes()
        ])
    except OSError:
        pass
    return result


def balanced_lines(draw, text, face, width, max_lines):
    """Choose legal word boundaries with similar line widths; never crop words."""
    words = text.split()
    for count in range(1, min(max_lines, len(words)) + 1):
        choices = []
        for breaks in itertools.combinations(range(1, len(words)), count - 1):
            bounds = (0, *breaks, len(words))
            lines = [' '.join(words[a:b]) for a, b in zip(bounds, bounds[1:])]
            boxes = [draw.textbbox((0, 0), line, font=face, anchor='lt') for line in lines]
            widths = [box[2] - box[0] for box in boxes]
            if max(widths) <= width:
                choices.append((max(widths) - min(widths), lines))
        if choices:
            return min(choices, key=lambda item: item[0])[1]
    return None


def render_card(title, template):
    image = Image.new('RGB', (template['width'], template['height']), tuple(template['colors']['bg']))
    draw = ImageDraw.Draw(image)
    padding = template['padding']
    for size in range(template['titleMaxSize'], template['titleMinSize'] - 1, -2):
        face = font(ROOT / template['serif'], size, 700)
        lines = balanced_lines(draw, title, face, template['width'] - 2 * padding, template['titleMaxLines'])
        if lines:
            break
    if not lines:
        raise ValueError(f'Title does not fit; add a shorter shareTitle: {title}')
    boxes = [draw.textbbox((0, 0), line, font=face, anchor='lt') for line in lines]
    line_height = max(box[3] - box[1] for box in boxes) + template['lineGap']
    block_height = line_height * len(lines) - template['lineGap']
    y = padding + (template['titleAreaBottom'] - padding - block_height) / 2
    if y < padding or y + block_height > template['titleAreaBottom']:
        raise ValueError(f'Title exceeds safe area: {title}')
    for line, box in zip(lines, boxes):
        draw.text((padding - box[0], y - box[1]), line, font=face, fill=tuple(template['colors']['fg']), anchor='lt')
        y += line_height
    signature = template['signature']
    small = font(ROOT / template['sans'], template['signatureSize'])
    box = draw.textbbox((0, 0), signature, font=small, anchor='lt')
    if box[2] - box[0] > template['width'] - 2 * padding or template['signatureY'] + box[3] - box[1] > template['height'] - 40:
        raise ValueError('Signature exceeds safe area')
    draw.text((padding - box[0], template['signatureY'] - box[1]), signature, font=small, fill=tuple(template['colors']['muted']), anchor='lt')
    return image


def main():
    manifest = json.loads(subprocess.check_output(['node', str(ROOT / 'scripts/share-manifest.mjs')]))
    # Render every card successfully before replacing any published asset.
    cards = [(card, render_card(card['title'], manifest['template'])) for card in manifest['cards']]
    output = ROOT / 'public/social'
    output.mkdir(parents=True, exist_ok=True)
    images = {}
    for card, image in cards:
        path = output / f"{card['id']}.png"
        image.save(path, optimize=True)
        images[card['id']] = hashlib.sha256(path.read_bytes()).hexdigest()
    (ROOT / 'data/share-assets.json').write_text(json.dumps({'sourceHash': manifest['sourceHash'], 'images': images}, indent=2) + '\n')
    print(f'Generated {len(cards)} share cards from one template.')


if __name__ == '__main__':
    main()
