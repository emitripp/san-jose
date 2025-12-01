import os
import subprocess
import shutil

# 1. Optimize Accessories
source_dir = "/Users/emitripp/Downloads/Legado san josé-1/fotos"
output_dir = "/Users/emitripp/Downloads/Legado san josé-1/fotos/optimized"

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

accessories = [
    "gorra1 frente.png",
    "Mochila.png",
    "Maleta.png",
    "gorra2.png",
    "gorra3.png",
    "modelo gorra1.png",
    "modelo2 gorra1.png",
    "bolsas.png"
]

for file in accessories:
    input_path = os.path.join(source_dir, file)
    output_path = os.path.join(output_dir, file)
    
    if os.path.exists(input_path):
        # Use sips to resize to max width 800px
        cmd = ["sips", "-Z", "800", input_path, "--out", output_path]
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            print(f"Optimized: {file}")
        except subprocess.CalledProcessError as e:
            print(f"Error optimizing {file}: {e}")
    else:
        print(f"File not found: {input_path}")

# 2. Cleanup T-Shirt Images
# Delete originals in Fotos/playeras, keep optimized folder
playeras_dir = "/Users/emitripp/Downloads/Legado san josé-1/fotos/playeras"
optimized_playeras_dir = os.path.join(playeras_dir, "optimized")

if os.path.exists(playeras_dir):
    for file in os.listdir(playeras_dir):
        file_path = os.path.join(playeras_dir, file)
        # Skip the optimized directory itself
        if file_path == optimized_playeras_dir:
            continue
            
        # Delete files (png, jpg, etc)
        if os.path.isfile(file_path) and file.lower().endswith(('.png', '.jpg', '.jpeg')):
            os.remove(file_path)
            print(f"Deleted original: {file}")
