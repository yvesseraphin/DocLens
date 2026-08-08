from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

torch.set_num_threads(1)
torch.set_num_interop_threads(1)

_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

_model: nn.Module | None = None


def get_model() -> nn.Module:
    global _model
    if _model is None:
        base = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
        base.fc = nn.Identity()
        base.eval()
        _model = base
    return _model


def release_model() -> None:
    global _model
    _model = None


def embed(crop: Image.Image) -> np.ndarray:
    model = get_model()
    tensor = _transform(crop.convert("RGB")).unsqueeze(0)
    with torch.inference_mode():
        feat = model(tensor)
    vec = feat.squeeze().cpu().numpy().flatten().astype(np.float32)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def to_tensor(crop: Image.Image) -> torch.Tensor:
    return _transform(crop.convert("RGB")).unsqueeze(0)
