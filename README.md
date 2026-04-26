# FocusShield AI

FocusShield AI is the current Chrome extension and local AI moderation stack in this repository. The active project combines a Manifest V3 extension, a local image moderation server, and a local text moderation server to hide unsafe content before it is shown in the browser.

## Current project state

The repository has moved beyond the original checklist stage. The main implementation now lives in three active areas:

- `extension/` - the current Chrome extension
- `image-ai/` - the local image model, dataset, training script, and inference server
- `text-ai/` - the local text model, banned-word data, training script, and inference server

There is also older prototype and experiment code still in the repo:

- `extension/server/` - an older Flask + OpenAI-backed prototype that is not the path currently used by the extension background worker
- `learning/` - side experiments, older prototypes, and sandbox work

## What is currently implemented

### Chrome extension

- Manifest V3 extension in `extension/manifest.json`
- Popup UI with:
    - enable/disable toggle
    - blocked content counters UI
    - memory and CPU readouts
    - online/offline health status for the local AI servers
- Password barrier and first-time setup flow via `barrier.html`
- Settings page with:
    - age-based presets (`Ages 3 to 5`, `Ages 6 to 12`, `Ages 13 to 18`)
    - custom blocking mode
    - password change flow
    - confidence threshold control
    - dark mode toggle

### Filtering behavior

- Visible page text is scanned from the content script
- `img` elements and CSS background images are collected for moderation
- Images are temporarily hidden while the extension waits for a server decision
- An Aho-Corasick blacklist matcher (`ac.js`) censors direct keyword matches immediately in the page
- Mutation observers rescan dynamic pages as new content is added
- Requests are batched before being sent to the local Python services

### Local AI services

- `image-ai/server.py` runs a Flask service on port `5003`
- `text-ai/server.py` runs a Flask service on port `5004`
- Both services include:
    - `/health` endpoints
    - basic request validation
    - rate limiting
    - logging
    - CORS rules for local development and Chrome extension requests

## Current moderation pipeline

1. The content script scans visible text and images on the page.
2. Exact blacklist matches are censored immediately in the browser.
3. The background worker batches requests and sends:
     - images to `http://localhost:5003/predict_image`
     - text to `http://localhost:5004/predict_text`
4. The local servers return detections or text spans.
5. The extension either hides or reveals content based on:
     - whether filtering is enabled
     - the selected preset or custom options
     - the configured confidence threshold

## Category coverage right now

The current repo uses a hybrid approach, so category coverage is split across the blacklist and the AI models.

- Local blacklist masking: terms stored in `extension/blacklist.json`
- Image model labels: `none`, `drugs`, `violence`, `gambling`, `social media`, `explicit`
- Text model labels: `drugs`, `explicit`, `gambling`, `social media`, `violence`
- Settings UI currently exposes: `profanity`, `explicit`, `drugs`, `gambling`, `violence`

Notes:

- `profanity` is currently handled through the blacklist-driven text masking flow.
- `social media` exists in the training data and model assets, but it is not fully surfaced in the current settings UI.

## Repository layout

### Active directories

- `extension/` - active Chrome extension code and assets
- `image-ai/` - YOLO-based image moderation model, dataset tools, training script, and inference server
- `text-ai/` - character-level text moderation model, banned-word lists, corpus, training script, and inference server

### Utility scripts

- `banned_to_json.py` - collects category word lists from `text-ai/banned/`
- `blacklist_converter.py` - converts the category-based banned-word JSON into the flattened format used by the extension blacklist matcher

### Legacy or experimental code

- `extension/server/` - older API prototype using OpenAI calls
- `learning/` - experiments and earlier sandbox work
- `build/`, `dist/`, and compiled model artifacts - packaging and training outputs kept in the repo for local use

## Local setup

### Minimum setup to run the current stack

1. Create and activate the Python environments you want to use.
2. Install dependencies for the services you plan to run.
3. Start the local AI servers.
4. Load `extension/` as an unpacked Chrome extension.
5. Open the extension and complete the first-time password setup.
6. Confirm the popup shows the model services as `Online`.

### Dependency notes

- `image-ai/requirements.txt` contains the pinned dependencies for the image server and training pipeline.
- The root `requirements.txt` is for the older OpenAI-based prototype under `extension/server/`.
- `text-ai/` does not currently have its own pinned `requirements.txt`, so that environment still needs to be recreated manually from the imports used in `text-ai/server.py` and the training scripts.

### Starting the current servers

Image server:

```bash
cd image-ai
python server.py
```

Text server:

```bash
cd text-ai
python server.py
```

Chrome extension:

- Open Chrome extensions
- Enable Developer Mode
- Choose **Load unpacked**
- Select the `extension/` folder

## Training and data workflow

### Image model

- Source images live under `image-ai/source/`
- Prepared train/validation/test data lives under `image-ai/dataset/`
- `image-ai/dataset.py` creates dataset splits and YOLO label files
- `image-ai/train.py` trains the YOLO model and saves `image_model.pt`

### Text model

- Banned phrase lists live under `text-ai/banned/`
- General text data lives in `text-ai/corpus.txt`
- `text-ai/train.py` trains the text model and saves `best_model.pth` and `text_model.pt`
- `text-ai/server.py` loads `best_model.pth` for inference and combines model output with blacklist/whitelist filtering

## Environment and migration notes

These were the previously used local Python versions during development:

- root venv: Python `3.13.1`
- `image-ai` venv: Python `3.10.6`

If GPU training is needed on a new machine:

1. Check CUDA with `nvcc --version`
2. Install the PyTorch build that matches the CUDA version on that machine
3. Recreate the image and text environments before running training again

## Packaging notes

PyInstaller commands used in this repo:

### Image AI

```bash
pyinstaller --onefile server.py
```

### Text AI

Windows:

```bash
pyinstaller --onefile --add-data "banned;banned" server.py
```

macOS / Linux:

```bash
pyinstaller --onefile --add-data "banned:banned" server.py
```

## Known gaps / next cleanup items

- The popup already displays blocked text and image counters, but the content script still has TODOs for incrementing those values.
- `text-ai/` still needs a dedicated pinned dependency file.
- The repo still contains legacy prototypes and build artifacts that can be cleaned up later.





