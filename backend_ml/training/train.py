import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from risk_model.model import RiskScoringModel
from risk_model.tokenizer import RiskTokenizer
from risk_model.features import FeatureProcessor
from training.build_dataset import RiskDataset
import yaml
import os

def train():
    # Load Config
    with open('configs/training.yaml', 'r') as f:
        config = yaml.safe_load(f)

    # Initialize Components
    tokenizer = RiskTokenizer(config['model']['name'], max_len=config['training']['max_len'])
    feature_processor = FeatureProcessor()
    
    # Load Data
    train_dataset = RiskDataset(config['paths']['train_data'], tokenizer, feature_processor)
    
    if len(train_dataset) == 0:
        print("No training data found. Skipping training.")
        return

    # Optional Validation
    if os.path.exists(config['paths']['val_data']):
        val_dataset = RiskDataset(config['paths']['val_data'], tokenizer, feature_processor)
        val_loader = DataLoader(val_dataset, batch_size=config['training']['batch_size'])
    else:
        val_loader = None
    
    train_loader = DataLoader(train_dataset, batch_size=config['training']['batch_size'], shuffle=True)

    # Model
    model = RiskScoringModel(
        model_name=config['model']['name'], 
        num_labels=config['model']['num_labels'],
        num_categorical_features=feature_processor.get_input_dim()
    )
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model.to(device)
    
    # --- ANTI-CATASTROPHIC FORGETTING ---
    # Use differential learning rates:
    #   - Very low LR for pre-trained Roberta layers (preserve knowledge)
    #   - Higher LR for new classifier head (learn task quickly)
    roberta_lr = float(config['training']['learning_rate'])        # 5e-6 (very gentle)
    classifier_lr = float(config['training'].get('classifier_lr', 2e-4))  # 2e-4 (learns fast)
    weight_decay = float(config['training'].get('weight_decay', 0.01))
    freeze_epochs = int(config['training'].get('freeze_roberta_epochs', 1))

    optimizer = torch.optim.AdamW([
        # Pre-trained backbone: very low learning rate to preserve knowledge
        {'params': model.roberta.parameters(), 'lr': roberta_lr},
        # New classifier layers: higher learning rate to learn the task
        {'params': model.cat_projection.parameters(), 'lr': classifier_lr},
        {'params': model.classifier.parameters(), 'lr': classifier_lr},
    ], weight_decay=weight_decay)

    criterion = nn.CrossEntropyLoss()
    num_epochs = config['training']['num_epochs']

    print(f"Starting Training... ({len(train_dataset)} samples, {num_epochs} epochs)")
    print(f"  Roberta LR: {roberta_lr} (gentle fine-tuning)")
    print(f"  Classifier LR: {classifier_lr} (task-specific learning)")
    print(f"  Freeze Roberta for first {freeze_epochs} epoch(s)")
    
    for epoch in range(num_epochs):
        model.train()
        
        # --- LAYER FREEZING ---
        # Freeze Roberta layers for the first N epochs
        # This forces the model to first learn the task using only the classifier head,
        # then gently adapt the backbone in later epochs.
        if epoch < freeze_epochs:
            for param in model.roberta.parameters():
                param.requires_grad = False
            print(f"Epoch {epoch+1}: Roberta FROZEN (training classifier head only)")
        else:
            for param in model.roberta.parameters():
                param.requires_grad = True
            if epoch == freeze_epochs:
                print(f"Epoch {epoch+1}: Roberta UNFROZEN (gentle fine-tuning)")

        total_loss = 0
        correct = 0
        total = 0
        
        for batch in train_loader:
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            cat_features = batch['categorical_features'].to(device)
            labels = batch['labels'].to(device)

            optimizer.zero_grad()
            logits = model(input_ids, attention_mask, cat_features)
            loss = criterion(logits, labels)
            loss.backward()
            
            # Gradient clipping to prevent exploding gradients
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            
            optimizer.step()
            total_loss += loss.item()
            
            # Track accuracy
            preds = torch.argmax(logits, dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)
        
        avg_loss = total_loss / len(train_loader)
        accuracy = correct / total * 100 if total > 0 else 0
        print(f"Epoch {epoch+1}/{num_epochs} - Loss: {avg_loss:.4f}, Accuracy: {accuracy:.1f}%")

    # Save
    save_path = config['training']['output_dir']
    if not os.path.exists(save_path):
        os.makedirs(save_path)
    
    torch.save(model.state_dict(), os.path.join(save_path, "pytorch_model.bin"))
    tokenizer.save_pretrained(save_path)
    print(f"Model saved to {save_path}")

if __name__ == "__main__":
    train()
