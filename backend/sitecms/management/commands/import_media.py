"""Importe toutes les photos exploitables dans la bibliothèque `MediaAsset`.

Sources :
  - backend/Algomaat/static/img/hbc/ev01..ev12  (-wide / -card, déjà recadrées → prioritaires)
  - <repo>/images_t1/*.jpg                        (12 photos brutes)
  - <repo>/images_t2/*.jpg                        (photos brutes, hors screenshots/mp4)

Chaque image est ré-encodée (EXIF corrigé, redimensionnée, JPEG optimisé) et
enregistrée dans MEDIA_ROOT via l'ImageField. Idempotent : on saute un `title`
déjà présent. Les `ev*` reçoivent un `title` stable (ex. « ev07-wide ») pour que
`seed_site` puisse les retrouver.

Usage :
    python manage.py import_media          # importe tout
    python manage.py import_media --reset  # purge la bibliothèque d'abord
"""

import io
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from sitecms.models import MediaAsset

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover
    Image = None


SCREENSHOT_HINTS = ("screenshot", "linkedin")
MAX_WIDE = 1600
MAX_CARD = 900
JPEG_QUALITY = 82


class Command(BaseCommand):
    help = "Importe les photos (hbc/ev*, images_t1, images_t2) dans MediaAsset."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Vide la bibliothèque avant import.")

    def handle(self, *args, **opts):
        if Image is None:
            self.stderr.write("Pillow requis (pip install Pillow).")
            return

        base = Path(settings.BASE_DIR)
        repo = base.parent
        hbc_dir = base / "Algomaat" / "static" / "img" / "hbc"
        t1_dir = repo / "images_t1"
        t2_dir = repo / "images_t2"

        if opts["reset"]:
            n = MediaAsset.objects.count()
            MediaAsset.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Bibliothèque vidée ({n} éléments)."))

        order = 0
        created = 0

        # 1) Set recadré prêt-à-l'emploi (prioritaire).
        for p in sorted(hbc_dir.glob("ev*.jpg")):
            title = p.stem  # ex: ev07-wide
            is_card = title.endswith("-card")
            tags = "hbc," + ("card" if is_card else "wide") + "," + title.split("-")[0]
            if self._save(title, p, tags, MAX_CARD if is_card else MAX_WIDE, order):
                created += 1
            order += 1

        # 2) Photos brutes t1 / t2 (une version web optimisée chacune).
        for src_dir, label in ((t1_dir, "t1"), (t2_dir, "t2")):
            if not src_dir.exists():
                self.stdout.write(self.style.WARNING(f"Dossier absent, ignoré : {src_dir}"))
                continue
            for p in sorted(src_dir.iterdir()):
                if p.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                    continue
                if any(h in p.name.lower() for h in SCREENSHOT_HINTS):
                    continue
                title = f"{label}-{p.stem}"
                if self._save(title, p, f"terrain,{label}", MAX_WIDE, order):
                    created += 1
                order += 1

        self.stdout.write(self.style.SUCCESS(
            f"Import terminé : {created} nouveaux, {MediaAsset.objects.count()} au total."
        ))

    def _save(self, title, path, tags, max_w, order):
        if MediaAsset.objects.filter(title=title).exists():
            return False
        try:
            img = Image.open(path)
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            if img.width > max_w:
                ratio = max_w / img.width
                img = img.resize((max_w, int(img.height * ratio)), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        except Exception as exc:  # noqa: BLE001
            self.stderr.write(f"  ✗ {path.name}: {exc}")
            return False

        asset = MediaAsset(
            title=title,
            alt=title.replace("-", " ").replace("_", " "),
            tags=tags,
            order=order,
            width=img.width,
            height=img.height,
        )
        asset.image.save(f"{title}.jpg", ContentFile(buf.getvalue()), save=True)
        self.stdout.write(f"  ✓ {title} ({img.width}×{img.height})")
        return True
