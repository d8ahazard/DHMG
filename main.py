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
    'img',
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
    level=logging.INFO,
    format='%(asctime)s.%(msecs)03d - %(levelname)s - %(funcName)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Add console handler for debugging
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(funcName)s - %(message)s')
console_handler.setFormatter(console_formatter)
logging.getLogger().addHandler(console_handler)

# Disable Werkzeug logging
logging.getLogger('werkzeug').setLevel(logging.ERROR)

def write_log(text, level="DEBUG"):
    """Write to log file"""
    if level in ["ERROR", "WARNING", "INFO", "CRITICAL"] or "Serving file:" in text:  # Only log errors and file serving
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
        
        # First check if this path starts with any root directory name
        path_parts = str(path).replace('\\', '/').split('/')
        for root in ROOT_DIRS:
            root_name = root.name
            if path_parts and path_parts[0] == root_name:
                return root
        
        # Then check if the path is under any root directory
        for root in ROOT_DIRS:
            try:
                # Check if path is relative to this root
                rel_path = path.relative_to(root)
                return root
            except ValueError:
                continue
                
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
                # Find the appropriate root directory
                path = Path(path)
                root = get_root_for_path(str(path))
                path_str = str(path)
                root_str = str(root)
                
                # Make sure path is relative to root
                if path_str.startswith(root_str):
                    rel_path = path_str[len(root_str):].lstrip('\\/')
                    if not rel_path:  # If this is the root directory itself
                        rel_path = root.name
                    else:
                        # For subdirectories, include the root directory name
                        rel_path = f"{root.name}/{rel_path}"
                    # Normalize path separators to forward slashes
                    rel_path = rel_path.replace('\\', '/')
                    encoded = base64.b64encode(rel_path.encode()).decode('utf-8').replace('+', '-').replace('/', '_').rstrip('=')
                    return encoded
                else:
                    # If not under root, use the name only
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
            success = thumb_path.exists()
            return success
            
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
        write_log(traceback.format_exc(), "ERROR")
        return False

