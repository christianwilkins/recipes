import importlib.util
import json
import subprocess
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('share_images', ROOT / 'scripts/generate-share-images.py')
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)


class ShareLayoutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(subprocess.check_output(['node', str(ROOT / 'scripts/share-manifest.mjs')]))

    def test_every_card_fits_and_uses_the_dark_background(self):
        for card in self.manifest['cards']:
            with self.subTest(card=card['id']):
                image = renderer.render_card(card['title'], self.manifest['template'])
                self.assertEqual(image.size, (1200, 630))
                self.assertEqual(image.getpixel((0, 0)), (0, 0, 0))

    def test_unbroken_and_overlong_titles_fail_instead_of_clipping(self):
        for title in ['W' * 100, 'Very long recipe name ' * 30]:
            with self.assertRaisesRegex(ValueError, 'shorter shareTitle'):
                renderer.render_card(title, self.manifest['template'])

    def test_line_balancing_avoids_a_stranded_final_word(self):
        draw = ImageDraw.Draw(Image.new('RGB', (1200, 630)))
        face = renderer.font(ROOT / self.manifest['template']['serif'], 92, 700)
        lines = renderer.balanced_lines(draw, 'Chicken satay rice bowls', face, 1056, 2)
        self.assertEqual(lines, ['Chicken satay', 'rice bowls'])


if __name__ == '__main__':
    unittest.main()
