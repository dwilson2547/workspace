from pathlib import Path
from PIL import Image
import cv2
from sqlalchemy import select
from db.library_db import get_library_session
from db.models_library import MediaItem

MODEL_ID = "Salesforce/blip2-opt-2.7b"
_processor = None
_model = None


def _get_model(model_root: str):
    global _processor, _model
    if _processor is None:
        from transformers import Blip2Processor, Blip2ForConditionalGeneration
        import torch
        cache_dir = str(Path(model_root) / "blip2")
        _processor = Blip2Processor.from_pretrained(MODEL_ID, cache_dir=cache_dir)
        _model = Blip2ForConditionalGeneration.from_pretrained(
            MODEL_ID, cache_dir=cache_dir, torch_dtype=torch.float32
        )
        _model.eval()
    return _processor, _model


def run_blip_task(
    task_id: int, task_type: str, media_item_id: int, library_name: str, data_root: str
) -> None:
    import torch
    from db.library_db import init_library_db
    init_library_db(Path(data_root), library_name)
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        item = db.scalar(select(MediaItem).where(MediaItem.id == media_item_id))
        if not item:
            raise ValueError(f"MediaItem {media_item_id} not found")

        image = _get_representative_image(item)
        if image is None:
            return  # gen.close() in finally will still run

        model_root = str(Path(data_root) / "models")
        processor, model = _get_model(model_root)

        inputs = processor(images=image, return_tensors="pt")
        with torch.no_grad():
            ids = model.generate(**inputs, max_new_tokens=50)
        caption = processor.batch_decode(ids, skip_special_tokens=True)[0].strip()

        item.blip_description = caption
        db.commit()
    finally:
        gen.close()


def _get_representative_image(item) -> Image.Image | None:
    if item.media_type == "image":
        try:
            return Image.open(item.file_path).convert("RGB")
        except Exception:
            return None

    cap = cv2.VideoCapture(item.file_path)
    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.set(cv2.CAP_PROP_POS_FRAMES, total // 2)
        ret, frame = cap.read()
    finally:
        cap.release()
    if ret:
        return Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    return None
