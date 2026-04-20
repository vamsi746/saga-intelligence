"""
CLIP-Based AI Image Detector
=============================
1. Extracts CLIP ViT-B/32 features from existing dataset + modern AI samples
2. Trains a lightweight linear classifier (LogisticRegression)
3. Saves the classifier weights for integration into main.py

Training data:
- REAL: 7,000 CelebA-HQ/FFHQ faces from datasets/image_deepfake/real/
- FAKE (legacy): 7,853 StyleGAN from datasets/image_deepfake/fake/
- FAKE (modern): Gemini/ChatGPT samples from Downloads folder
"""
import os
import torch
import numpy as np
from PIL import Image
from tqdm import tqdm
import open_clip
import pickle
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
BATCH_SIZE = 64
FEATURES_CACHE = "clip_features_cache.npz"
MODEL_SAVE_PATH = "clip_ai_detector.pkl"

DATASET_ROOT = r"C:\Users\LakshmiNarayana\deepfake_detection_py\datasets\image_deepfake"
DOWNLOADS = r"C:\Users\LakshmiNarayana\Downloads"

def get_image_paths():
    """Collect all image paths with labels."""
    real_paths = []
    fake_paths = []
    
    # 1. Real images from training dataset
    real_dir = os.path.join(DATASET_ROOT, "real")
    if os.path.exists(real_dir):
        for f in os.listdir(real_dir):
            if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                real_paths.append(os.path.join(real_dir, f))
    
    # 2. Legacy fake (StyleGAN) from training dataset
    fake_dir = os.path.join(DATASET_ROOT, "fake")
    if os.path.exists(fake_dir):
        for f in os.listdir(fake_dir):
            if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                fake_paths.append(os.path.join(fake_dir, f))
    
    # 3. Modern AI samples from Downloads
    modern_ai_patterns = [
        "Gemini_Generated_Image",
        "gemtest",
        "ChatGPT Image",
    ]
    if os.path.exists(DOWNLOADS):
        for f in os.listdir(DOWNLOADS):
            if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                if any(pat.lower() in f.lower() for pat in modern_ai_patterns):
                    fake_paths.append(os.path.join(DOWNLOADS, f))
    
    print(f"[*] Dataset: {len(real_paths)} real, {len(fake_paths)} fake")
    return real_paths, fake_paths

def extract_features(image_paths, model, preprocess, batch_size=BATCH_SIZE):
    """Extract CLIP features in batches."""
    all_features = []
    
    for i in tqdm(range(0, len(image_paths), batch_size), desc="Extracting"):
        batch_paths = image_paths[i:i+batch_size]
        images = []
        for p in batch_paths:
            try:
                img = Image.open(p).convert("RGB")
                images.append(preprocess(img))
            except Exception as e:
                # Skip corrupt images
                images.append(preprocess(Image.new("RGB", (224, 224))))
        
        batch_tensor = torch.stack(images).to(DEVICE)
        with torch.no_grad(), torch.amp.autocast(device_type="cuda"):
            features = model.encode_image(batch_tensor)
            features = features / features.norm(dim=-1, keepdim=True)  # L2 normalize
        
        all_features.append(features.cpu().numpy())
    
    return np.vstack(all_features)

