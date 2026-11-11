"""Génère les cartes de profondeur des décors avec Depth Anything V2.

Pour chaque `<quartier>_<logement>_image.jpg` de src/asset/image/background/, écrit à côté
`<quartier>_<logement>_depth.png` : niveaux de gris, même ratio que la photo, blanc = premier plan,
noir = lointain. Le jeu s'en sert pour la parallaxe en profondeur et pour repérer le ciel.

Dépendances (à installer dans un environnement virtuel hors du dépôt) :
    python -m venv %TEMP%\\newdawn-depth\\venv
    %TEMP%\\newdawn-depth\\venv\\Scripts\\pip install torch --index-url https://download.pytorch.org/whl/cpu
    %TEMP%\\newdawn-depth\\venv\\Scripts\\pip install transformers pillow

Usage :
    python tools/make_depth.py            # ne traite que les photos sans carte
    python tools/make_depth.py --force    # régénère tout

Le modèle par défaut (Small) est sous licence Apache 2.0. Les variantes Base et Large sont plus fines
mais sous licence non commerciale (CC BY-NC 4.0) : à éviter pour un jeu distribué.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter
from transformers import pipeline

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DIR = ROOT / "src" / "asset" / "image" / "background"
DEFAULT_MODEL = "depth-anything/Depth-Anything-V2-Small-hf"


def depth_path(photo: Path) -> Path:
    return photo.with_name(re.sub(r"_image$", "", photo.stem) + "_depth.png")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dir", type=Path, default=DEFAULT_DIR, help="dossier des photos")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="modèle Hugging Face d'estimation de profondeur")
    parser.add_argument("--width", type=int, default=1024, help="largeur des cartes, en pixels")
    parser.add_argument("--blur", type=float, default=2.0, help="flou gaussien final : adoucit les contours, évite les déchirures de la parallaxe")
    parser.add_argument("--force", action="store_true", help="régénère les cartes existantes")
    args = parser.parse_args()

    photos = [p for p in sorted(args.dir.glob("*.jpg")) if args.force or not depth_path(p).exists()]
    if not photos:
        print("Rien à faire : toutes les cartes existent (--force pour les régénérer).")
        return

    device = 0 if torch.cuda.is_available() else -1
    estimator = pipeline("depth-estimation", model=args.model, device=device)

    for photo in photos:
        with Image.open(photo) as source:
            image = source.convert("RGB")
        # Sortie du modèle : une disparité relative (grand = proche), à sa résolution interne.
        raw = estimator(image)["predicted_depth"].squeeze().float().cpu().numpy()
        low, high = np.percentile(raw, (0.5, 99.5))
        near = np.clip((raw - low) / max(high - low, 1e-6), 0.0, 1.0)

        height = round(args.width * image.height / image.width)
        out = Image.fromarray((near * 255).astype(np.uint8), mode="L").resize((args.width, height), Image.Resampling.BICUBIC)
        if args.blur > 0:
            out = out.filter(ImageFilter.GaussianBlur(args.blur))
        target = depth_path(photo)
        out.save(target, optimize=True)
        print(f"{photo.name} -> {target.name} ({target.stat().st_size // 1024} Ko)")


if __name__ == "__main__":
    main()
