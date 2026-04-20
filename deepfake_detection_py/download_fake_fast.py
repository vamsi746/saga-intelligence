"""
Fast Parallel Download of AI-Generated Fake Face Images
========================================================
Downloads StyleGAN-generated faces from ThisPersonDoesNotExist.com
using concurrent threads for 20-50x speedup over sequential download.

Target: ~8,000 fake face images in datasets/image_deepfake/fake/
These are FULLY AI-GENERATED faces (not face-swaps), needed for
EfficientNet-B4 (texture) and EfficientNet-B0 (frequency) training.
"""

import os
import sys
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

# --- CONFIG ---
DATA_ROOT = r"C:\Users\LakshmiNarayana\deepfake_detection_py"
OUTPUT_DIR = os.path.join(DATA_ROOT, "datasets", "image_deepfake", "fake")
TARGET_COUNT = 8000
MAX_WORKERS = 16       # Concurrent download threads
RETRY_LIMIT = 2        # Retries per failed download
SESSION_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# --- GLOBALS ---
counter_lock = Lock()
downloaded_count = 0
failed_count = 0

def get_existing_count():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        return 0
    return len([f for f in os.listdir(OUTPUT_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])

def download_one(idx):
    """Download a single AI-generated face from TPDNE."""
    global downloaded_count, failed_count
    
    save_path = os.path.join(OUTPUT_DIR, f"fake_tpdne_{idx:05d}.jpg")
    if os.path.exists(save_path) and os.path.getsize(save_path) > 1000:
        return True  # Already downloaded
    
    for attempt in range(RETRY_LIMIT):
        try:
            # TPDNE returns a unique StyleGAN face on every request
            resp = requests.get(
                "https://thispersondoesnotexist.com",
                headers=SESSION_HEADERS,
                timeout=15
            )
            if resp.status_code == 200 and len(resp.content) > 5000:
                with open(save_path, "wb") as f:
                    f.write(resp.content)
                with counter_lock:
                    downloaded_count += 1
                return True
            # Rate limited - back off
            time.sleep(2)
        except Exception:
            time.sleep(1)
    
    with counter_lock:
        failed_count += 1
    return False

def main():
    global downloaded_count, failed_count
    
    existing = get_existing_count()
    print(f"[*] Output: {OUTPUT_DIR}")
    print(f"[*] Existing fake images: {existing}")
    
    if existing >= TARGET_COUNT:
        print(f"[+] Already have {existing} fake images. Done!")
        return
    
    needed = TARGET_COUNT - existing
    print(f"[*] Need {needed} more AI-generated fake faces")
    print(f"[*] Downloading from ThisPersonDoesNotExist.com ({MAX_WORKERS} threads)...")
    print(f"[*] These are StyleGAN-generated faces - proper training data for EfficientNet\n")
    
    # Generate indices starting after existing files
    # Find the max existing index to avoid collisions
    existing_indices = set()
    for f in os.listdir(OUTPUT_DIR):
        if f.startswith("fake_tpdne_") and f.endswith(".jpg"):
            try:
                idx = int(f.replace("fake_tpdne_", "").replace(".jpg", ""))
                existing_indices.add(idx)
            except ValueError:
                pass
    
    # Create download indices
    indices = []
    idx = 0
    while len(indices) < needed:
        if idx not in existing_indices:
            indices.append(idx)
        idx += 1
    
    start_time = time.time()
    completed = 0
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(download_one, i): i for i in indices}
        
        for future in as_completed(futures):
            completed += 1
            if completed % 50 == 0:
                elapsed = time.time() - start_time
                rate = completed / elapsed if elapsed > 0 else 0
                total_now = get_existing_count()
                eta_mins = (needed - downloaded_count) / rate / 60 if rate > 0 else 0
                print(f"  [{completed}/{needed}] Downloaded: {downloaded_count} | "
                      f"Failed: {failed_count} | "
                      f"Rate: {rate:.1f}/s | "
                      f"Total: {total_now} | "
                      f"ETA: {eta_mins:.1f}min")
    
    elapsed = time.time() - start_time
    final_count = get_existing_count()
    print(f"\n[DONE] Downloaded {downloaded_count} images in {elapsed:.0f}s ({downloaded_count/elapsed:.1f}/s)")
    print(f"[DONE] Total fake images: {final_count} / {TARGET_COUNT}")
    
    if final_count >= TARGET_COUNT:
        print("[+] Fake image dataset READY for EfficientNet training!")
    else:
        print(f"[!] Still short by {TARGET_COUNT - final_count}. Run again to continue.")

if __name__ == "__main__":
    main()
