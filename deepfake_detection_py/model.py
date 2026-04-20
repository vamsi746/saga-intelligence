import torch
import torch.nn as nn
import timm
from torchvision import models
from peft import LoraConfig, get_peft_model

class DeepfakeSwinLoRA(nn.Module):
    def __init__(self, pretrained=True):
        super(DeepfakeSwinLoRA, self).__init__()
        # 1. Load Backbone (Swin Base)
        print("[*] Initializing Swin Transformer Base...")
        self.model = timm.create_model(
            "swin_base_patch4_window7_224", 
            pretrained=pretrained, 
            num_classes=2
        )
        
        # 2. Configure LoRA
        # We target the 'qkv' and 'proj' layers in the attention blocks
        config = LoraConfig(
            r=16,
            lora_alpha=32,
            target_modules=["qkv", "proj"],
            lora_dropout=0.1,
            bias="none",
            modules_to_save=["head"] # Final linear layer
        )
        
        # 3. Apply LoRA
        self.model = get_peft_model(self.model, config)
        print("[+] LoRA Adapters injected successfully.")

    def forward(self, x):
        return self.model(x)

    def print_trainable_parameters(self):
        self.model.print_trainable_parameters()

from timesformer_pytorch import TimeSformer

class DeepfakeTimeSformer(nn.Module):
    """Legacy TimeSformer wrapper — kept for backward compatibility."""
    def __init__(self, pretrained=True, num_frames=16):
        super(DeepfakeTimeSformer, self).__init__()
        print(f"[*] Initializing TimeSformer (Temporal Transformer) with {num_frames} frames...")
        self.model = TimeSformer(
            dim = 512,
            image_size = 224,
            patch_size = 16,
            num_frames = num_frames,
            num_classes = 2,
            depth = 8,
            heads = 8,
            dim_head = 64,
            attn_dropout = 0.1,
            ff_dropout = 0.1
        )
        
    def forward(self, x):
        # x shape: (batch_size, num_frames, 3, 224, 224)
        return self.model(x)

class DeepfakeTemporalCNN(nn.Module):
    """Pretrained R3D-18 (Kinetics-400) for temporal deepfake detection.
    Replaces TimeSformer which cannot train from scratch on small datasets."""
    def __init__(self, pretrained=True, num_frames=16):
        super(DeepfakeTemporalCNN, self).__init__()
        from torchvision.models.video import r3d_18
        print(f"[*] Initializing R3D-18 (Pretrained Temporal CNN) with {num_frames} frames...")
        backbone = r3d_18(weights="KINETICS400_V1" if pretrained else None)
        # Copy all layers as direct attributes (avoids model. prefix in state_dict)
        self.stem = backbone.stem
        self.layer1 = backbone.layer1
        self.layer2 = backbone.layer2
        self.layer3 = backbone.layer3
        self.layer4 = backbone.layer4
        self.avgpool = backbone.avgpool
        self.fc = nn.Linear(backbone.fc.in_features, 2)  # Binary: REAL/FAKE

    def forward(self, x):
        # Input: (B, T, C, H, W) from dataset → R3D needs (B, C, T, H, W)
        x = x.permute(0, 2, 1, 3, 4)
        x = self.stem(x)
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)
        x = self.avgpool(x)
        x = x.flatten(1)
        x = self.fc(x)
        return x

class DeepfakeFrequencyResNet(nn.Module):
    def __init__(self, pretrained=True):
        super(DeepfakeFrequencyResNet, self).__init__()
        print("[*] Initializing ResNet-18 (Frequency Forensic Model)...")
        self.model = models.resnet18(pretrained=pretrained)
        num_ftrs = self.model.fc.in_features
        self.model.fc = nn.Linear(num_ftrs, 2)
        
    def forward(self, x):
        return self.model(x)

def get_model(name="xception", pretrained=True):
    """Factory to return specific model architectures."""
    if name == "xception":
        print(f"[*] Initializing Xception (Spatial Forensic Model) with 512-D Bottleneck...")
        model = timm.create_model("xception", pretrained=pretrained, num_classes=0) 
        model.head = nn.Sequential(
            nn.Linear(2048, 512),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(512, 1)
        )
        def head_forward(x):
            features = model.forward_features(x)
            features = model.forward_head(features, pre_logits=True)
            return model.head(features)
        model.forward = head_forward
        return model
    
    elif name == "frequency":
        return DeepfakeFrequencyResNet(pretrained=pretrained)
        
    return None

if __name__ == "__main__":
    # Test initialization
    model = DeepfakeSwinLoRA(pretrained=False)
    model.print_trainable_parameters()
    
    test_tensor = torch.randn(1, 3, 224, 224)
    output = model(test_tensor)
    print(f"Test output shape: {output.shape}")