def list_directory(path, thumb_only=False):
    """List contents of directory"""
    results = []
    thumbs_to_create = []
    
    try:
        # Convert path to Path object
        dir_path = Path(path)
        
        # Ensure path exists
        if not dir_path.exists():
            write_log(f"Path not found: {path}", "ERROR")
            return []
            
        for entry in dir_path.iterdir():
            name = entry.name
            
            # Skip excluded items
            if any(exclude in name for exclude in EXCLUDE_ARRAY):
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
                continue
                
            # Handle thumbnails
            thumb = ""
            if file_type in ['img', 'vid']:
                thumb = str(entry)
            elif file_type == 'dir':
                # Recursively find first thumbnail-able item
                sub_items = list_directory(entry, thumb_only=True)
                if sub_items:
                    thumb = sub_items[0]
            
            if thumb:
                # Find the appropriate root for this path
                root_for_thumb = get_root_for_path(thumb)
                try:
                    # Create relative path for thumbnail
                    rel_path = Path(thumb).relative_to(root_for_thumb)
                    thumb_path = THUMB_DIR / rel_path.with_suffix('.png')
                    
                    if not thumb_path.exists():
                        thumbs_to_create.append(thumb)
                    
                    # Use forward slashes for web paths and make relative to _data directory
                    item['thumb'] = f"./thumb?id={pathify(str(thumb))}"
                except Exception as e:
                    write_log(f"Error creating thumbnail path for {thumb}: {e}", "ERROR")
                    write_log(traceback.format_exc(), "ERROR")
                
                if thumb_only:
                    return [thumb]
                    
            results.append(item)
            
        if thumb_only:
            return []
            
        if thumbs_to_create:
            queue_thumbnails(thumbs_to_create)
            
        sorted_results = sorted(results, key=lambda x: (x['type'] != 'dir', x['name'].lower()))
        return sorted_results
        
    except Exception as e:
        write_log(f"Error listing directory: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return []

def queue_thumbnails(thumbs):
    """Queue thumbnails for creation"""
    try:
        queue_path = THUMB_DIR / 'queue'
        queue_path.mkdir(exist_ok=True)
        
        for thumb in thumbs:
            queue_id = pathify(thumb)
            queue_file = queue_path / f"{queue_id}.q"
            if not queue_file.exists():
                write_log(f"Queuing thumbnail: {thumb} -> {queue_file}")
                queue_file.touch()
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
                root_dirs.append({
                    'name': p.name,
                    'link': pathify(str(p))
                })
        
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
        path = request.args.get('id', '.')
        write_log(f"JSON route called with id: {path}")
        
        if path == '.':
            # Handle root directory listing
            write_log(f"Listing root directories")
            items = []
            for root in ROOT_DIRS:
                if root.exists():  # Check if directory exists
                    write_log(f"Adding root directory: {root}")
                    items.append({
                        'name': root.name,
                        'time': int(root.stat().st_mtime),
                        'size': 0,
                        'type': 'dir',
                        'link': pathify(str(root))
                    })
        else:
            # Handle subdirectory listing
            decoded_path = pathify(path, decode=True)
            write_log(f"Listing subdirectory: {decoded_path}")
            
            # Find the full path in one of the root directories
            full_path = None
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
                    items = list_directory(test_path)
                    favorites = list_favorites(decoded_path)
                    return jsonify({
                        'items': items,
                        'favorites': favorites
                    })
            
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
        path = request.args.get('id')
        write_log(f"Thumbnail route called with id: {path}")
        
        if not path:
            write_log("No path specified for thumbnail", "WARNING")
            return "No path specified", 400
            
        decoded_path = pathify(path, decode=True)
        write_log(f"Decoded path: {decoded_path}")
        
        # Find the full path in one of the root directories
        full_path = None
        for root in ROOT_DIRS:
            # First check if this is a path starting with a root directory name
            parts = decoded_path.replace('\\', '/').split('/')
            if parts[0] == root.name:
                # Remove the root name from the path since it's already in the root Path
                test_path = root / '/'.join(parts[1:])
            else:
                # Try the full path
                test_path = root / decoded_path.lstrip('/')
                
            write_log(f"Checking path: {test_path}")
            if test_path.exists():
                full_path = test_path
                write_log(f"Found existing path: {full_path}")
                break
                
        if not full_path:
            write_log(f"Path not found in any root directory", "WARNING")
            return "File not found", 404
        
        # Find first thumbnail-able item if directory
        if os.path.isdir(full_path):
            write_log(f"Finding thumbnail for directory: {full_path}")
            items = list_directory(full_path, thumb_only=True)
            if items:
                full_path = items[0]
                write_log(f"Using item as thumbnail source: {full_path}")
            else:
                write_log("No thumbnail source found in directory", "WARNING")
                return "No thumbnail source found", 404
        
        # Create relative path for thumbnail
        root_for_path = get_root_for_path(full_path)
        try:
            rel_path = Path(full_path).relative_to(root_for_path)
            thumb_path = THUMB_DIR / rel_path.with_suffix('.png')
            
            if not thumb_path.exists():
                if not create_thumbnail(full_path, thumb_path):
                    write_log("Failed to create thumbnail", "ERROR")
                    return "Failed to create thumbnail", 500
            
            return send_file(thumb_path, mimetype='image/png')
        except ValueError as e:
            write_log(f"Error creating relative path: {e}", "ERROR")
            return "Invalid path", 400
            
    except Exception as e:
        write_log(f"Error in thumbnail route: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
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
        path = request.args.get('id')
        
        if not path:
            write_log("No path specified for file", "WARNING")
            return "No path specified", 400
            
        decoded_path = pathify(path, decode=True)
        
        # Find the full path in one of the root directories
        full_path = None
        for root in ROOT_DIRS:
            # First check if this is a path starting with a root directory name
            parts = decoded_path.replace('\\', '/').split('/')
            if parts[0] == root.name:
                # Remove the root name from the path since it's already in the root Path
                test_path = root / '/'.join(parts[1:])
            else:
                # Try the full path
                test_path = root / decoded_path.lstrip('/')
                
            if test_path.exists():
                full_path = test_path
                break
                
        if not full_path or not os.path.exists(full_path):
            write_log(f"File not found: {decoded_path}", "WARNING")
            return "File not found", 404
            
        write_log(f"Serving file: {full_path}")
        return send_file(full_path)
    except Exception as e:
        write_log(f"Error serving file: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return f"Error: {str(e)}", 500

@app.route('/build')
def build_thumbnails():
    """Process thumbnail queue"""
    try:
        queue_path = THUMB_DIR / 'queue'
        if not queue_path.exists():
            write_log("Queue directory not found", "WARNING")
            return "No queue directory", 404
            
        count = 0
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
            
            if create_thumbnail(full_path, thumb_path):
                queue_file.unlink()
                count += 1
            else:
                write_log(f"Failed to create thumbnail: {thumb_path}", "ERROR")
            
        return f"Processed {count} thumbnails"
    except Exception as e:
        write_log(f"Error building thumbnails: {e}", "ERROR")
        write_log(traceback.format_exc(), "ERROR")
        return "Failed to process queue", 500

if __name__ == '__main__':
    write_log("Starting application")
    app.run(debug=True, host='0.0.0.0', port=5000) 