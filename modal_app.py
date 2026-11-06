"""
Modal app for phip-seq-tile-visualizer development

This app provides:
- Code storage in Modal volumes
- Remote development environment
- Build and deployment capabilities
"""

import modal
import os
from pathlib import Path

# Create Modal app
app = modal.App("phip-seq-visualizer")

# Create or reference volumes
code_volume = modal.Volume.from_name("visualizer-code", create_if_missing=True)
data_volume = modal.Volume.from_name("research-data", create_if_missing=False)

# Define the container image with Node.js and Python
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("curl", "git", "wget", "vim", "nano")
    .run_commands(
        # Install Node.js 20.x
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
    )
)


@app.function(
    image=image,
    volumes={"/code": code_volume},
    timeout=3600,
)
def sync_code_to_modal():
    """
    Upload local codebase to Modal volume.
    Run this from your local machine to sync code to Modal.
    """
    import subprocess

    local_path = Path.cwd()
    remote_path = Path("/code")

    print(f"Syncing {local_path} to Modal volume at {remote_path}")

    # Create directory structure
    remote_path.mkdir(exist_ok=True)

    # Copy files (excluding node_modules, .git, etc.)
    exclude_patterns = [
        "node_modules",
        ".git",
        "dist",
        "__pycache__",
        "*.pyc",
        ".DS_Store",
    ]

    import shutil
    for item in local_path.iterdir():
        if item.name not in exclude_patterns and not item.name.startswith('.'):
            dest = remote_path / item.name
            if item.is_file():
                shutil.copy2(item, dest)
                print(f"  Copied {item.name}")
            elif item.is_dir():
                if dest.exists():
                    shutil.rmtree(dest)
                shutil.copytree(item, dest)
                print(f"  Copied {item.name}/")

    code_volume.commit()
    print("Code synced to Modal volume successfully!")
    return str(remote_path)


@app.function(
    image=image,
    volumes={
        "/code": code_volume,
        "/data": data_volume,
    },
    timeout=3600,
)
def install_dependencies():
    """Install npm dependencies on Modal"""
    import subprocess

    os.chdir("/code")
    print("Installing npm dependencies...")
    subprocess.run(["npm", "install"], check=True)
    code_volume.commit()
    print("Dependencies installed successfully!")


@app.function(
    image=image,
    volumes={"/code": code_volume},
    timeout=3600,
)
def build_app():
    """Build the application on Modal"""
    import subprocess

    os.chdir("/code")
    print("Building application...")
    result = subprocess.run(["npm", "run", "build"], capture_output=True, text=True)
    print(result.stdout)
    if result.returncode != 0:
        print("Build errors:", result.stderr)
        raise Exception("Build failed")

    code_volume.commit()
    print("Build completed successfully!")
    return "Build complete"


@app.function(
    image=image,
    volumes={
        "/code": code_volume,
        "/data": data_volume,
    },
    timeout=7200,
)
def dev_shell():
    """
    Open an interactive shell in the Modal environment.
    Use: modal shell modal_app.py::app.dev_shell
    """
    import subprocess

    os.chdir("/code")
    print("\n" + "="*60)
    print("Welcome to the phip-seq-visualizer Modal development shell!")
    print("Working directory: /code")
    print("Data volume mounted at: /data")
    print("")
    print("Available tools:")
    print("  - Node.js & npm (for building and running the app)")
    print("  - Python 3.11 (for data processing scripts)")
    print("  - Git (for version control)")
    print("  - vim/nano (for editing)")
    print("")
    print("Try: npm install, npm run build, or python scripts/<script>")
    print("="*60 + "\n")

    # Start interactive bash session
    subprocess.run(["/bin/bash"], check=False)


@app.function(
    image=image,
    volumes={"/code": code_volume},
    timeout=600,
)
def run_python_script(script_name: str):
    """Run a Python script from the scripts directory"""
    import subprocess

    os.chdir("/code")
    script_path = f"scripts/{script_name}"

    if not Path(script_path).exists():
        raise FileNotFoundError(f"Script not found: {script_path}")

    print(f"Running {script_path}...")
    result = subprocess.run(["python", script_path], capture_output=True, text=True)
    print(result.stdout)

    if result.returncode != 0:
        print("Errors:", result.stderr)
        raise Exception(f"Script failed: {script_name}")

    code_volume.commit()
    return result.stdout


@app.function(
    image=image,
    volumes={"/code": code_volume},
)
def list_code_files():
    """List files in the code volume"""
    import subprocess

    result = subprocess.run(
        ["find", "/code", "-type", "f", "-not", "-path", "*/node_modules/*"],
        capture_output=True,
        text=True
    )
    return result.stdout


@app.function(
    image=image,
    volumes={
        "/code": code_volume,
        "/data": data_volume,
    },
    timeout=3600,
)
def run_command(command: str):
    """
    Run an arbitrary shell command in the Modal environment.

    Examples:
        modal run modal_app.py::app.run_command --command "npm run lint"
        modal run modal_app.py::app.run_command --command "npm test"
        modal run modal_app.py::app.run_command --command "ls -la"
    """
    import subprocess

    os.chdir("/code")
    print(f"Running command: {command}")

    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    print(result.stdout)
    if result.stderr:
        print("Stderr:", result.stderr)

    if result.returncode != 0:
        raise Exception(f"Command failed with exit code {result.returncode}")

    code_volume.commit()
    return result.stdout


# Local entrypoint for easy syncing
@app.local_entrypoint()
def main(action: str = "sync"):
    """
    Main entrypoint for Modal operations.

    Usage:
        modal run modal_app.py --action sync       # Sync code to Modal
        modal run modal_app.py --action install    # Install dependencies
        modal run modal_app.py --action build      # Build the app
        modal run modal_app.py --action list       # List files
    """

    if action == "sync":
        print("Syncing code to Modal...")
        # Note: sync_code_to_modal needs to be called differently as it needs local files
        print("To sync code, use: modal volume put visualizer-code . /")
        print("Or use the upload function below")

    elif action == "install":
        install_dependencies.remote()

    elif action == "build":
        result = build_app.remote()
        print(result)

    elif action == "list":
        files = list_code_files.remote()
        print(files)

    else:
        print(f"Unknown action: {action}")
        print("Available actions: sync, install, build, list")
