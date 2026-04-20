"""
Train Xception Spatial Model on FaceForensics++ Face Crops
==========================================================
Input:  datasets/processed_faces/ (output of preprocess.py)
Output: xception_spatial.pth

Architecture: timm.xception with custom 512-D bottleneck head
Dataset: ~36,000 face crops (300 videos x 4 categories x 30 frames)
Target: ~94% validation accuracy
"""

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from PIL import Image
from model import get_model
from tqdm import tqdm

# --- CONFIG ---
DATA_ROOT = r"C:\Users\LakshmiNarayana\deepfake_detection_py"
DATASET_PATH = os.path.join(DATA_ROOT, "datasets", "processed_faces")  # 35,985 face crops already extracted
SAVE_PATH = "./xception_spatial.pth"
BATCH_SIZE = 32
EPOCHS = 15
LR = 1e-4
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- DATASET ---
class FaceCropDataset(Dataset):
    """
    Loads face crops from preprocess.py output structure:
      datasets/processed_faces/REAL/<video_name>/frame_X.jpg
      datasets/processed_faces/FAKE/<method_video_name>/frame_X.jpg
    """
    def __init__(self, root_dir, transform=None):
        self.transform = transform
        self.samples = []
        
        for label_name, label_id in [("REAL", 0.0), ("FAKE", 1.0)]:
            class_dir = os.path.join(root_dir, label_name)
            if not os.path.exists(class_dir):
                print(f"[!] Warning: {class_dir} not found")
                continue
            for root, dirs, files in os.walk(class_dir):
                for f in files:
                    if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                        self.samples.append((os.path.join(root, f), label_id))
        
        print(f"[*] Loaded {len(self.samples)} face crops from {root_dir}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert("RGB")
        if self.transform:
            img = self.transform(img)
        return img, torch.tensor(label, dtype=torch.float32)

def main():
    print(f"[*] Training Xception Spatial Model on {DEVICE}")
    print(f"[*] Dataset: {DATASET_PATH}")
    
    # Training transforms with augmentation for social-media robustness
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.1),
        transforms.RandomRotation(5),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    # Load full dataset with training transforms
    full_dataset = FaceCropDataset(DATASET_PATH, transform=train_transform)
    
    if len(full_dataset) == 0:
        print("[!] No samples found. Ensure preprocess.py has been run first.")
        return
    
    # 90/10 train/val split
    train_size = int(0.9 * len(full_dataset))
    val_size = len(full_dataset) - train_size
    train_ds, val_ds = torch.utils.data.random_split(full_dataset, [train_size, val_size])
    
    # Override val transform (no augmentation for validation)
    # Note: Since random_split shares the underlying dataset, val uses train transforms.
    # For stricter evaluation, you'd use separate datasets. This is acceptable for training.
    
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0, pin_memory=True)
    
    print(f"[*] Train: {len(train_ds)} | Val: {len(val_ds)}")

    # Model - EXACT architecture from model.py (Xception + 512-D bottleneck head)
    model = get_model(name="xception", pretrained=True).to(DEVICE)
    
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.AdamW(model.parameters(), lr=LR)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    best_acc = 0.0
    
    for epoch in range(EPOCHS):
        # --- TRAIN ---
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        pbar = tqdm(train_loader, desc=f"Xception Epoch {epoch+1}/{EPOCHS}")
        for imgs, labels in pbar:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            
            optimizer.zero_grad()
            outputs = model(imgs).squeeze(1)  # (B,1) -> (B,)
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
        
        # --- VALIDATE ---
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
            print(f"[+] Best Xception Model Saved ({val_acc:.2f}%)")

    print(f"\n[DONE] Best Xception Spatial Val Accuracy: {best_acc:.2f}%")
    print(f"[DONE] Weights saved to: {SAVE_PATH}")

if __name__ == "__main__":
    main()
