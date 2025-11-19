from flask import Flask, render_template, request, send_file, redirect, jsonify
from datetime import datetime
import os
import base64
import json
import subprocess
import shutil
from PIL import Image
import logging
from pathlib import Path
from typing import List, Dict
import traceback
from fetch_images import ImageFetcher
import asyncio
import threading
import queue
import time
from concurrent.futures import ThreadPoolExecutor

app = Flask(__name__, 
    static_url_path='',
    static_folder='_resources')

# Constants
CONFIG_FILE = Path(__file__).parent.absolute() / 'config.json'
CONFIG_EXAMPLE = Path(__file__).parent.absolute() / 'config_example.json'
GALLERY_NAME = 'Pocket Gallery'
FFMPEG_PATH = 'ffmpeg'
THUMB_SIZE = 250

EXCLUDE_ARRAY = [
    "_data",
    "_sort",
    '_dirData',
    "_dirList",
    '@eaDir',
    '.idea',
    'logs',
    '.php',
    '.txt',
    '.sell',
    '.db',
    '.json',
    '.css',
    '.html',
    '.ico',
    '.bk',
    '.htaccess'
]

SHOW_IMAGES = True
SHOW_VIDEOS = True
SHOW_FILES = True

# Setup paths
ROOT = Path(__file__).parent.absolute()
DATA_DIR = ROOT / '_data'
THUMB_DIR = DATA_DIR / 'thumb'
INFO_DIR = DATA_DIR / 'info'
LOG_DIR = DATA_DIR / 'logs'
FAV_DIR = DATA_DIR / 'favorite'

