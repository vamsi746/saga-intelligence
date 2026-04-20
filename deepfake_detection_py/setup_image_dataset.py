"""
Setup Image Deepfake Dataset from Existing FF++ Face Crops
==========================================================
Copies balanced real/fake face crops from processed_faces into
datasets/image_deepfake/ structure expected by EfficientNet training scripts.

This is much faster than downloading 8K images from the internet.
FF++ face crops contain real manipulation artifacts (Deepfakes, Face2Face,
FaceSwap, NeuralTextures) which are excellent for training.
"""

import os
import shutil
import random

DATA_ROOT = r"C:\Users\LakshmiNarayana\deepfake_detection_py"
SRC_DIR = os.path.join(DATA_ROOT, "datasets", "processed_faces")
DST_DIR = os.path.join(DATA_ROOT, "datasets", "image_deepfake")

# Target: ~8K fake, ~6K real (balanced enough for training)
TARGET_FAKE = 8000
TARGET_REAL = 6000

def collect_images(folder):
    """Collect all image paths from a folder."""
    if not os.path.exists(folder):
        return []
    return [
        os.path.join(folder, f) 
        for f in os.listdir(folder) 
        if f.lower().endswith(('.jpg', '.jpeg', '.png'))
    ]

def main():
    # Create output directories
    real_dst = os.path.join(DST_DIR, "real")
    fake_dst = os.path.join(DST_DIR, "fake")
    os.makedirs(real_dst, exist_ok=True)
    os.makedirs(fake_dst, exist_ok=True)

    # Check existing counts
    existing_real = len(collect_images(real_dst))
    existing_fake = len(collect_images(fake_dst))
    print(f"[*] Existing in image_deepfake: {existing_real} real, {existing_fake} fake")

    if existing_real >= TARGET_REAL and existing_fake >= TARGET_FAKE:
        print(f"[+] Already have enough images! Skipping.")
        return

    # Collect source images
    real_src_dir = os.path.join(SRC_DIR, "real")
    fake_src_dir = os.path.join(SRC_DIR, "fake")

    real_images = collect_images(real_src_dir)
    fake_images = collect_images(fake_src_dir)
    print(f"[*] Source processed_faces: {len(real_images)} real, {len(fake_images)} fake")

    if len(real_images) == 0 or len(fake_images) == 0:
        print("[!] ERROR: processed_faces directory is empty or missing!")
        return

    # Shuffle and select subset
    random.seed(42)
    random.shuffle(real_images)
    random.shuffle(fake_images)

    need_real = max(0, TARGET_REAL - existing_real)
    need_fake = max(0, TARGET_FAKE - existing_fake)

    real_to_copy = real_images[:need_real]
    fake_to_copy = fake_images[:need_fake]

    print(f"[*] Copying {len(real_to_copy)} real images...")
    for i, src in enumerate(real_to_copy):
        ext = os.path.splitext(src)[1]
        dst = os.path.join(real_dst, f"real_{i:05d}{ext}")
        shutil.copy2(src, dst)
        if (i + 1) % 1000 == 0:
            print(f"    ... {i + 1}/{len(real_to_copy)}")

    print(f"[*] Copying {len(fake_to_copy)} fake images...")
    for i, src in enumerate(fake_to_copy):
        ext = os.path.splitext(src)[1]
        dst = os.path.join(fake_dst, f"fake_{i:05d}{ext}")
        shutil.copy2(src, dst)
        if (i + 1) % 1000 == 0:
            print(f"    ... {i + 1}/{len(fake_to_copy)}")

    # Final count
    final_real = len(collect_images(real_dst))
    final_fake = len(collect_images(fake_dst))
    print(f"\n[+] Done! image_deepfake dataset ready:")
    print(f"    Real: {final_real}")
    print(f"    Fake: {final_fake}")
    print(f"    Total: {final_real + final_fake}")
    print(f"\n[*] You can now run:")
    print(f"    python train_efficientnet_texture.py")
    print(f"    python train_efficientnet_frequency.py")

if __name__ == "__main__":
    main()
