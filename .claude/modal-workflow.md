# Modal Workflow for phip-seq-tile-visualizer

## Core Principles

**CRITICAL: ALL commands must run on Modal, NEVER locally (except git operations)**

- All npm commands run on Modal compute
- All Python scripts run on Modal compute
- All builds run on Modal compute
- Files are stored in Modal volumes
- Always sync volumes before ending sessions

## Volume Structure

- **`visualizer-code`** - Main codebase (src, public, scripts, config files)
- **`research-data`** - Research data (read from here, mounted at /data in Modal)

## Standard Workflow

### 1. Start of Session - Sync Local to Modal

Before doing ANY work, sync local changes to Modal:

```bash
# Sync modified files to Modal volume
modal volume put visualizer-code src /src -f
modal volume put visualizer-code public /public -f
modal volume put visualizer-code scripts /scripts -f
modal volume put visualizer-code modal_app.py /modal_app.py -f

# For individual files:
modal volume put visualizer-code <local-file> /<remote-file> -f
```

### 2. Running Commands on Modal (NOT locally)

**For interactive work (recommended):**
```bash
modal shell modal_app.py::app.dev_shell
# Inside the shell, you're in /code with all files mounted
# Run: npm install, npm run build, npm run dev, etc.
```

**For one-off commands:**
```bash
# Install dependencies
modal run modal_app.py::app.install_dependencies

# Build the app
modal run modal_app.py::app.build_app

# Run Python scripts
modal run modal_app.py::app.run_python_script --script-name <script-name>

# Execute custom shell commands
modal run modal_app.py::app.run_command --command "npm run lint"
```

### 3. End of Session - Sync Modal to Local

**ALWAYS run before ending a session:**

```bash
# Download modified files from Modal back to local
modal volume get visualizer-code /src src
modal volume get visualizer-code /public public
modal volume get visualizer-code /dist dist

# Verify what's in the volume
modal volume ls visualizer-code /
```

## Common Operations

### Syncing Files

**Upload specific directory:**
```bash
modal volume put visualizer-code <local-dir> /<remote-dir> -f
```

**Download specific directory:**
```bash
modal volume get visualizer-code /<remote-dir> <local-dir>
```

**List volume contents:**
```bash
modal volume ls visualizer-code /
modal volume ls visualizer-code /src
```

### Development

**Start dev server (in Modal shell):**
```bash
modal shell modal_app.py::app.dev_shell
# Then inside: npm run dev
```

**Build for production:**
```bash
modal run modal_app.py::app.build_app
```

**Run tests:**
```bash
modal run modal_app.py::app.run_command --command "npm test"
```

### Data Processing

**Run Python data scripts:**
```bash
modal run modal_app.py::app.run_python_script --script-name generate_taxonomy.py
modal run modal_app.py::app.run_python_script --script-name transform_data.py
modal run modal_app.py::app.run_python_script --script-name generate_combined_csvs.py
```

## Using Claude Code with Modal

**Claude Code runs LOCALLY, but executes commands on Modal:**

From your local terminal with Claude Code, I (Claude) will:
1. Automatically sync files to Modal before running commands
2. Execute all npm/python/build commands via `modal run`
3. Sync results back to local after completion

**If you want an interactive Modal shell:**
```bash
# Open Modal shell (from local terminal, not Claude Code)
modal shell modal_app.py::app.dev_shell

# Inside Modal shell, you can run commands directly
npm install
npm run build
python scripts/generate_taxonomy.py
```

## Git Operations

**Git commands run LOCALLY (not on Modal):**
- `git add`, `git commit`, `git push` - run from local machine
- After git operations, sync to Modal if needed

## Checklist for Claude Assistant

**Before ANY task execution:**
- [ ] Sync relevant files to Modal volume
- [ ] Verify files uploaded with `modal volume ls`

**During task execution:**
- [ ] ALL npm/python/build commands via Modal (NOT local bash)
- [ ] Use `modal run` or `modal shell` for execution
- [ ] Check Modal function outputs for errors

**Before ending session:**
- [ ] Sync any modified files back to local
- [ ] Download build artifacts if generated
- [ ] Commit volumes if needed (volumes auto-commit in functions)

## Quick Reference

| Task | Command |
|------|---------|
| Sync to Modal | `modal volume put visualizer-code <local> /<remote> -f` |
| Sync from Modal | `modal volume get visualizer-code /<remote> <local>` |
| Enter shell | `modal shell modal_app.py::app.dev_shell` |
| Run function | `modal run modal_app.py::app.<function-name>` |
| List files | `modal volume ls visualizer-code /` |
| Build app | `modal run modal_app.py::app.build_app` |
| Install deps | `modal run modal_app.py::app.install_dependencies` |

## Notes

- Modal volumes persist between sessions
- Changes in Modal functions auto-commit volumes
- The `-f` flag forces overwrite of existing files
- Working directory in Modal: `/code`
- Research data location in Modal: `/data`