# Create necessary directories
for dir_path in [THUMB_DIR, INFO_DIR, LOG_DIR, FAV_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# Setup logging
logging.basicConfig(
    filename=LOG_DIR / 'gallery.log',
    level=logging.DEBUG,
    format='%(asctime)s.%(msecs)03d - %(levelname)s - %(funcName)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Add console handler for debugging
console_handler = logging.StreamHandler()
#console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(funcName)s - %(message)s')
console_handler.setFormatter(console_formatter)
logging.getLogger().addHandler(console_handler)


# Disable Werkzeug logging
#logging.getLogger('werkzeug').setLevel(logging.ERROR)

def write_log(text, level="DEBUG"):
    """Write to log file"""
    logging.log(
            getattr(logging, level),
            f"{text}"
        )
        

# Load config file
def load_config() -> Dict:
    """Load configuration from config.json, create from example if not exists"""
    try:
        if not CONFIG_FILE.exists() and CONFIG_EXAMPLE.exists():
            write_log(f"Config file not found, copying from example")
            shutil.copy(CONFIG_EXAMPLE, CONFIG_FILE)
            
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
                config['root_dirs'] = [str(Path(p).absolute()) for p in config.get('root_dirs', [str(ROOT)])]
                return config
        write_log("Using default config", "WARNING")
        return {"root_dirs": [str(ROOT)], "gallery_name": GALLERY_NAME}
    except Exception as e:
        write_log(f"Error loading config: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return {"root_dirs": [str(ROOT)], "gallery_name": GALLERY_NAME}

config = load_config()
ROOT_DIRS = [Path(p) for p in config.get('root_dirs', [str(ROOT)])]
GALLERY_NAME = config.get('gallery_name', GALLERY_NAME)

write_log(f"Initialized with ROOT_DIRS: {ROOT_DIRS}")
write_log(f"Gallery name: {GALLERY_NAME}")

def get_root_for_path(path: str) -> Path:
    """Find the root directory that contains the given path"""
    try:
        path = Path(path).absolute()
        
        # Track best matching root and how specific the match is
        best_root = None
        best_match_length = -1
        
        # First check if this path starts with any root directory name
        path_parts = str(path).replace('\\', '/').split('/')
        for root in ROOT_DIRS:
            root_name = root.name
            if path_parts and path_parts[0] == root_name:
                # This is a potential match based on name
                if best_match_length < 1:  # Name match is better than no match
                    best_root = root
                    best_match_length = 1
        
        # Then check if the path is under any root directory
        # Prefer the most specific (longest) match
        for root in ROOT_DIRS:
            root_str = str(root).replace('\\', '/')
            path_str = str(path).replace('\\', '/')
            
            # Check if path is under this root
            if path_str.startswith(root_str):
                # Calculate how specific this match is (length of matching path)
                match_length = len(root_str)
                
                # If this is a more specific match, use it
                if match_length > best_match_length:
                    best_root = root
                    best_match_length = match_length
        
        if best_root is not None:
            write_log(f"Best matching root for {path} is {best_root}")
            return best_root
                
        write_log(f"No matching root found for {path}, using first root: {ROOT_DIRS[0]}", "WARNING")
        return ROOT_DIRS[0]
    except Exception as e:
        write_log(f"Error in get_root_for_path: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return ROOT_DIRS[0]

def pathify(path, decode=False):
    """Convert path to/from base64"""
    try:
        if decode:
            try:
                padding = 4 - (len(path) % 4)
                if padding != 4:
                    path += "=" * padding
                path = path.replace('-', '+').replace('_', '/')
                decoded = base64.b64decode(path).decode('utf-8')
                return decoded
            except Exception as e:
                write_log(f"Error decoding path: {e}", "ERROR")
                write_log(traceback.format_exc(), "ERROR")
                return ""
        else:
            try:
                # Convert path to absolute Path object
                path = Path(path).absolute()
                path_str = str(path).replace('\\', '/')
                
                # Find the most specific root directory for this path
                best_root = None
                best_match_length = -1
                
                for root in ROOT_DIRS:
                    root_str = str(root).replace('\\', '/')
                    
                    # If path starts with this root directory
                    if path_str.startswith(root_str):
                        match_length = len(root_str)
                        if match_length > best_match_length:
                            best_root = root
                            best_match_length = match_length
                
                if best_root:
                    # Make path relative to the best matching root
                    root_str = str(best_root).replace('\\', '/')
                    rel_path = path_str[len(root_str):].lstrip('\\/')
                    
                    if not rel_path:  # If this is the root directory itself
                        rel_path = best_root.name
                    else:
                        # Include the root directory name for subdirectories
                        rel_path = f"{best_root.name}/{rel_path}"
                        
                    # Normalize path separators to forward slashes
                    rel_path = rel_path.replace('\\', '/')
                    encoded = base64.b64encode(rel_path.encode()).decode('utf-8').replace('+', '-').replace('/', '_').rstrip('=')
                    return encoded
                else:
                    # If not under any root, use the name only
                    encoded = base64.b64encode(path.name.encode()).decode('utf-8').replace('+', '-').replace('/', '_').rstrip('=')
                    return encoded
            except Exception as e:
                write_log(f"Error encoding path: {e}", "ERROR")
                write_log(traceback.format_exc(), "ERROR")
                return base64.b64encode(str(path).encode()).decode('utf-8').replace('+', '-').replace('/', '_').rstrip('=')
    except Exception as e:
        write_log(f"Error in pathify: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        if decode:
            return ""
        else:
            return base64.b64encode(str(path).encode()).decode('utf-8').replace('+', '-').replace('/', '_').rstrip('=')

def get_file_type(file_path):
    """Determine file type and classification"""
    try:
        if os.path.isdir(file_path):
            return 'dir'
        
        ext = os.path.splitext(file_path)[1].lower().lstrip('.')
        
        image_types = {'jpg', 'jpeg', 'png', 'gif'}
        video_types = {'mp4', 'mov', 'mkv', 'm4v', 'webm'}
        audio_types = {'mp3', 'wav', 'ogg'}
        
        if ext in image_types:
            return 'img'
        elif ext in video_types:
            return 'vid'
        elif ext in audio_types:
            return 'aud'
        else:
            return 'file'
    except Exception as e:
        write_log(f"Error in get_file_type for {file_path}: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return 'file'

def filter_file(file_info):
    """Determine if a file should be displayed in the gallery"""
    try:
        for exclude in EXCLUDE_ARRAY:
            if exclude in file_info['name']:
                return False
                
        file_type = file_info['type']
        if file_type == 'vid':
            return SHOW_VIDEOS
        elif file_type == 'file':
            return SHOW_FILES
        elif file_type == 'img':
            return SHOW_IMAGES
        return True
    except Exception as e:
        write_log(f"Error in filter_file: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return True

def create_thumbnail(source_path, thumb_path, width=THUMB_SIZE, height=THUMB_SIZE):
    """Create thumbnail for image or video"""
    try:
        source_path = Path(source_path)
        thumb_path = Path(thumb_path)
        file_type = get_file_type(source_path)
        
        thumb_path.parent.mkdir(parents=True, exist_ok=True)
        
        if file_type == 'vid':
            # Get video duration
            cmd = [FFMPEG_PATH, '-i', str(source_path)]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            # Default to 7 seconds in
            time = "00:00:07"
            
            # Try to find duration and use middle point
            for line in result.stderr.split('\n'):
                if "Duration:" in line:
                    duration = line.split("Duration: ")[1].split(",")[0]
                    h, m, s = map(float, duration.split(':'))
                    total_seconds = h * 3600 + m * 60 + s
                    middle = total_seconds / 2
                    time = f"{int(middle//3600):02d}:{int((middle%3600)//60):02d}:{int(middle%60):02d}"
                    break
            
            cmd = [
                FFMPEG_PATH, '-ss', time, 
                '-i', str(source_path), 
                '-frames:v', '1', 
                '-q:v', '2',
                '-vf', f'scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}',
                str(thumb_path)
            ]
            subprocess.run(cmd, check=True)
            return thumb_path.exists()
            
        elif file_type == 'img':
            with Image.open(source_path) as img:
                # Create square thumbnail
                min_size = min(img.size)
                offset_x = (img.size[0] - min_size) // 2
                offset_y = (img.size[1] - min_size) // 2
                img = img.crop((offset_x, offset_y, offset_x + min_size, offset_y + min_size))
                img = img.resize((width, height), Image.LANCZOS)
                img.save(thumb_path, "PNG")
                return True
                
        return False
    except Exception as e:
        write_log(f"Error creating thumbnail: {e}", "ERROR")
        return False

def list_directory(path, thumb_only=False):
    """List contents of directory - now with non-blocking thumbnail generation"""
    results = []
    
    try:
        # Convert path to Path object
        dir_path = Path(path)
        
        # Ensure path exists
        if not dir_path.exists():
            write_log(f"Path not found: {path}", "ERROR")
            return []
        
        # Get all entries in the directory
        try:
            write_log(f"Reading directory contents of: {dir_path}")
            entries = list(dir_path.iterdir())
            write_log(f"Found {len(entries)} entries in directory: {dir_path}")
            
            # Log all entries for debugging
            for i, entry in enumerate(entries):
                write_log(f"Directory entry {i+1}: {entry.name} - {'dir' if entry.is_dir() else 'file'}")
                
        except Exception as e:
            write_log(f"Error listing directory contents: {e}", "ERROR")
            write_log(traceback.format_exc(), "ERROR")
            entries = []
            
        for entry in entries:
            name = entry.name
            
            # Skip excluded items
            if any(exclude in name for exclude in EXCLUDE_ARRAY):
                write_log(f"Skipping excluded item: {name}")
                continue
                
            file_type = get_file_type(entry)
            
            item = {
                'name': name,
                'time': int(entry.stat().st_mtime),
                'size': entry.stat().st_size,
                'type': file_type,
                'link': pathify(str(entry))
            }
            
            if not filter_file(item):
                write_log(f"Filtering out item: {name}")
                continue
                
            # Handle thumbnails - now non-blocking
            thumb = ""
            if file_type in ['img', 'vid']:
                thumb = str(entry)
            elif file_type == 'dir':
                # Use efficient thumbnail search with deeper search for better coverage
                thumb = find_first_thumbnail_item(entry, max_depth=5)

            if thumb:
                # Find the appropriate root for this path
                root_for_thumb = get_root_for_path(thumb)
                try:
                    # Create relative path for thumbnail
                    rel_path = Path(thumb).relative_to(root_for_thumb)
                    thumb_path = THUMB_DIR / rel_path.with_suffix('.png')

                    # Always set thumbnail URL - will show fallback if not exists
                    item['thumb'] = f"./thumb?id={pathify(str(thumb))}"

                    # Queue thumbnail for background creation if it doesn't exist
                    if not thumb_path.exists():
                        queue_thumbnail_async(thumb, thumb_path)

                except Exception as e:
                    write_log(f"Error creating thumbnail path for {thumb}: {e}", "ERROR")
                
                if thumb_only:
                    return [thumb]
                    
            results.append(item)
            write_log(f"Added item to results: {name}")
            
        if thumb_only:
            return []
        
        # Sort directories first, then files, alphabetically
        import re
        def natural_sort_key(item):
            """Sort directories first, then use natural sort for names"""
            name = item['name']
            convert = lambda text: int(text) if text.isdigit() else text.lower()
            return (item['type'] != 'dir', [convert(c) for c in re.split(r'([0-9]+)', name)])
        
        # Sort the results using the natural sort key
        sorted_results = sorted(results, key=natural_sort_key)
        
        write_log(f"Returning {len(sorted_results)} items from directory: {dir_path}")
        
        # Log all sorted results for debugging
        for i, item in enumerate(sorted_results):
            write_log(f"Result {i+1}: {item['name']} - {item['type']}")
            
        return sorted_results
        
    except Exception as e:
        write_log(f"Error listing directory: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return []

def queue_thumbnails(thumbs):
    """Legacy queue thumbnails function - now uses background processing"""
    try:
        for thumb in thumbs:
            # Find the appropriate root for this path
            root_for_thumb = get_root_for_path(thumb)
            rel_path = Path(thumb).relative_to(root_for_thumb)
            thumb_path = THUMB_DIR / rel_path.with_suffix('.png')
            
            # Queue for background processing
            queue_thumbnail_async(thumb, thumb_path)
            
    except Exception as e:
        write_log(f"Error queuing thumbnails: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")

def list_favorites(path):
    """List favorited items in a path"""
    try:
        write_log(f"Listing favorites for path: {path}")
        if path == ".":
            path = ""
        fav_path = FAV_DIR / path.lstrip("./")
        favorites = []
        
        if fav_path.exists():
            for fav in fav_path.glob("*.fav"):
                rel_path = str(fav).replace(str(FAV_DIR), ".").replace(".fav", "")
                favorites.append(pathify(rel_path))
                
        write_log(f"Found {len(favorites)} favorites")
        return favorites
    except Exception as e:
        write_log(f"Error listing favorites: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return []

def make_breadcrumbs(path):
    """Create breadcrumb navigation links"""
    try:
        write_log(f"Creating breadcrumbs for path: {path}")
        parts = path.split('/')
        crumbs = [{'name': 'Home', 'link': '.'}]
        
        current = ""
        for part in parts:
            if not part or part == ".":
                continue
            current = os.path.join(current, part)
            crumbs.append({
                'name': part,
                'link': pathify(current)
            })
        
        write_log(f"Created {len(crumbs)} breadcrumbs")
        return crumbs
    except Exception as e:
        write_log(f"Error creating breadcrumbs: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return [{'name': 'Home', 'link': '.'}]

@app.route('/')
def index():
    """Main gallery view"""
    try:
        path = request.args.get('id')
        write_log(f"Index route called with id: {path}")

        if path:
            decoded_path = pathify(path, decode=True)
            write_log(f"Decoded path: {decoded_path}")

            # Check if path exists in any root directory
            valid_paths = []
            for root in ROOT_DIRS:
                # First check if this is a path starting with a root directory name
                parts = decoded_path.replace('\\', '/').split('/')
                if parts[0] == root.name:
                    # Remove the root name from the path since it's already in the root Path
                    test_path = root / '/'.join(parts[1:]) if len(parts) > 1 else root
                else:
                    # Try the full path
                    test_path = root / decoded_path.lstrip('/')

                write_log(f"Checking path: {test_path}")
                if test_path.exists():
                    write_log(f"Found existing path: {test_path}")
                    valid_paths.append(test_path)

            if valid_paths:
                # Use the most specific path (longest matching root)
                best_path = max(valid_paths, key=lambda p: len(str(p)))
                write_log(f"Using path: {best_path}")

                return render_template(
                    'index.html',
                    gallery_name=GALLERY_NAME,
                    current_path=decoded_path,
                    breadcrumbs=make_breadcrumbs(decoded_path),
                    page_key=path
                )

            write_log(f"Path not found in root directories", "WARNING")
            return "Directory not found", 404

        # Show root directories on home page
        write_log(f"Showing root directories on home page")
        root_dirs = []
        for p in ROOT_DIRS:
            if p.exists():
                write_log(f"Adding root directory: {p}")
                root_item = {
                    'name': p.name,
                    'link': pathify(str(p)),
                    'type': 'dir',
                    'time': int(p.stat().st_mtime),
                    'size': 0
                }

                # Find thumbnail for root directory with deeper search
                write_log(f"🔍 Finding thumbnail for root directory: {p.name}")
                thumb = find_first_thumbnail_item(p, max_depth=5)
                if thumb:
                    write_log(f"✅ Found thumbnail for {p.name}: {thumb}")
                    root_for_thumb = get_root_for_path(thumb)
                    try:
                        rel_path = Path(thumb).relative_to(root_for_thumb)
                        thumb_path = THUMB_DIR / rel_path.with_suffix('.png')

                        # Always set thumbnail URL
                        root_item['thumb'] = f"./thumb?id={pathify(str(thumb))}"
                        write_log(f"📁 Thumbnail URL for {p.name}: {root_item['thumb']}")

                        # Queue thumbnail for background creation if it doesn't exist
                        if not thumb_path.exists():
                            write_log(f"🛠️ Queuing thumbnail creation for {thumb}")
                            queue_thumbnail_async(thumb, thumb_path)
                        else:
                            write_log(f"✅ Thumbnail already exists: {thumb_path}")

                    except Exception as e:
                        write_log(f"❌ Error creating thumbnail path for root {thumb}: {e}", "ERROR")
                else:
                    write_log(f"❌ No thumbnail found for root directory: {p.name}")

                root_dirs.append(root_item)

        return render_template(
            'index.html',
            gallery_name=GALLERY_NAME,
            current_path='.',
            breadcrumbs=[{'name': 'Home', 'link': '.'}],
            root_dirs=root_dirs,
            page_key=""
        )
    except Exception as e:
        write_log(f"Error in index route: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return f"Error: {str(e)}", 500

@app.route('/json')
def get_directory_json():
    """Return directory listing as JSON"""
    try:
        # Check PIN authorization first
        authorized, _ = check_pin_authorization()
        if is_pin_protection_enabled() and not authorized:
            return jsonify({'error': 'Authentication required'}), 401

        path = request.args.get('id', '.')
        write_log(f"JSON route called with id: {path}")
        
        if path == '.':
            # Handle root directory listing
            write_log(f"Listing root directories")
            items = []
            for root in ROOT_DIRS:
                if root.exists():  # Check if directory exists
                    write_log(f"Adding root directory: {root}")
                    root_item = {
                        'name': root.name,
                        'time': int(root.stat().st_mtime),
                        'size': 0,
                        'type': 'dir',
                        'link': pathify(str(root))
                    }

                    # Find thumbnail for root directory with deeper search
                    write_log(f"🔍 Finding thumbnail for root directory: {root.name}")
                    thumb = find_first_thumbnail_item(root, max_depth=5)
                    if thumb:
                        write_log(f"✅ Found thumbnail for {root.name}: {thumb}")
                        root_for_thumb = get_root_for_path(thumb)
                        try:
                            rel_path = Path(thumb).relative_to(root_for_thumb)
                            thumb_path = THUMB_DIR / rel_path.with_suffix('.png')

                            # Always set thumbnail URL
                            root_item['thumb'] = f"./thumb?id={pathify(str(thumb))}"
                            write_log(f"📁 Thumbnail URL for {root.name}: {root_item['thumb']}")

                            # Queue thumbnail for background creation if it doesn't exist
                            if not thumb_path.exists():
                                write_log(f"🛠️ Queuing thumbnail creation for {thumb}")
                                queue_thumbnail_async(thumb, thumb_path)
                            else:
                                write_log(f"✅ Thumbnail already exists: {thumb_path}")

                        except Exception as e:
                            write_log(f"❌ Error creating thumbnail path for root {thumb}: {e}", "ERROR")
                    else:
                        write_log(f"❌ No thumbnail found for root directory: {root.name}")

                    items.append(root_item)
        else:
            # Handle subdirectory listing
            decoded_path = pathify(path, decode=True)
            write_log(f"Listing subdirectory: {decoded_path}")
            
            # Find all matching paths across all root directories
            items = []
            found_path = False
            for root in ROOT_DIRS:
                # First check if this is a path starting with a root directory name
                parts = decoded_path.replace('\\', '/').split('/')
                if parts[0] == root.name:
                    # Remove the root name from the path since it's already in the root Path
                    test_path = root / '/'.join(parts[1:]) if len(parts) > 1 else root
                else:
                    # Try the full path
                    test_path = root / decoded_path.lstrip('/')
                    
                write_log(f"Checking path: {test_path}")
                if test_path.exists():
                    write_log(f"Found existing path: {test_path}")
                    found_path = True
                    # Get all files from this directory
                    dir_items = list_directory(test_path)
                    
                    # Add unique items to the result
                    for item in dir_items:
                        # Check if this item is already in the results
                        if not any(existing['name'] == item['name'] for existing in items):
                            items.append(item)
                else:
                    write_log(f"Path not found in root directories: {test_path}", "WARNING")
            
            if not found_path:
                write_log(f"Path not found in root directories", "WARNING")
                return jsonify({'error': 'Directory not found'}), 404
                
        favorites = list_favorites(path)
        
        response = {
            'items': items,
            'favorites': favorites
        }
        write_log(f"Returning JSON with {len(items)} items and {len(favorites)} favorites")
        return jsonify(response)
    except Exception as e:
        write_log(f"Error in JSON route: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return jsonify({'error': str(e)}), 500

@app.route('/thumb')
def get_thumbnail():
    """Generate and serve thumbnail"""
    try:
        # Check PIN authorization first
        authorized, _ = check_pin_authorization()
        if is_pin_protection_enabled() and not authorized:
            return "Authentication required", 401

        path = request.args.get('id')

        if not path:
            write_log("No path specified for thumbnail", "WARNING")
            return "No path specified", 400
            
        decoded_path = pathify(path, decode=True)
        
        # Try to find the file in any of the root directories
        full_path = None
        best_match_length = -1
        
        for root in ROOT_DIRS:
            # First check if this is a path starting with a root directory name
            parts = decoded_path.replace('\\', '/').split('/')
            test_path = None
            
            if parts[0] == root.name:
                # Remove the root name from the path since it's already in the root Path
                test_path = root / '/'.join(parts[1:]) if len(parts) > 1 else root
            else:
                # Try the full path
                test_path = root / decoded_path.lstrip('/')
                
            if test_path and test_path.exists():
                # Calculate how specific this match is (length of matching path)
                root_str = str(root).replace('\\', '/')
                match_length = len(root_str)
                
                # If this is a more specific match, use it
                if match_length > best_match_length:
                    full_path = test_path
                    best_match_length = match_length
                
        if not full_path:
            write_log(f"Source file not found for thumbnail: {decoded_path}", "WARNING")
            return "File not found", 404
        
        # Find first thumbnail-able item if directory with deep search
        if os.path.isdir(full_path):
            thumb_source = find_first_thumbnail_item(full_path, max_depth=5)

            if thumb_source:
                full_path = thumb_source
            else:
                return "No thumbnail source found", 404
        
        # Create relative path for thumbnail
        root_for_path = get_root_for_path(full_path)
        try:
            rel_path = Path(full_path).relative_to(root_for_path)
            thumb_path = THUMB_DIR / rel_path.with_suffix('.png')
            
            if not thumb_path.exists():
                # Try to create thumbnail immediately for first-time access
                if create_thumbnail(full_path, thumb_path):
                    return send_file(thumb_path, mimetype='image/png')
                else:
                    # If immediate creation fails, queue for background processing
                    queue_thumbnail_async(full_path, thumb_path)
                    write_log("Thumbnail creation failed, queued for background processing", "WARNING")
                    return "Thumbnail being generated", 202  # HTTP 202 Accepted
            
            return send_file(thumb_path, mimetype='image/png')
        except ValueError as e:
            write_log(f"Error creating relative path: {e}", "ERROR")
            return "Invalid path", 400
            
    except Exception as e:
        write_log(f"Error in thumbnail route: {e}", "ERROR")
        return f"Error: {str(e)}", 500

@app.route('/favorite')
def toggle_favorite():
    """Toggle favorite status of an item"""
    try:
        path = request.args.get('id')
        write_log(f"Favorite route called with id: {path}")
        
        if not path:
            write_log("No path specified for favorite", "WARNING")
            return "No path specified", 400
            
        decoded_path = pathify(path, decode=True)
        write_log(f"Decoded path: {decoded_path}")
        
        remove = request.args.get('delete', '').lower() in ('true', '1', 't')
        write_log(f"Remove favorite: {remove}")
        
        fav_path = FAV_DIR / decoded_path.lstrip('./') + '.fav'
        write_log(f"Favorite file path: {fav_path}")
        
        if remove:
            if fav_path.exists():
                write_log(f"Removing favorite")
                fav_path.unlink()
        else:
            write_log(f"Adding favorite")
            fav_path.parent.mkdir(parents=True, exist_ok=True)
            fav_path.touch()
        return "OK"
    except Exception as e:
        write_log(f"Error toggling favorite: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return "Failed to toggle favorite", 500

@app.route('/file')
def serve_file():
    """Serve requested file"""
    try:
        # Check PIN authorization first
        authorized, _ = check_pin_authorization()
        if is_pin_protection_enabled() and not authorized:
            return "Authentication required", 401

        path = request.args.get('id')

        if not path:
            write_log("No path specified for file", "WARNING")
            return "No path specified", 400
            
        decoded_path = pathify(path, decode=True)
        
        # Try to find the file in any of the root directories
        full_path = None
        best_match_length = -1
        
        for root in ROOT_DIRS:
            # First check if this is a path starting with a root directory name
            parts = decoded_path.replace('\\', '/').split('/')
            test_path = None
            
            if parts[0] == root.name:
                # Remove the root name from the path since it's already in the root Path
                test_path = root / '/'.join(parts[1:]) if len(parts) > 1 else root
            else:
                # Try the full path
                test_path = root / decoded_path.lstrip('/')
                
            if test_path and test_path.exists():
                # Calculate how specific this match is (length of matching path)
                root_str = str(root).replace('\\', '/')
                match_length = len(root_str)
                
                # If this is a more specific match, use it
                if match_length > best_match_length:
                    full_path = test_path
                    best_match_length = match_length
                
        if not full_path or not os.path.exists(full_path):
            write_log(f"File not found: {decoded_path}", "WARNING")
            return "File not found", 404
            
        return send_file(full_path)
    except Exception as e:
        write_log(f"Error serving file: {e}", "ERROR")
        return f"Error: {str(e)}", 500

@app.route('/build')
def build_thumbnails():
    """Process legacy thumbnail queue and show background queue status"""
    try:
        # Process any legacy queue files
        queue_path = THUMB_DIR / 'queue'
        legacy_count = 0
        
        if queue_path.exists():
            for queue_file in queue_path.glob("*.q"):
                thumb_id = queue_file.stem
                source_path = pathify(thumb_id, decode=True)
                
                # Find the full path in one of the root directories
                full_path = None
                for root in ROOT_DIRS:
                    test_path = root / source_path.lstrip('/')
                    if test_path.exists():
                        full_path = test_path
                        break
                        
                if not full_path:
                    write_log(f"Source file not found: {source_path}", "WARNING")
                    queue_file.unlink()
                    continue
                    
                # Create relative path for thumbnail
                root_for_path = get_root_for_path(full_path)
                rel_path = Path(full_path).relative_to(root_for_path)
                thumb_path = THUMB_DIR / rel_path.with_suffix('.png')
                
                # Queue for background processing instead of immediate processing
                queue_thumbnail_async(full_path, thumb_path)
                queue_file.unlink()
                legacy_count += 1
        
        # Ensure background processor is running
        start_thumbnail_processor()
        
        background_queue_size = thumbnail_queue.qsize()
        
        return f"Migrated {legacy_count} legacy thumbnails to background queue. Background queue size: {background_queue_size}"
    except Exception as e:
        write_log(f"Error building thumbnails: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return "Failed to process queue", 500

@app.route('/check_cookie')
def check_cookie():
    """Check if cfg_cookie.txt exists"""
    try:
        cookie_exists = os.path.exists('cfg_cookie.txt')
        return jsonify({'cookie_exists': cookie_exists})
    except Exception as e:
        write_log(f"Error checking cookie: {e}", "ERROR")
        return jsonify({'error': str(e)}), 500

@app.route('/thumbnail_status')
def thumbnail_status():
    """Get background thumbnail queue status"""
    try:
        # Ensure background processor is running
        start_thumbnail_processor()
        
        queue_size = thumbnail_queue.qsize()
        thread_alive = thumbnail_thread is not None and thumbnail_thread.is_alive()
        
        return jsonify({
            'queue_size': queue_size,
            'processor_running': thread_alive,
            'processor_thread_name': thumbnail_thread.name if thumbnail_thread else None
        })
    except Exception as e:
        write_log(f"Error getting thumbnail status: {e}", "ERROR")
        return jsonify({'error': str(e)}), 500

@app.route('/fetch_images', methods=['POST'])
async def fetch_images_route():
    """Handle image fetching requests"""
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'success': False, 'error': 'No URL provided'}), 400

        url = data['url']
        write_log(f"Fetching images from URL: {url}")

        fetcher = ImageFetcher(str(CONFIG_FILE))
        success = await fetcher.fetch_images(url)

        if success:
            write_log("Successfully fetched images")
            return jsonify({'success': True})
        else:
            write_log("Failed to fetch images", "ERROR")
            return jsonify({'success': False, 'error': 'Failed to fetch images'}), 500

    except Exception as e:
        write_log(f"Error in fetch_images route: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/test_cookie', methods=['POST'])
async def test_cookie_route():
    """Test if the current cookie configuration allows access to a URL"""
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'success': False, 'error': 'No URL provided'}), 400

        url = data['url']
        write_log(f"Testing cookie access for URL: {url}")

        fetcher = ImageFetcher(str(CONFIG_FILE))
        is_accessible = await fetcher.test_cookie(url)

        return jsonify({
            'success': True,
            'is_accessible': is_accessible
        })

    except Exception as e:
        write_log(f"Error in test_cookie route: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/debug_dir')
def debug_directory():
    """Debug route to list a directory's contents directly"""
    try:
        path = request.args.get('path')

        if not path:
            return jsonify({
                'error': 'No path specified',
                'root_dirs': [str(r) for r in ROOT_DIRS]
            }), 400

        # Check if path exists
        test_path = Path(path)
        if not test_path.exists():
            return jsonify({
                'error': 'Path not found',
                'path': str(test_path)
            }), 404

        if not test_path.is_dir():
            return jsonify({
                'error': 'Not a directory',
                'path': str(test_path)
            }), 400

        # Get all entries in the directory
        entries = []
        for entry in test_path.iterdir():
            entry_type = 'dir' if entry.is_dir() else 'file'
            entries.append({
                'name': entry.name,
                'type': entry_type,
                'path': str(entry),
                'excluded': any(exclude in entry.name for exclude in EXCLUDE_ARRAY)
            })

        # Sort entries
        entries = sorted(entries, key=lambda x: (x['type'] != 'dir', x['name'].lower()))

        return jsonify({
            'path': str(test_path),
            'entries': entries,
            'total_entries': len(entries),
            'exclude_patterns': EXCLUDE_ARRAY
        })

    except Exception as e:
        write_log(f"Error in debug_directory route: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

# PIN protection functions
def is_pin_protection_enabled():
    """Check if PIN protection is enabled in config"""
    return config.get('pin_protection', {}).get('enabled', False)

def get_pin_from_config():
    """Get PIN from config"""
    return config.get('pin_protection', {}).get('pin', '')

def check_pin_authorization():
    """Check if user is authorized via PIN"""
    try:
        # Check if PIN protection is enabled
        if not is_pin_protection_enabled():
            write_log("PIN protection disabled, allowing access")
            return True, None

        # Check if we have valid authorization in session
        pin_data = request.cookies.get('pin_auth')
        write_log(f"Checking PIN authorization, cookie present: {pin_data is not None}")

        if pin_data:
            try:
                import json
                auth_info = json.loads(pin_data)
                write_log(f"PIN auth info: {auth_info}")

                # Check if authorization is still valid
                reauth_hours = config.get('pin_protection', {}).get('reauth_hours', 4)
                session_timeout_minutes = config.get('pin_protection', {}).get('session_timeout_minutes', 120)

                auth_time = auth_info.get('timestamp', 0)
                current_time = time.time()

                # Check if authorization has expired
                hours_since_auth = (current_time - auth_time) / 3600
                minutes_since_auth = (current_time - auth_time) / 60

                write_log(f"Auth time: {auth_time}, current: {current_time}, hours since: {hours_since_auth}, minutes since: {minutes_since_auth}")

                if hours_since_auth < reauth_hours and minutes_since_auth < session_timeout_minutes:
                    write_log(f"PIN authorization valid for {minutes_since_auth:.1f} minutes")
                    return True, auth_info.get('pin')
                else:
                    write_log(f"PIN authorization expired (reauth: {reauth_hours}h, session: {session_timeout_minutes}m)")

            except (json.JSONDecodeError, KeyError, ValueError) as e:
                write_log(f"Error parsing PIN auth cookie: {e}", "WARNING")

        write_log("PIN authorization not found or invalid")
        return False, None
    except Exception as e:
        write_log(f"Error checking PIN authorization: {e}", "ERROR")
        return False, None

def set_pin_authorization(pin):
    """Set PIN authorization cookie"""
    try:
        auth_info = {
            'pin': pin,
            'timestamp': time.time()
        }

        response = jsonify({'authorized': True})
        response.set_cookie(
            'pin_auth',
            json.dumps(auth_info),
            max_age=config.get('pin_protection', {}).get('session_timeout_minutes', 120) * 60,  # Convert to seconds
            httponly=True,
            secure=False,  # Set to True if using HTTPS
            samesite='Lax'
        )
        write_log(f"PIN authorization set for PIN: {pin}")
        return response
    except Exception as e:
        write_log(f"Error setting PIN authorization: {e}", "ERROR")
        return jsonify({'error': 'Failed to set authorization'}), 500

@app.route('/verify_pin', methods=['POST'])
def verify_pin():
    """Verify PIN and set authorization"""
    try:
        data = request.get_json()
        if not data or 'pin' not in data:
            return jsonify({'success': False, 'error': 'PIN required'}), 400

        provided_pin = data['pin']
        correct_pin = get_pin_from_config()

        write_log(f"PIN verification attempt: provided='{provided_pin}', correct='{correct_pin}'")

        if provided_pin == correct_pin:
            write_log("PIN verification successful")
            return set_pin_authorization(provided_pin)
        else:
            write_log("PIN verification failed - incorrect PIN")
            return jsonify({'success': False, 'error': 'Invalid PIN'}), 401

    except Exception as e:
        write_log(f"Error verifying PIN: {e}", "ERROR")
        return jsonify({'success': False, 'error': 'Verification failed'}), 500

@app.route('/check_pin_status')
def check_pin_status():
    """Check if PIN authorization is required"""
    try:
        authorized, _ = check_pin_authorization()
        pin_enabled = is_pin_protection_enabled()

        result = {
            'pin_required': pin_enabled and not authorized,
            'pin_enabled': pin_enabled,
            'authorized': authorized
        }

        write_log(f"PIN status check: {result}")
        return jsonify(result)
    except Exception as e:
        write_log(f"Error checking PIN status: {e}", "ERROR")
        return jsonify({'error': 'Status check failed'}), 500

# Add thumbnail processing queue and thread management
thumbnail_queue = queue.Queue()
thumbnail_thread = None
thumbnail_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix='thumb-')

def start_thumbnail_processor():
    """Start the background thumbnail processor thread"""
    global thumbnail_thread
    if thumbnail_thread is None or not thumbnail_thread.is_alive():
        thumbnail_thread = threading.Thread(target=thumbnail_processor_worker, daemon=True)
        thumbnail_thread.start()
        write_log("Background thumbnail processor started")

def thumbnail_processor_worker():
    """Background worker that processes thumbnail queue"""
    while True:
        try:
            # Get thumbnail job from queue (blocks until available)
            thumb_job = thumbnail_queue.get(timeout=30)
            
            if thumb_job is None:  # Shutdown signal
                break
                
            source_path, thumb_path = thumb_job
            
            # Create thumbnail with lower priority (nice value simulation)
            try:
                if create_thumbnail(source_path, thumb_path):
                    write_log(f"Background thumbnail created: {thumb_path}")
                else:
                    write_log(f"Failed to create background thumbnail: {thumb_path}", "ERROR")
            except Exception as e:
                write_log(f"Error creating background thumbnail: {e}", "ERROR")
            
            # Mark job as done
            thumbnail_queue.task_done()
            
            # Add small delay to lower priority
            time.sleep(0.1)
            
        except queue.Empty:
            # No jobs for 30 seconds, continue waiting
            continue
        except Exception as e:
            write_log(f"Error in thumbnail processor: {e}", "ERROR")
            time.sleep(1)

def queue_thumbnail_async(source_path, thumb_path):
    """Queue a thumbnail for background processing"""
    try:
        thumbnail_queue.put((source_path, thumb_path))
        write_log(f"Queued thumbnail for background processing: {source_path}")
    except Exception as e:
        write_log(f"Error queuing thumbnail: {e}", "ERROR")

def find_first_thumbnail_item(directory_path, max_depth=3, current_depth=0):
    """
    Efficiently find the first thumbnail-able item in a directory
    with depth limiting to prevent infinite recursion.
    Handles folders that only contain subfolders by recursively searching.
    """
    if current_depth > max_depth:
        return None

    try:
        directory_path = Path(directory_path)
        if not directory_path.exists() or not directory_path.is_dir():
            write_log(f"Directory does not exist or is not a directory: {directory_path}")
            return None

        entries = list(directory_path.iterdir())
        write_log(f"🔍 Searching for thumbnail in {directory_path.name}, depth {current_depth}, {len(entries)} entries")

        # First pass: look for images and videos in current directory
        for entry in entries:
            if entry.is_file():
                file_type = get_file_type(entry)
                if file_type in ['img', 'vid']:
                    write_log(f"✅ Found thumbnail item in current directory: {entry.name}")
                    return str(entry)

        # Second pass: look in subdirectories (limited depth)
        # Sort subdirectories to prioritize certain folders (e.g., folders starting with letters first)
        subdirs = [entry for entry in entries if entry.is_dir() and not any(exclude in entry.name for exclude in EXCLUDE_ARRAY)]

        # Sort subdirectories for more predictable results
        subdirs.sort(key=lambda x: x.name.lower())

        for entry in subdirs:
            write_log(f"📁 Searching subdirectory: {entry.name} (depth {current_depth + 1}/{max_depth})")
            result = find_first_thumbnail_item(entry, max_depth, current_depth + 1)
            if result:
                write_log(f"✅ Found thumbnail in subdirectory {entry.name}: {Path(result).name}")
                return result

        write_log(f"❌ No thumbnail found in {directory_path.name} or its subdirectories up to depth {max_depth}")
        return None
    except Exception as e:
        write_log(f"❌ Error finding thumbnail item in {directory_path}: {e}", "ERROR")
        return None

if __name__ == '__main__':
    write_log("Starting application")
    # Start background thumbnail processor
    start_thumbnail_processor()
    app.run(debug=True, host='0.0.0.0', port=5000) 