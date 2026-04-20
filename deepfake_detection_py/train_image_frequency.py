import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import numpy as np
from PIL import Image, ImageFilter
from torchvision import transforms, models
from tqdm import tqdm

# --- CONFIG ---
DATA_ROOT = r"C:\Users\LakshmiNarayana\deepfake_detection_py"
DATASET_PATH = os.path.join(DATA_ROOT, "datasets", "image_deepfake") # Mix folder
SAVE_PATH = "./image_frequency_model.pth"
BATCH_SIZE = 32
EPOCHS = 10
LR = 1e-4
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- FREQUENCY PREPROCESSING ---
class HighPassResidual(object):
    """
    Extracts high-frequency noise residuals.
    Effective against GAN and Diffusion noise signatures.
    """
    def __call__(self, img):
        img_np = np.array(img).astype(np.float32)
        # Apply Median filter to get 'smooth' version
        img_blur = np.array(img.filter(ImageFilter.MedianFilter(size=3))).astype(np.float32)
        # Residual = Original - Blur (High Frequency)
        residual = img_np - img_blur
        # Normalize to 0-255 range for ResNet input
        residual = np.clip(residual + 128, 0, 255).astype(np.uint8)
        return Image.fromarray(residual)

# --- DATASET LOADER ---
class FrequencyDataset(Dataset):
    def __init__(self, root_dir, transform=None):
        self.root_dir = os.path.expanduser(root_dir)
        self.transform = transform
        self.samples = []
        
        # Expecting 'real' and 'fake' subfolders
        for class_dir, label in [('real', 0), ('fake', 1), ('fake_raw', 1)]:
            path = os.path.join(self.root_dir, class_dir)
            if not os.path.exists(path): continue
            for img in os.listdir(path):
                if img.lower().endswith(('.png', '.jpg', '.jpeg')):
                    self.samples.append((os.path.join(path, img), label))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert('RGB')
        
        # 1. Resize FIRST (huge speedup — MedianFilter on 224x224 vs 1024x1024)
        img = img.resize((224, 224), Image.BILINEAR)
        
        # 2. Apply High-Pass Filter on small image
        img = HighPassResidual()(img)
        
        # 3. Apply standard transforms (ToTensor + Normalize only)
        if self.transform:
            img = self.transform(img)
            
        return img, label

def main():
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]) # Mirrored to residual stats
    ])

    # 1. Load Data
    dataset = FrequencyDataset(DATASET_PATH, transform=transform)
    train_size = int(0.9 * len(dataset))
    val_size = len(dataset) - train_size
    train_ds, val_ds = torch.utils.data.random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    # 2. Model: ResNet-18 (Lightweight for speed)
    print("[*] Initializing Frequency-Domain ResNet-18...")
    model = models.resnet18(pretrained=True)
    num_ftrs = model.fc.in_features
    model.fc = nn.Linear(num_ftrs, 2) # Binary: REAL/FAKE
    model = model.to(DEVICE)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=LR)

    # 3. Training Loop
    best_acc = 0.0
    for epoch in range(EPOCHS):
        model.train()
        running_loss = 0.0
        pbar = tqdm(train_loader, desc=f"Freq Training Epoch {epoch+1}")
        
        for imgs, labels in pbar:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            
            optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            pbar.set_postfix({'loss': f"{loss.item():.4f}"})

        # Validation
        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
                outputs = model(imgs)
                _, pred = torch.max(outputs.data, 1)
                total += labels.size(0)
                correct += (pred == labels).sum().item()
        
        acc = 100 * correct / total
        print(f"[*] Epoch {epoch+1} Loss: {running_loss/len(train_loader):.4f} | Val Acc: {acc:.2f}%")
        
        if acc > best_acc:
            best_acc = acc
            print(f"[+] Saved Best Frequency Model ({acc:.2f}%)")
            torch.save(model.state_dict(), SAVE_PATH)

if __name__ == "__main__":
    main()
