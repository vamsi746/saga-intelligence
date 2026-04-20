import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms, datasets
from model import DeepfakeSwinLoRA
from tqdm import tqdm
import matplotlib.pyplot as plt

# --- CONFIG ---
# This path should point to the dataset directory on the machine where you run it
DATASET_PATH = os.path.expanduser("~/deepfake_guard/datasets/image_realworld")
SAVE_PATH = "./image_detector_swin_lora.pth"
BATCH_SIZE = 16
EPOCHS = 10 
LR = 1e-4
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def main():
    # 1. Prepare Data
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    if not os.path.exists(DATASET_PATH):
        print(f"[!] Dataset path {DATASET_PATH} not found. Please ensure datasets are present.")
        return

    full_dataset = datasets.ImageFolder(root=DATASET_PATH, transform=transform)
    train_size = int(0.9 * len(full_dataset))
    val_size = len(full_dataset) - train_size
    train_ds, val_ds = torch.utils.data.random_split(full_dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=4)

    # 2. Init Model
    model = DeepfakeSwinLoRA().to(DEVICE)
    model.print_trainable_parameters()

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=LR)

    # 3. Training Loop
    best_acc = 0.0
    history = {'loss': [], 'val_acc': []}

    for epoch in range(EPOCHS):
        model.train()
        running_loss = 0.0
        pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{EPOCHS}")
        
        for imgs, labels in pbar:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            
            optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            pbar.set_postfix({'loss': f"{loss.item():.4f}"})

        avg_loss = running_loss / len(train_loader)
        
        # Val
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
        
        acc = (correct / total) * 100
        print(f"[*] Epoch {epoch+1} finished. Avg Loss: {avg_loss:.4f} | Val Acc: {acc:.2f}%")
        
        history['loss'].append(avg_loss)
        history['val_acc'].append(acc)

        if acc > best_acc:
            best_acc = acc
            print(f"[+] Saved New Best Model: {acc:.2f}%")
            torch.save(model.state_dict(), SAVE_PATH)

    # Save final results
    plt.figure()
    plt.plot(history['loss'], label='Train Loss')
    plt.plot([x/100 for x in history['val_acc']], label='Val Acc (Scaled)')
    plt.legend()
    plt.savefig('swin_lora_training.png')
    print("[*] Local process complete.")

if __name__ == "__main__":
    main()
