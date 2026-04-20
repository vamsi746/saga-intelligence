"""
Download diverse real-world images for training data augmentation.
Goal: Add non-portrait, casual, compressed real images to prevent false positives.

Sources:
  1. LFW (Labeled Faces in the Wild) - casual face photos, varied quality
  2. COCO val2017 person crops - real-world people in natural settings
"""

import os
import sys
from pathlib import Path
from PIL import Image
from io import BytesIO

SAVE_DIR = r"C:\Users\LakshmiNarayana\deepfake_detection_py\datasets\image_deepfake\real_diverse"
os.makedirs(SAVE_DIR, exist_ok=True)

def download_lfw_faces(max_images=3000):
    """Download LFW (Labeled Faces in the Wild) - diverse real face photos."""
    from datasets import load_dataset
    
    print(f"[*] Downloading LFW faces (target: {max_images})...")
    ds = load_dataset("logasja/lfw", split="train", streaming=True)
    
    count = 0
    for item in ds:
        if count >= max_images:
            break
        try:
            img = item["image"]
            if img.mode != "RGB":
                img = img.convert("RGB")
            # Save as JPEG with varied quality to simulate real-world compression
            quality = 85 if count % 3 != 0 else 70  # Mix of qualities
            save_path = os.path.join(SAVE_DIR, f"lfw_{count:05d}.jpg")
            img.save(save_path, "JPEG", quality=quality)
            count += 1
            if count % 500 == 0:
                print(f"  [{count}/{max_images}] downloaded...")
        except Exception as e:
            print(f"  [!] Skip: {e}")
            continue
    
    print(f"[*] LFW: Downloaded {count} images")
    return count

def download_coco_people(max_images=2000):
    """Download COCO images containing people - diverse real-world scenes."""
    from datasets import load_dataset
    
    print(f"[*] Downloading COCO person images (target: {max_images})...")
    ds = load_dataset("detection-datasets/coco", split="val", streaming=True)
    
    count = 0
    for item in ds:
        if count >= max_images:
            break
        try:
            img = item["image"]
            if img.mode != "RGB":
                img = img.convert("RGB")
            # Only save reasonably sized images
            w, h = img.size
            if w < 100 or h < 100:
                continue
            save_path = os.path.join(SAVE_DIR, f"coco_{count:05d}.jpg")
            img.save(save_path, "JPEG", quality=85)
            count += 1
            if count % 500 == 0:
                print(f"  [{count}/{max_images}] downloaded...")
        except Exception as e:
            print(f"  [!] Skip: {e}")
            continue
    
    print(f"[*] COCO: Downloaded {count} images")
    return count

if __name__ == "__main__":
    existing = len([f for f in os.listdir(SAVE_DIR) if f.endswith(('.jpg', '.png'))]) if os.path.exists(SAVE_DIR) else 0
    print(f"[*] Existing images in real_diverse/: {existing}")
    
    if existing >= 4000:
        print("[*] Already have enough diverse real images. Skipping download.")
        sys.exit(0)
    
    total = 0
    total += download_lfw_faces(3000)
    total += download_coco_people(2000)
    
    print(f"\n[*] DONE: {total} diverse real images saved to {SAVE_DIR}")
    print(f"[*] Combined with existing 7K portraits = ~{7000 + total} real images for training")
