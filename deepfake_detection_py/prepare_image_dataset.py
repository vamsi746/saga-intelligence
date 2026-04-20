import os
import cv2
import numpy as np
import random
from PIL import Image, ImageFilter, ImageEnhance
import albumentations as A
import shutil
import glob

# --- CONFIGURATION (LOCKED SPEC) ---
IMAGE_SIZE = 224
OUTPUT_DIR = "datasets/image_ensemble_training"

# Raw Data Paths (Assumed Structure)
REAL_DIR = "datasets/raw_images/real"  # CelebA-HQ, FFHQ
FAKE_DIR = "datasets/raw_images/fake"  # StyleGAN, SDXL, DiffusionDB

# Subdirectories for the Two Models
SPATIAL_DIR = os.path.join(OUTPUT_DIR, "spatial_swin")
FREQ_DIR = os.path.join(OUTPUT_DIR, "frequency_resnet")

for d in [os.path.join(SPATIAL_DIR, "real"), os.path.join(SPATIAL_DIR, "fake"),
          os.path.join(FREQ_DIR, "real"), os.path.join(FREQ_DIR, "fake")]:
    os.makedirs(d, exist_ok=True)

# --- 1. FREQUENCY EXTRACTION (For Model B) ---
def get_noise_residual(image_np):
    """
    Extracts high-frequency noise fingerprints (FFT/DCT residuals proxy).
    Crucial for catching photorealistic GAN/Diffusion artifacts.
    """
    img_pil = Image.fromarray(image_np)
    # Median filter removes the base content, leaving high-frequency details
    img_blur = np.array(img_pil.filter(ImageFilter.MedianFilter(size=3))).astype(np.float32)
    img_float = image_np.astype(np.float32)
    
    residual = img_float - img_blur
    # Shift to visible range [0, 255] for standard CNN ingestion
    residual = np.clip(residual + 128, 0, 255).astype(np.uint8)
    return residual

# --- 2. MANDATORY AUGMENTATIONS (For Both Models) ---
# Simulates real-world uploads & social media compression
social_media_augment = A.Compose([
    A.ImageCompression(quality_lower=70, quality_upper=95, p=0.8), # JPEG Artifacts
    A.GaussNoise(var_limit=(10.0, 50.0), p=0.5),                   # Camera/Transfer Noise
    A.OneOf([
        A.GaussianBlur(blur_limit=(3, 7)),
        A.Sharpen(alpha=(0.2, 0.5), lightness=(0.5, 1.0))
    ], p=0.4),                                                     # Blur/Sharpen
    A.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1, p=0.5),
    A.HorizontalFlip(p=0.5)
])

def process_image(img_path, label, count):
    """Processes a single image for both Spatial (Swin) and Frequency (ResNet) pipelines."""
    try:
        # 1. Read and Resize (224x224)
        img = cv2.imread(img_path)
        if img is None: return False
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (IMAGE_SIZE, IMAGE_SIZE))
        
        # 2. Apply Mandatory Social Media Augmentations
        augmented = social_media_augment(image=img)
        img_aug = augmented['image']
        
        # 3. Generate Frequency Residual (Model B Input)
        img_freq = get_noise_residual(img_aug)
        
        # 4. Save Outputs
        filename = f"{label}_{count}.jpg"
        
        # Spatial Output (Standard RGB view for Swin)
        Image.fromarray(img_aug).save(os.path.join(SPATIAL_DIR, label, filename))
        
        # Frequency Output (Residual view for ResNet-18)
        Image.fromarray(img_freq).save(os.path.join(FREQ_DIR, label, filename))
        
        return True
    except Exception as e:
        print(f"Error processing {img_path}: {e}")
        return False

def build_dataset():
    print(f"[*] Starting Image Dataset Pipeline (LOCKED SPEC)")
    print(f"[*] Output Dir: {OUTPUT_DIR}")
    
    # Process REAL images (Target: ~5,000)
    print("[-] Processing REAL images (CelebA-HQ/FFHQ)...")
    real_images = glob.glob(os.path.join(REAL_DIR, "**", "*.jpg"), recursive=True) + \
                  glob.glob(os.path.join(REAL_DIR, "**", "*.png"), recursive=True)
    
    # Shuffle and cap to match spec
    random.shuffle(real_images)
    real_images = real_images[:6000] 
    
    real_count = 0
    for img_path in real_images:
        if process_image(img_path, "real", real_count):
            real_count += 1
            if real_count % 1000 == 0: print(f"    Processed {real_count} REAL images")

    # Process FAKE images (MIXED) (Target: ~7,000)
    print("[-] Processing FAKE images (StyleGAN/Diffusion)...")
    fake_images = glob.glob(os.path.join(FAKE_DIR, "**", "*.jpg"), recursive=True) + \
                  glob.glob(os.path.join(FAKE_DIR, "**", "*.png"), recursive=True)
    
    random.shuffle(fake_images)
    fake_images = fake_images[:8000]
    
    fake_count = 0
    for img_path in fake_images:
        if process_image(img_path, "fake", fake_count):
            fake_count += 1
            if fake_count % 1000 == 0: print(f"    Processed {fake_count} FAKE images")

    print("\n---------- Dataset Summary ----------")
    print(f"REAL Images: {real_count} (Saved for both models)")
    print(f"FAKE Images: {fake_count} (Saved for both models)")
    print(f"Dataset generated at {IMAGE_SIZE}x{IMAGE_SIZE} with JPEG/Noise augmentations applied.")
    print("-------------------------------------")

if __name__ == "__main__":
    # Note: Requires raw images to be placed in datasets/raw_images/real and /fake
    # build_dataset()
    pass
