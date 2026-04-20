import torch
import numpy as np

class FeatureProcessor:
    def __init__(self):
        # We define a fixed vocabulary for auxiliary features to ensure consistency
        self.category_map = {
            "Threat": 0, "Hate_Speech": 1, "Sexual_Violence": 2, "Harassment": 3, 
            "Abusive": 4, "Communal_Violence": 5, "Hate_Speech_Threat": 6, 
            "Hate_Speech_Threat_Extremist": 7, "Misinformation": 8, "Sexual_Harassment": 9, 
            "Normal": 10, "Communal_Content": 11, "threat_incitement": 12, "thread": 13 
        }
        
        # BNS Sections of interest
        self.section_map = {
            "152": 0, "196": 1, "197": 2, "299": 3, "351": 4, "352": 5, 
            "353(2)": 6, "356": 7, "72": 8, "74": 9, "79": 10
        }

        self.input_dim = len(self.category_map) + len(self.section_map)

    def process(self, category, legal_sections):
        """
        Converts category and legal sections into a one-hot encoded vector.
        Vector = [Category_OneHost] + [Legal_MultiHot]
        """
        # 1. Category One-Hot
        cat_vec = np.zeros(len(self.category_map), dtype=np.float32)
        if category in self.category_map:
            cat_vec[self.category_map[category]] = 1.0
        
        # 2. Legal Sections Multi-Hot
        sec_vec = np.zeros(len(self.section_map), dtype=np.float32)
        for sec in legal_sections:
            # Handle "BNS 196" or just "196"
            sec = str(sec).replace("BNS ", "").strip()
            if sec in self.section_map:
                sec_vec[self.section_map[sec]] = 1.0
        
        # Concatenate
        return np.concatenate([cat_vec, sec_vec])

    def get_input_dim(self):
        return self.input_dim
