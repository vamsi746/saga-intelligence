"""
Download Modern AI-Generated Images for B4/B0 Retraining
=========================================================
Downloads Stable Diffusion generated images from HuggingFace datasets.
These augment the existing StyleGAN fakes with modern diffusion model outputs.

Target: ~3,000 diffusion-model images → datasets/image_deepfake/fake_diffusion/
The B4 training script already loads from fake/ and fake_raw/ - we add fake_diffusion
or just merge into fake/.
"""
import os
import sys
from PIL import Image
from io import BytesIO

# --- CONFIG ---
DATA_ROOT = r"C:\Users\LakshmiNarayana\deepfake_detection_py"
OUTPUT_DIR = os.path.join(DATA_ROOT, "datasets", "image_deepfake", "fake_diffusion")
TARGET_COUNT = 3000

def download_from_huggingface():
    """Download AI-generated face images from HuggingFace."""
    from datasets import load_dataset
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    existing = len([f for f in os.listdir(OUTPUT_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
    
    if existing >= TARGET_COUNT:
        print(f"[*] Already have {existing} images. Skipping download.")
        return existing
    
    remaining = TARGET_COUNT - existing
    print(f"[*] Have {existing}, need {remaining} more diffusion images...")
    
    # Dataset 1: SDXL/SD images from various HuggingFace datasets
    print("[*] Downloading AI-generated images from HuggingFace...")
    
    # Try multiple datasets in order of preference
    hf_datasets = [
        ("elsaEU/ELSA1M_track1", None, "image", "train"),
        ("Organika/sdxl-detector", None, "image", "train"),
        ("jonathan-roberts1/Fake-Faces", None, "image", "train"),
    ]
    
    count = existing
    
    for ds_name, ds_config, img_col, split in hf_datasets:
        if count >= TARGET_COUNT:
            break
        
        print(f"[*] Trying dataset: {ds_name}...")
        try:
            if ds_config:
                ds = load_dataset(ds_name, ds_config, split=split, streaming=True)
            else:
                ds = load_dataset(ds_name, split=split, streaming=True)
            
            for item in ds:
                if count >= TARGET_COUNT:
                    break
                
                try:
                    img = item.get(img_col)
                    if img is None:
                        # Try other common column names
                        for col in ["image", "img", "pixel_values"]:
                            if col in item and item[col] is not None:
                                img = item[col]
                                break
                    
                    if img is None or not isinstance(img, Image.Image):
                        continue
                    
                    img = img.convert("RGB")
                    save_path = os.path.join(OUTPUT_DIR, f"diffusion_{count:05d}.jpg")
                    img.save(save_path, "JPEG", quality=95)
                    count += 1
                    
                    if count % 100 == 0:
                        print(f"[*] Saved {count}/{TARGET_COUNT}...")
                except Exception as e:
                    continue
            
            print(f"[*] {ds_name}: Total so far = {count}")
        except Exception as e:
            print(f"[!] {ds_name} failed: {e}")
            continue
    
    # Also copy any Gemini/ChatGPT images from Downloads
    downloads_dir = r"C:\Users\LakshmiNarayana\Downloads"
    ai_patterns = ["Gemini_Generated", "gemtest", "ChatGPT Image"]
    copied = 0
    for f in os.listdir(downloads_dir):
        if any(pat.lower() in f.lower() for pat in ai_patterns):
            if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                src = os.path.join(downloads_dir, f)
                dst = os.path.join(OUTPUT_DIR, f"modern_ai_{copied:04d}_{f}")
                if not os.path.exists(dst):
                    try:
                        img = Image.open(src).convert("RGB")
                        img.save(dst, "JPEG", quality=95)
                        copied += 1
                    except:
                        pass
    
    if copied > 0:
        print(f"[*] Copied {copied} Gemini/ChatGPT images from Downloads")
    
    total = len([f for f in os.listdir(OUTPUT_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
    print(f"\n[DONE] Total diffusion images: {total}")
    print(f"[DONE] Location: {OUTPUT_DIR}")
    return total

if __name__ == "__main__":
    download_from_huggingface()
