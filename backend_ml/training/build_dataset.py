import json
import torch
from torch.utils.data import Dataset
from risk_model.features import FeatureProcessor
from risk_model.tokenizer import RiskTokenizer

class RiskDataset(Dataset):
    def __init__(self, data_path, tokenizer, feature_processor, max_len=128):
        self.tokenizer = tokenizer
        self.feature_processor = feature_processor
        self.samples = []
        
        with open(data_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    self.samples.append(json.loads(line))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        item = self.samples[idx]
        text = item.get('text', '')
        category = item.get('category', 'Normal')
        sections = item.get('legal_sections', [])
        label_str = item.get('final_risk', 'LOW')
        
        # Labels
        label_map = {'LOW': 0, 'MEDIUM': 1, 'HIGH': 2}
        label = label_map.get(label_str, 0)

        # 1. Text Encoding
        encoding = self.tokenizer.encode([text])
        input_ids = encoding['input_ids'].squeeze(0) # [seq_len]
        attention_mask = encoding['attention_mask'].squeeze(0) # [seq_len]

        # 2. Categorical Features
        cat_features = self.feature_processor.process(category, sections)
        
        return {
            'input_ids': input_ids,
            'attention_mask': attention_mask,
            'categorical_features': torch.tensor(cat_features, dtype=torch.float32),
            'labels': torch.tensor(label, dtype=torch.long)
        }
