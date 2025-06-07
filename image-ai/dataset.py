import os
import shutil
import random

def generate_label_file(image_path, class_id, label_dest_dir):
    label_file_path = os.path.join(label_dest_dir, os.path.basename(image_path).replace('.jpg', '.txt'))
    with open(label_file_path, 'w') as label_file:
        label_file.write(f"{class_id} 0.5 0.5 1.0 1.0\n")

def split_dataset(source_dir, dest_dir, class_names, train_ratio=0.8, val_ratio=0.1):
    # Ensure destination directories exist
    for split in ['train', 'validation', 'test']:
        os.makedirs(os.path.join(dest_dir, split), exist_ok=True)

    class_to_id = {name: i for i, name in enumerate(class_names)}

    for class_folder in os.listdir(source_dir):
        class_path = os.path.join(source_dir, class_folder)

        if os.path.isdir(class_path):
            # Get all the images in the class folder
            all_images = [f for f in os.listdir(class_path) if f.endswith('.jpg')]
            random.shuffle(all_images)

            train_split = int(len(all_images) * train_ratio)
            val_split = int(len(all_images) * val_ratio)
            # test_split = int(len(all_images) * (1 - train_ratio - val_ratio))
            train_images = all_images[:train_split]
            val_images = all_images[train_split:train_split + val_split]
            test_images = all_images[train_split + val_split:]

            class_id = class_to_id[class_folder]

            # Copy images and generate label files for each split
            for split, images in zip(['train', 'validation', 'test'], [train_images, val_images, test_images]):
                split_dir = os.path.join(dest_dir, split, class_folder)
                os.makedirs(split_dir, exist_ok=True)
                for image in images:
                    src_image_path = os.path.join(class_path, image)
                    dest_image_path = os.path.join(split_dir, image)
                    shutil.copy(src_image_path, dest_image_path)
                    generate_label_file(src_image_path, class_id, split_dir)

if __name__ == "__main__":
    source_directory = "source"
    destination_directory = "dataset"
    class_names = ['none', 'drugs', 'violence', 'gambling', 'social media', 'explicit']
    split_dataset(source_directory, destination_directory, class_names, .6, .2)
    print("Dataset split completed.")