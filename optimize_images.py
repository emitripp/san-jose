import os
import subprocess

source_dir = "/Users/emitripp/Downloads/Legado san josé-1/fotos/playeras"
output_dir = "/Users/emitripp/Downloads/Legado san josé-1/fotos/playeras/optimized"

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

files = [f for f in os.listdir(source_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

for file in files:
    input_path = os.path.join(source_dir, file)
    output_path = os.path.join(output_dir, file)
    
    # Use sips to resize to max width 800px
    # -Z 800: Resample height and width to max 800
    cmd = ["sips", "-Z", "800", input_path, "--out", output_path]
    
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(f"Optimized: {file}")
    except subprocess.CalledProcessError as e:
        print(f"Error optimizing {file}: {e}")