def main():
    print(f"[*] Device: {DEVICE}")
    
    # Load CLIP model
    print("[*] Loading CLIP ViT-B/32...")
    model, _, preprocess = open_clip.create_model_and_transforms(
        'ViT-B-32', pretrained='laion2b_s34b_b79k'
    )
    model = model.to(DEVICE)
    model.eval()
    print("[*] CLIP loaded.")
    
    # Get image paths
    real_paths, fake_paths = get_image_paths()
    
    # Check cache
    if os.path.exists(FEATURES_CACHE):
        print(f"[*] Loading cached features from {FEATURES_CACHE}...")
        data = np.load(FEATURES_CACHE)
        X, y = data['X'], data['y']
        print(f"[*] Cached: {X.shape[0]} samples, {X.shape[1]} features")
    else:
        # Extract features
        print("[*] Extracting CLIP features from REAL images...")
        real_features = extract_features(real_paths, model, preprocess)
        
        print("[*] Extracting CLIP features from FAKE images...")
        fake_features = extract_features(fake_paths, model, preprocess)
        
        # Build dataset
        X = np.vstack([real_features, fake_features])
        y = np.array([0] * len(real_features) + [1] * len(fake_features))
        
        # Cache for re-runs
        np.savez_compressed(FEATURES_CACHE, X=X, y=y)
        print(f"[*] Features cached to {FEATURES_CACHE}")
    
    # Train/val split
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )
    print(f"[*] Train: {len(X_train)}, Val: {len(X_val)}")
    
    # Train logistic regression
    print("[*] Training LogisticRegression classifier...")
    clf = LogisticRegression(
        C=1.0,
        max_iter=1000,
        solver='lbfgs',
        class_weight='balanced',  # Handle class imbalance
        random_state=42
    )
    clf.fit(X_train, y_train)
    
    # Evaluate
    y_pred_train = clf.predict(X_train)
    y_pred_val = clf.predict(X_val)
    
    train_acc = accuracy_score(y_train, y_pred_train)
    val_acc = accuracy_score(y_val, y_pred_val)
    
    print(f"\n[*] Train Accuracy: {train_acc*100:.2f}%")
    print(f"[*] Val Accuracy:   {val_acc*100:.2f}%")
    print(f"\n{classification_report(y_val, y_pred_val, target_names=['REAL', 'FAKE'])}")
    
    # Test on known modern AI images
    print("\n[*] Testing on modern AI samples...")
    test_images = [
        (r"C:\Users\LakshmiNarayana\Downloads\testnow.jpeg", "REAL"),
        (r"C:\Users\LakshmiNarayana\Downloads\gemtest.png", "FAKE-Gemini"),
        (r"C:\Users\LakshmiNarayana\Downloads\Gemini_Generated_Image_86k5g486k5g486k5.png", "FAKE-Gemini"),
        (r"C:\Users\LakshmiNarayana\Downloads\Gemini_Generated_Image_otibwzotibwzotib.png", "FAKE-Gemini"),
        (r"C:\Users\LakshmiNarayana\Downloads\Gemini_Generated_Image_pkd4ospkd4ospkd4.png", "FAKE-Gemini"),
        (r"C:\Users\LakshmiNarayana\Downloads\ChatGPT Image Feb 18, 2026, 09_28_24 PM.png", "FAKE-ChatGPT"),
        (r"C:\Users\LakshmiNarayana\Downloads\ChatGPT Image Feb 23, 2026, 10_56_28 AM.png", "FAKE-ChatGPT"),
    ]
    
    for path, label in test_images:
        if not os.path.exists(path):
            continue
        img = Image.open(path).convert("RGB")
        img_tensor = preprocess(img).unsqueeze(0).to(DEVICE)
        with torch.no_grad(), torch.amp.autocast(device_type="cuda"):
            feat = model.encode_image(img_tensor)
            feat = feat / feat.norm(dim=-1, keepdim=True)
        
        prob = clf.predict_proba(feat.cpu().numpy())[0]
        pred = "FAKE" if prob[1] > 0.5 else "REAL"
        correct = "✓" if (("FAKE" in label and pred == "FAKE") or ("REAL" in label and pred == "REAL")) else "✗"
        print(f"  {correct} {label:<15} → {pred} (fake_prob={prob[1]:.4f})")
    
    # Save model
    with open(MODEL_SAVE_PATH, 'wb') as f:
        pickle.dump(clf, f)
    print(f"\n[*] Classifier saved to {MODEL_SAVE_PATH}")
    print("[*] Done!")

if __name__ == "__main__":
    main()
