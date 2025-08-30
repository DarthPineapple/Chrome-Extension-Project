# Project Checklist

- [ ] **Project Name**: Choose a name for your project. (FocusShield AI) <-- replace this
- [ ] **Project Icons**: Create a logo concept
- [ ] Train the image model
- [ ] Train the text model
- [X] Popup Design
- [X] Blocking Settings appearance
- [X] Management Settings appearance
- [ ] Add more to the whitelist and blacklist
- [ ] Bug Fixes
    - [ ] When creating a new setup, the entered password shows up as failed but works the second time
    - [ ] When logging out, if the incorrect password text was shown before, it is still there

# Migration Steps
1. Install git/github desktop on the new computer
2. Make sure all changes from your old computer have been pushed
    - make sure to also type `git status` afterwords to make sure you are synced with origin
3. On the new computer, `git clone` the repo, you will probably be prompted for the username and PAT (unless you use github desktop)
4. Create the necessary virtual environments on the new computer to match the original.
    - old machine top venv python version: 3.13.1
    - old machine image-ai python version: 3.10.6
    - NOTE: to make a venv with a specific version, enter the following command:
    Windows: `py -3.X -m venv venv`
    MacOS: `python3.10 -m venv venv`
    - once you have the venv setup and ACTIVATED, enter this command to install from requirements.txt:
    `pip install -r requirements.txt`
5. GPU Check, we need to know what version of CUDA you have
    - enter the following command to see the CUDA version:
    `nvcc --version`
    - look for the pytorch installation for the correct version here: https://pytorch.org/get-started/locally/
    - NOTE: if the CUDA version you have doesn't show in the site, just substitute the number at the end of the command to the right one (e.g. '...whl/cu126' is to 12.6 as '...whl/cu121' would be to 12.1)
    - uninstall the old torch and torchvision via pip uninstall, and then enter the command from the site (you can delete the torchaudio part if you want in your case)
6. Continue data collection and run dataset.py --> train.py for the image AI, just train.py for the text AI