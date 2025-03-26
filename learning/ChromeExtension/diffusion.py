from diffusers import StableDiffusion3Pipeline
import torch

pipe = StableDiffusion3Pipeline.from_pretrained(
    "stabilityai/stable-diffusion-3.5-medium", torch_dtype=torch.bfloat16
).to("mps")

# Recommended if your computer has < 64 GB of RAM
pipe.enable_attention_slicing()
pipe.enable_vae_slicing()
pipe.enable_vae_tiling()
pipe.enable_xformers_memory_efficient_attention()
#pipe.enable_sequential_cpu_offload()
#pipe.enable_model_cpu_offload()

image = pipe(
    prompt="a photo of a cat holding a sign that says hello world",
    negative_prompt="",
    num_inference_steps=3,
    height=512,
    width=512,
    guidance_scale=4.5,
).images[0]

image.save("sd3_hello_world.png")
