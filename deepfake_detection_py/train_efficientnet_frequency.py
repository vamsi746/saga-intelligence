"""
Train EfficientNet-B0 Frequency-Domain Guard on Noise Residuals
===============================================================
Input:  datasets/image_realworld/real/ (CelebA-HQ, FFHQ ~6K)
        datasets/image_realworld/fake/ (StyleGAN, SDXL, DiffusionDB ~8K)
Output: image_detector_v5_frequency.pth

Architecture: EfficientNet-B0 with custom dropout+linear head (1 output)
Preprocessing: High-pass noise residual extraction (MedianFilter subtract)
Dataset: ~14,000 real-world images (same as texture, different preprocessing)
Target: ~91% validation accuracy

Note: This model feeds into main.py's image detection pipeline.
      For the video pipeline's ResNet-18 frequency model, use train_image_frequency.py
"""

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms, models
from PIL import Image, ImageFilter
import numpy as np
from tqdm import tqdm

# --- CONFIG ---
DATA_ROOT = r"C:\Users\LakshmiNarayana\deepfake_detection_py"
DATASET_PATH = os.path.join(DATA_ROOT, "datasets", "image_deepfake")
SAVE_PATH = "./image_detector_v5_frequency.pth"
BATCH_SIZE = 32  # B0 is lightweight, can use larger batch
EPOCHS = 12
LR = 1e-4
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- FREQUENCY PREPROCESSING ---
class HighPassResidual(object):
    """
    Extracts high-frequency noise residuals matching main.py's NoiseResidual.
    Effective against GAN and Diffusion noise signatures.
    Logic: Original - MedianBlur = High-Frequency Noise Pattern
    """
    def __call__(self, img):
        img_np = np.array(img).astype(np.float32)
        img_blur = np.array(img.filter(ImageFilter.MedianFilter(size=3))).astype(np.float32)
        residual = img_np - img_blur
        residual = np.clip(residual + 128, 0, 255).astype(np.uint8)
        return Image.fromarray(residual)

# --- DATASET ---
class FrequencyImageDataset(Dataset):
    """
    Loads images, applies high-pass noise residual extraction, then standard transforms.
    Structure: datasets/image_realworld/real/*.jpg and fake/*.jpg
    """
    def __init__(self, root_dir, transform=None):
        self.transform = transform
        self.noise_extractor = HighPassResidual()
        self.samples = []
        
        for label_name, label_id in [("real", 0.0), ("real_diverse", 0.0), ("fake", 1.0), ("fake_raw", 1.0), ("fake_diffusion", 1.0)]:
            class_dir = os.path.join(root_dir, label_name)
            if not os.path.exists(class_dir):
                print(f"[!] Warning: {class_dir} not found")
                continue
            for f in os.listdir(class_dir):
                if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                    self.samples.append((os.path.join(class_dir, f), label_id))
        
        print(f"[*] Loaded {len(self.samples)} images for frequency analysis from {root_dir}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert("RGB")
        
        # Apply noise residual extraction FIRST
        img = self.noise_extractor(img)
        
        if self.transform:
            img = self.transform(img)
        return img, torch.tensor(label, dtype=torch.float32)

def get_efficientnet_b0():
    """
    EXACT architecture matching main.py's get_image_model("b0"):
      EfficientNet-B0 backbone + Dropout(0.3) + Linear(in_features, 1)
    """
    m = models.efficientnet_b0(weights='IMAGENET1K_V1')
    num_ftrs = m.classifier[1].in_features
    m.classifier[1] = nn.Sequential(nn.Dropout(0.3), nn.Linear(num_ftrs, 1))
    return m

def main():
    print(f"[*] Training EfficientNet-B0 Frequency Guard on {DEVICE}")
    print(f"[*] Dataset: {DATASET_PATH}")
    
    # Note: Normalization uses [0.5,0.5,0.5] to match noise residual distribution
    # This matches main.py's frequency transform
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ToTensor(),
        transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
    ])

    dataset = FrequencyImageDataset(DATASET_PATH, transform=train_transform)
    
    if len(dataset) == 0:
        print("[!] No samples found. Ensure datasets/image_realworld/real/ and fake/ have images.")
        return
    
    train_size = int(0.9 * len(dataset))
    val_size = len(dataset) - train_size
    train_ds, val_ds = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0, pin_memory=True)
    
    print(f"[*] Train: {len(train_ds)} | Val: {len(val_ds)}")

    model = get_efficientnet_b0().to(DEVICE)
    
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.AdamW(model.parameters(), lr=LR)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    best_acc = 0.0
    
    for epoch in range(EPOCHS):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        pbar = tqdm(train_loader, desc=f"B0 Freq Epoch {epoch+1}/{EPOCHS}")
        for imgs, labels in pbar:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            
            optimizer.zero_grad()
            outputs = model(imgs).squeeze(1)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            predicted = (torch.sigmoid(outputs) >= 0.5).float()
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
            pbar.set_postfix({
                'loss': f"{loss.item():.4f}",
                'acc': f"{100.*correct/total:.1f}%"
            })
        
        scheduler.step()
        train_acc = 100. * correct / total
        
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
                outputs = model(imgs).squeeze(1)
                predicted = (torch.sigmoid(outputs) >= 0.5).float()
                val_total += labels.size(0)
                val_correct += (predicted == labels).sum().item()
        
        val_acc = 100. * val_correct / val_total
        print(f"[*] Epoch {epoch+1} | Train Acc: {train_acc:.2f}% | Val Acc: {val_acc:.2f}%")
        
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), SAVE_PATH)
            print(f"[+] Best B0 Frequency Model Saved ({val_acc:.2f}%)")

    print(f"\n[DONE] Best EfficientNet-B0 Freq Val Accuracy: {best_acc:.2f}%")
    print(f"[DONE] Weights saved to: {SAVE_PATH}")

if __name__ == "__main__":
    main()
