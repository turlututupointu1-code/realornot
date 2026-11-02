import sys
import os
import random
import torch
from diffusers import StableDiffusionPipeline

# ==============================
# Configuration
# ==============================

MODEL_PATH = os.path.expanduser(
    "~/stable-diffusion/models/sd15-diffusers"
)

OUTPUT_DIR = os.path.expanduser(
    "~/stable-diffusion/generated"
)

WIDTH = 384
HEIGHT = 640
STEPS = 15
GUIDANCE_SCALE = 7.5

# Optimisation CPU
torch.set_num_threads(6)
torch.set_num_interop_threads(2)

# ==============================
# Vérification du prompt
# ==============================

if len(sys.argv) < 2:
    print('Utilisation :')
    print('python generate.py "votre description ici"')
    sys.exit(1)

prompt = " ".join(sys.argv[1:])

negative_prompt = (
    "blurry, low quality, distorted, deformed"
)

# ==============================
# Préparation
# ==============================

os.makedirs(OUTPUT_DIR, exist_ok=True)

seed = random.randint(0, 2**32 - 1)

print()
print("======================================")
print("      Stable Diffusion 1.5")
print("======================================")
print(f"Prompt       : {prompt}")
print(f"Resolution   : {WIDTH}x{HEIGHT}")
print(f"Steps        : {STEPS}")
print(f"CFG          : {GUIDANCE_SCALE}")
print(f"Seed         : {seed}")
print("======================================")
print()

# ==============================
# Chargement du modèle
# ==============================

print("Chargement du modèle...")

pipe = StableDiffusionPipeline.from_pretrained(
    MODEL_PATH,
    torch_dtype=torch.float32,
    safety_checker=None
)

pipe = pipe.to("cpu")

# ==============================
# Génération
# ==============================

print("Génération en cours...")

generator = torch.Generator(
    device="cpu"
).manual_seed(seed)

image = pipe(
    prompt=prompt,
    negative_prompt=negative_prompt,
    width=WIDTH,
    height=HEIGHT,
    num_inference_steps=STEPS,
    guidance_scale=GUIDANCE_SCALE,
    generator=generator
).images[0]

# ==============================
# Sauvegarde
# ==============================

filename = f"sd15_{seed}.png"

output_path = os.path.join(
    OUTPUT_DIR,
    filename
)

image.save(output_path)

print()
print("======================================")
print("Image générée avec succès !")
print(f"Fichier : {output_path}")
print("======================================")
