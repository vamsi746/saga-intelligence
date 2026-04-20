import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import numpy as np
from model import DeepfakeTemporalCNN
from tqdm import tqdm
from torchvision import transforms

# --- CONFIG ---
DATA_ROOT = r"C:\Users\LakshmiNarayana\deepfake_detection_py"
CLIP_DATASET_PATH = os.path.join(DATA_ROOT, "datasets", "video_clips_16f")
SAVE_PATH = "./video_temporal_model.pth"
BATCH_SIZE = 2       # 8GB VRAM constraint
ACCUM_STEPS = 4      # Gradient accumulation → effective batch = 8
NUM_FRAMES = 16
EPOCHS = 12          # Pretrained R3D-18 fine-tuning needs ~10-12 epochs
LR = 3e-4            # Fine-tuning LR (lower than scratch training)
MAX_CLIPS = 6000     # Balanced subset (3K real + 3K fake)
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- DATASET LOADER (Numpy Clips) ---
class TemporalClipDataset(Dataset):
    def __init__(self, root_dir, transform=None):
        self.root_dir = os.path.expanduser(root_dir)
        self.transform = transform
        self.samples = []
        
        for label, class_dir in enumerate(['real', 'fake']):
            path = os.path.join(self.root_dir, class_dir)
            if not os.path.exists(path): continue
            for clip_file in os.listdir(path):
                if clip_file.endswith('.npy'):
                    self.samples.append((os.path.join(path, clip_file), label))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        clip_path, label = self.samples[idx]
        # Load (T, H, W, C)
        clip = np.load(clip_path) 
        
        # Convert to tensor and transform
        # TimeSformer (via timm) expects (T, C, H, W)
        processed_frames = []
        for frame in clip:
            if self.transform:
                # transform expects (C, H, W)
                frame = self.transform(frame)
            processed_frames.append(frame)
        
        clip_tensor = torch.stack(processed_frames) # (T, C, H, W)
        return clip_tensor, label

def main():
    # ImageNet normalization for ViT backend
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    # 1. Dataset
    print(f"[*] Loading Temporal Clips from {CLIP_DATASET_PATH}...")
    full_dataset = TemporalClipDataset(CLIP_DATASET_PATH, transform=transform)
    
    # Subsample for practical training time on laptop GPU
    if len(full_dataset) > MAX_CLIPS:
        import random
        random.seed(42)
        indices = random.sample(range(len(full_dataset)), MAX_CLIPS)
        dataset = torch.utils.data.Subset(full_dataset, indices)
        print(f"[*] Subsampled {MAX_CLIPS} clips from {len(full_dataset)} total")
    else:
        dataset = full_dataset
    
    train_size = int(0.9 * len(dataset))
    val_size = len(dataset) - train_size
    train_ds, val_ds = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    # 2. Model (Pretrained R3D-18 — Kinetics-400)
    model = DeepfakeTemporalCNN(pretrained=True, num_frames=NUM_FRAMES).to(DEVICE)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=LR, steps_per_epoch=len(train_loader) // ACCUM_STEPS,
        epochs=EPOCHS, pct_start=0.1
    )

    # 3. Training Loop (with gradient accumulation)
    best_acc = 0.0
    for epoch in range(EPOCHS):
        model.train()
        running_loss = 0.0
        optimizer.zero_grad()
        pbar = tqdm(train_loader, desc=f"Video Training Epoch {epoch+1}")
        
        for step, (clips, labels) in enumerate(pbar):
            clips, labels = clips.to(DEVICE), labels.to(DEVICE)
            
            outputs = model(clips)
            loss = criterion(outputs, labels) / ACCUM_STEPS
            loss.backward()
            
            if (step + 1) % ACCUM_STEPS == 0:
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad()
            
            running_loss += loss.item() * ACCUM_STEPS
            pbar.set_postfix({'loss': f"{loss.item() * ACCUM_STEPS:.4f}"})
            
        # Validation
        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for clips, labels in val_loader:
                clips, labels = clips.to(DEVICE), labels.to(DEVICE)
                outputs = model(clips)
                _, pred = torch.max(outputs.data, 1)
                total += labels.size(0)
                correct += (pred == labels).sum().item()
        
        acc = (correct / total) * 100
        print(f"[*] Epoch {epoch+1} Loss: {running_loss/len(train_loader):.4f} | Val Acc: {acc:.2f}%")
        
        if acc > best_acc:
            best_acc = acc
            print(f"[+] saving video_temporal_model.pth ({acc:.2f}%)")
            torch.save(model.state_dict(), SAVE_PATH)

if __name__ == "__main__":
    main()
