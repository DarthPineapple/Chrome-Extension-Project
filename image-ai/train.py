from ultralytics import YOLO
import torch
import torchvision

def main():
    print("Torch version:", torch.__version__)
    print("Torchvision version:", torchvision.__version__)
    print("CUDA available:", torch.cuda.is_available())
    
    print("MPS available:", torch.backends.mps.is_available())

    if torch.cuda.is_available():
        print("Number of GPUs:", torch.cuda.device_count())
        print("Current GPU:", torch.cuda.current_device())
        print("GPU Name:", torch.cuda.get_device_name(torch.cuda.current_device()))
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        print("Using MPS (Metal Performance Shaders) for macOS.")
        device = torch.device("mps")
    else:
        device = torch.device("cpu")

    # Define paths
    data_config_path = "data.yaml"
    model_save_path = "image_model.pt"

    # Load the YOLO model
    model = YOLO("yolov8n.pt")  # Load a pre-trained YOLOv8 model
    model.train(data=data_config_path, epochs=50, batch=16, imgsz=640, device=device)

    # Evaluate the model
    # results = model.val(data=data_config_path, imgsz=640, device=device)
    # metrics = results.metrics
    # print("Evaluation metrics:", metrics)

    # Save the trained model
    model.save(model_save_path)
    print(f"Model saved to {model_save_path}")

if __name__ == "__main__":
    main()