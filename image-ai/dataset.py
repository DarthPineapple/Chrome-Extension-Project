import os
import shutil
import random
from typing import List

try:
    from PIL import Image
except ImportError:
    Image = None  # Pillow not installed; PNG conversion disabled

def generate_label_file(image_path, class_id, label_dest_dir):
    base = os.path.splitext(os.path.basename(image_path))[0]
    label_file_path = os.path.join(label_dest_dir, base + '.txt')
    with open(label_file_path, 'w') as label_file:
        label_file.write(f"{class_id} 0.5 0.5 1.0 1.0\n")

def _convert_png_to_jpg(src_png_path: str, dest_jpg_path: str):
    if Image is None:
        raise RuntimeError("Pillow not installed. Run: pip install pillow")
    with Image.open(src_png_path) as im:
        rgb = im.convert("RGB")
        rgb.save(dest_jpg_path, "JPEG", quality=95)

def split_dataset(
    source_dir: str,
    dest_dir: str,
    class_names: List[str],
    train_ratio: float = 0.8,
    val_ratio: float = 0.1,
    convert_png: bool = True
):
    for split in ['train', 'validation', 'test']:
        os.makedirs(os.path.join(dest_dir, split), exist_ok=True)

    class_to_id = {name: i for i, name in enumerate(class_names)}

    for class_folder in os.listdir(source_dir):
        class_path = os.path.join(source_dir, class_folder)
        if not os.path.isdir(class_path):
            continue

        all_images = [
            f for f in os.listdir(class_path)
            if f.lower().endswith(('.jpg', '.jpeg', '.png'))
        ]
        random.shuffle(all_images)

        train_split = int(len(all_images) * train_ratio)
        val_split = int(len(all_images) * val_ratio)

        train_images = all_images[:train_split]
        val_images = all_images[train_split:train_split + val_split]
        test_images = all_images[train_split + val_split:]

        class_id = class_to_id.get(class_folder)
        if class_id is None:
            continue

        for split, images in zip(['train', 'validation', 'test'], [train_images, val_images, test_images]):
            split_dir = os.path.join(dest_dir, split, class_folder)
            os.makedirs(split_dir, exist_ok=True)

            for image in images:
                src_image_path = os.path.join(class_path, image)
                ext = os.path.splitext(image)[1].lower()

                if ext == '.png' and convert_png:
                    dest_image_filename = os.path.splitext(image)[0] + '.jpg'
                    dest_image_path = os.path.join(split_dir, dest_image_filename)
                    _convert_png_to_jpg(src_image_path, dest_image_path)
                else:
                    dest_image_path = os.path.join(split_dir, image)
                    shutil.copy(src_image_path, dest_image_path)

                generate_label_file(dest_image_path, class_id, split_dir)

if __name__ == "__main__":
    source_directory = "source"
    destination_directory = "dataset"
    class_names = ['none', 'drugs', 'violence', 'gambling', 'social media', 'explicit']
    split_dataset(source_directory, destination_directory, class_names, 0.6, 0.2, convert_png=True)
    print("Dataset split completed (PNG supported).")