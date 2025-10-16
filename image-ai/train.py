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
        device = "cuda"
    elif torch.backends.mps.is_available():
        print("Using MPS (Metal Performance Shaders) for macOS.")
        device = "mps"
    else:
        device = "cpu"

    # Define paths
    data_config_path = "data.yaml"
    model_save_path = "image_model.pt"

    # Load the YOLO model
    model = YOLO("yolov8n.pt")  # Load a pre-trained YOLOv8 model
    
    # Train with comprehensive settings
    results = model.train(
        data=data_config_path,
        epochs=50,
        batch=16,
        imgsz=640,
        device=device,
        patience=10,  # Early stopping patience
        save=True,  # Save checkpoints
        save_period=5,  # Save checkpoint every 5 epochs
        val=True,  # Run validation
        plots=True,  # Save training plots
        verbose=True,  # Verbose output
        name="yolo_training",  # Name for this training run
        exist_ok=True,  # Overwrite existing run
        pretrained=True,
        optimizer='Adam',
        lr0=0.001,  # Initial learning rate
        lrf=0.01,  # Final learning rate (lr0 * lrf)
        momentum=0.937,
        weight_decay=0.0005,
    )

    # Evaluate the model on validation set
    print("\n" + "="*50)
    print("Running final validation...")
    print("="*50)
    val_results = model.val(data=data_config_path, imgsz=640, device=device)
    
    # Print metrics
    print("\nFinal Validation Metrics:")
    print(f"  mAP50: {val_results.box.map50:.4f}")
    print(f"  mAP50-95: {val_results.box.map:.4f}")
    print(f"  Precision: {val_results.box.mp:.4f}")
    print(f"  Recall: {val_results.box.mr:.4f}")

    # Save the trained model
    model.save(model_save_path)
    print(f"\nModel saved to {model_save_path}")
    
    # Also export to ONNX for deployment
    try:
        onnx_path = model_save_path.replace('.pt', '.onnx')
        model.export(format='onnx', imgsz=640)
        print(f"Model exported to ONNX format: {onnx_path}")
    except Exception as e:
        print(f"ONNX export failed: {e}")

if __name__ == "__main__":
    main()