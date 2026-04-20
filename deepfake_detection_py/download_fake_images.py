"""
Download Fake Face Images for EfficientNet Training
====================================================
Downloads AI-generated face images from multiple HuggingFace datasets:
  - 140k Real and Fake Faces (subset)
  - DiffusionDB faces (subset)

Target: ~8,000 fake face images in datasets/image_deepfake/fake/
"""

import os
import sys
import requests
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm

# --- CONFIG ---
DATA_ROOT = r"C:\Users\LakshmiNarayana\deepfake_detection_py"
OUTPUT_DIR = os.path.join(DATA_ROOT, "datasets", "image_deepfake", "fake")
TARGET_COUNT = 8000

def download_from_huggingface_dataset():
    """
    Downloads fake face images from HuggingFace datasets API.
    Uses the '140k-real-and-fake-faces' dataset which has labeled fake images.
    """
    try:
        from datasets import load_dataset
        print("[*] Downloading fake face images from HuggingFace...")
        print("[*] This may take a while on first run (downloading dataset)...")
        
        # 140k Real and Fake Faces dataset - well-known for deepfake training
        # Contains StyleGAN-generated faces labeled as 'fake'
        ds = load_dataset("Dmizz/Real-and-Fake-Face-Detection", split="train", streaming=True)
        
        count = 0
        for item in tqdm(ds, total=TARGET_COUNT, desc="Downloading fake faces"):
            if count >= TARGET_COUNT:
                break
            
            # Check if this is a fake image
            label = item.get("label", item.get("labels", None))
            if label == 1 or label == "fake":  # 1 = fake in most datasets
                img = item.get("image", item.get("img", None))
                if img is not None:
                    save_path = os.path.join(OUTPUT_DIR, f"fake_hf_{count:05d}.jpg")
                    img.save(save_path, "JPEG", quality=95)
                    count += 1
        
        return count
    except Exception as e:
        print(f"[!] HuggingFace dataset method failed: {e}")
        return 0

def download_from_thispersondoesnotexist():
    """
    Downloads AI-generated faces from thispersondoesnotexist.com style APIs.
    Uses randomuser.me as a fallback for real face variety.
    """
    # Use a well-known fake face generation API
    base_url = "https://thispersondoesnotexist.com"
    
    def download_single(idx):
        try:
            resp = requests.get(base_url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200 and len(resp.content) > 1000:
                save_path = os.path.join(OUTPUT_DIR, f"fake_tpdne_{idx:05d}.jpg")
                with open(save_path, "wb") as f:
                    f.write(resp.content)
                return True
        except:
            pass
        return False
    
    print("[*] Downloading from ThisPersonDoesNotExist.com...")
    count = 0
    # Download sequentially with delay to be respectful
    import time
    for i in tqdm(range(TARGET_COUNT), desc="TPDNE faces"):
        if download_single(i):
            count += 1
        time.sleep(1)  # 1 second delay between requests
        
        # Check if we already have enough combined with other sources
        existing = len([f for f in os.listdir(OUTPUT_DIR) if f.endswith(('.jpg', '.png'))])
        if existing >= TARGET_COUNT:
            break
    
    return count

def download_from_kaggle_alternative():
    """
    Alternative: Download pre-packaged fake faces from a direct source.
    Uses the well-known 1M Fake Faces dataset (Bojan Tunguz).
    """
    try:
        from datasets import load_dataset
        print("[*] Trying alternative dataset: '1M Fake Faces'...")
        
        ds = load_dataset("tonyassi/1M-Fake-Faces", split="train", streaming=True)
        
        count = 0
        for item in tqdm(ds, total=TARGET_COUNT, desc="1M Fake Faces"):
            if count >= TARGET_COUNT:
                break
            img = item.get("image", None)
            if img is not None:
                save_path = os.path.join(OUTPUT_DIR, f"fake_1m_{count:05d}.jpg")
                img.save(save_path, "JPEG", quality=95)
                count += 1
        
        return count
    except Exception as e:
        print(f"[!] Alternative dataset failed: {e}")
        return 0

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Check existing
    existing = len([f for f in os.listdir(OUTPUT_DIR) if f.endswith(('.jpg', '.png', '.jpeg'))])
    print(f"[*] Existing fake images: {existing}")
    
    if existing >= TARGET_COUNT:
        print(f"[OK] Already have {existing} fake images. Target: {TARGET_COUNT}. Done!")
        return
    
    remaining = TARGET_COUNT - existing
    print(f"[*] Need {remaining} more fake images...")
    
    # Strategy 1: HuggingFace datasets (fastest, highest quality)
    print("\n=== Strategy 1: HuggingFace Datasets ===")
    try:
        import datasets
        count1 = download_from_kaggle_alternative()
        if count1 < remaining:
            count2 = download_from_huggingface_dataset()
        else:
            count2 = 0
    except ImportError:
        print("[!] 'datasets' library not installed. Installing...")
        os.system(f"{sys.executable} -m pip install datasets --quiet")
        from datasets import load_dataset
        count1 = download_from_kaggle_alternative()
        count2 = download_from_huggingface_dataset() if count1 < remaining else 0
    
    # Check total
    total = len([f for f in os.listdir(OUTPUT_DIR) if f.endswith(('.jpg', '.png', '.jpeg'))])
    print(f"\n[*] Total fake images now: {total}")
    
    if total < TARGET_COUNT:
        print(f"[!] Still short. Trying ThisPersonDoesNotExist...")
        download_from_thispersondoesnotexist()
    
    final_count = len([f for f in os.listdir(OUTPUT_DIR) if f.endswith(('.jpg', '.png', '.jpeg'))])
    print(f"\n[DONE] Final fake image count: {final_count} / {TARGET_COUNT}")
    
    if final_count >= TARGET_COUNT:
        print("[OK] Fake image dataset is ready for training!")
    else:
        print(f"[!] Short by {TARGET_COUNT - final_count}. Consider manual download from:")
        print("    - https://huggingface.co/datasets/tonyassi/1M-Fake-Faces")
        print("    - https://www.kaggle.com/datasets/ciplab/real-and-fake-face-detection")

if __name__ == "__main__":
    main()
