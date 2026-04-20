import torch
import torch.nn as nn
from transformers import AutoModel, AutoConfig

class RiskScoringModel(nn.Module):
    def __init__(self, model_name="xlm-roberta-base", num_labels=3, num_categorical_features=0):
        super(RiskScoringModel, self).__init__()
        
        self.config = AutoConfig.from_pretrained(model_name)
        self.roberta = AutoModel.from_pretrained(model_name)
        
        # Feature sizes
        self.text_hidden_size = self.config.hidden_size
        self.cat_hidden_size = 32 # Embedding size for auxiliary features
        
        # Categorical Embeddings (Category + Legal Sections)
        # Assuming we project high-dim categorical vectors to a smaller dense vector
        self.cat_projection = nn.Sequential(
            nn.Linear(num_categorical_features, self.cat_hidden_size),
            nn.ReLU(),
            nn.Dropout(0.1)
        )

        # Classifier Head
        # Concatenates [CLS] output + projected categorical features
        self.classifier = nn.Sequential(
            nn.Linear(self.text_hidden_size + self.cat_hidden_size, 256),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(256, num_labels)
        )

    def forward(self, input_ids, attention_mask, categorical_features):
        # 1. Text Encoding
        outputs = self.roberta(input_ids=input_ids, attention_mask=attention_mask)
        cls_output = outputs.last_hidden_state[:, 0, :] # [batch, 768] (CLS token)

        # 2. Categorical Feature Encoding
        # categorical_features shape: [batch, num_features]
        cat_embed = self.cat_projection(categorical_features)

        # 3. Concatenation
        combined = torch.cat((cls_output, cat_embed), dim=1)

        # 4. Classification
        logits = self.classifier(combined)
        
        return logits
