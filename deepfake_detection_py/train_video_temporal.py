import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
import os
from tqdm import tqdm
from timesformer_pytorch import TimeSformer

# --- CONFIG ---
DATA_ROOT = r"C:\Users\LakshmiNarayana\deepfake_detection_py"
PROCESSED_CLIP_PATH = os.path.join(DATA_ROOT, "datasets", "video_clips_16f")
CHECKPOINT_DIR = "./checkpoints/video_temporal"
BATCH_SIZE = 2 # Reduced for 8GB VRAM (TimeSformer is memory-heavy)
EPOCHS = 20
LR = 1e-5
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Clean up memory before starting
if torch.cuda.is_available():
    torch.cuda.empty_cache()

class FFVideoDataset(Dataset):
    def __init__(self, root_dir, split='train'):
        self.root_dir = os.path.expanduser(root_dir)
        self.samples = []
        
        for label in ['real', 'fake']:
            class_path = os.path.join(self.root_dir, label)
            if not os.path.exists(class_path): continue
            
            files = [f for f in os.listdir(class_path) if f.endswith('.npy')]
            # Sort to ensure consistency
            files.sort()
            
            # 80/20 Split
            split_idx = int(len(files) * 0.8)
            if split == 'train':
                files = files[:split_idx]
            else:
                files = files[split_idx:]
                
            for f in files:
                self.samples.append((os.path.join(class_path, f), 1 if label == 'fake' else 0))
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        path, label = self.samples[idx]
        # Load clip (T, H, W, C) -> (T, C, H, W)
        clip = np.load(path)
        clip = torch.from_numpy(clip).float() / 255.0
        clip = clip.permute(0, 3, 1, 2)
        return clip, label

def train():
    os.makedirs(os.path.expanduser(CHECKPOINT_DIR), exist_ok=True)
    
    train_ds = FFVideoDataset(PROCESSED_CLIP_PATH, split='train')
    val_ds = FFVideoDataset(PROCESSED_CLIP_PATH, split='val')
    
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    
    # Initialize TimeSformer
    model = TimeSformer(
        dim = 512,
        image_size = 224,
        patch_size = 16,
        num_frames = 16,
        num_classes = 2,
        depth = 8,
        heads = 8,
        dim_head = 64,
        attn_dropout = 0.1,
        ff_dropout = 0.1
    ).to(DEVICE)
    
    # --- RESUME LOGIC ---
    checkpoint_path = os.path.expanduser(os.path.join(CHECKPOINT_DIR, "best_timesformer.pth"))
    start_epoch = 0
    if os.path.exists(checkpoint_path):
        print(f"[*] Loading checkpoint from {checkpoint_path}...")
        model.load_state_dict(torch.load(checkpoint_path, map_location=DEVICE))
        print("[*] Resuming from saved state.")
        # We start from where we left off (Epoch 4 if we finished 3)
        start_epoch = 3 
    # ------------------

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=LR)
    
    best_acc = 0.0 # Will be updated after first val
    
    for epoch in range(start_epoch, EPOCHS):
        model.train()
        train_loss = 0
        correct = 0
        total = 0
        
        pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{EPOCHS}")
        for clips, labels in pbar:
            clips, labels = clips.to(DEVICE), labels.to(DEVICE)
            
            optimizer.zero_grad()
            outputs = model(clips)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
            
            pbar.set_postfix({'Loss': train_loss / (total/BATCH_SIZE), 'Acc': 100.*correct/total})
            
        # Validation
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for clips, labels in val_loader:
                clips, labels = clips.to(DEVICE), labels.to(DEVICE)
                outputs = model(clips)
                _, predicted = outputs.max(1)
                val_total += labels.size(0)
                val_correct += predicted.eq(labels).sum().item()
        
        val_acc = 100. * val_correct / val_total
        print(f"Validation Accuracy: {val_acc:.2f}%")
        
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), os.path.expanduser(os.path.join(CHECKPOINT_DIR, "best_timesformer.pth")))
            print("--- Best Model Saved ---")

if __name__ == "__main__":
    train()
