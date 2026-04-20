from transformers import AutoTokenizer

class RiskTokenizer:
    def __init__(self, model_name="xlm-roberta-base", max_len=128):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.max_len = max_len

    def encode(self, texts):
        return self.tokenizer(
            texts,
            padding='max_length',
            truncation=True,
            max_length=self.max_len,
            return_tensors="pt"
        )

    def save_pretrained(self, path):
        self.tokenizer.save_pretrained(path)
    
    @classmethod
    def from_pretrained(cls, path):
        instance = cls()
        instance.tokenizer = AutoTokenizer.from_pretrained(path)
        return instance
