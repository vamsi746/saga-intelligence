import timm
print("Timm Version:", timm.__version__)
all_models = timm.list_models()
matching = [m for m in all_models if "timesformer" in m.lower() or "video" in m.lower() or "temporal" in m.lower()]
print("Matching models:", matching)
if not matching:
    print("No matching models found. Searching for 'vit' models that might be temporal...")
    vit_models = [m for m in all_models if "vit_" in m.lower()][:10]
    print("Some ViT models:", vit_models)
