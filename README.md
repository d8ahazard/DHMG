# DHMG
### Digitalhigh's Multimedia Gallery

A modern, fast, and beautiful web-based media gallery built with Python (Flask) and JavaScript. Turn any directory structure into a responsive, feature-rich gallery with zero configuration required.

## ✨ What Makes DHMG Special?

**Modern UI/UX (2025)**
- **Desktop Experience**: Clean three-section layout with logical control grouping
  - Top header: Title, breadcrumb navigation, and search
  - Secondary toolbar: Sort controls, view options, slideshow controls
  - Smooth animations and professional visual hierarchy
- **Mobile Experience**: Bottom navigation bar designed for thumb-friendly access
  - Fixed bottom bar with Sort, Shuffle, View, and Slideshow buttons
  - Slide-up menus for detailed controls
  - Proper touch targets (48px+) throughout
  - Optimized layouts for both portrait and landscape orientations
- **Dark Theme**: Beautiful dark mode design with proper contrast and accessibility

**Performance Optimized**
- Lazy loading with Blazy.js for fast initial page loads
- On-the-fly thumbnail generation with smart caching
- Hardware-accelerated animations
- Efficient grid layout system
- Optimized video playback with volume persistence

**Smart Media Handling**
- Automatic format detection for images and videos (all HTML5-supported formats)
- Video thumbnail generation via FFMPEG
- Persistent video volume across playback
- Slideshow mode with adjustable speed (2-10 seconds)
- Fullscreen gallery viewer powered by LightGallery
- Smooth navigation with keyboard, mouse, and touch support

## 🚀 Key Features

### Gallery Management
- **Smart Search**: Real-time filtering with instant results
- **Multiple Sort Options**: Sort by name, date, or type with ascending/descending order
- **Shuffle Mode**: Randomize your gallery layout
- **Favorites System**: Star items to pin them at the top
- **Breadcrumb Navigation**: Easy directory traversal
- **Scroll Position Memory**: Returns to your exact position when navigating back

### Media Viewing
- **LightGallery Integration**: Professional full-screen media viewer
- **Video Support**: HTML5 video playback with native controls
- **Auto-hide Controls**: Clean viewing experience with controls that fade when inactive
- **Slideshow Mode**: Automatic playback with customizable speed
- **Zoom & Pan**: Full zoom support for detailed viewing
- **Mobile Optimized**: Swipe gestures, optimized controls, auto-fullscreen

### Security & Access
- **PIN Protection**: Optional PIN-based access control
- **Protected Links**: Secure media serving through backend
- **Session Management**: Cookie-based state persistence

### Customization
- **Adjustable Thumbnail Size**: Real-time slider control (100-400px)
- **Responsive Grid**: Automatically adapts to screen size
  - Desktop: 200-240px thumbnails
  - Tablet: 160px thumbnails
  - Mobile Portrait: 150-170px thumbnails
  - Mobile Landscape: 100px thumbnails
- **Theme Variables**: Easy color customization via CSS variables

### Developer Features
- **Python/Flask Backend**: Clean, maintainable Python codebase
- **Modern JavaScript**: jQuery, Shuffle.js, LightGallery, Blazy
- **Modular Design**: Separated concerns between viewing, sorting, and media handling
- **JSON API**: RESTful endpoints for gallery data
- **Logging System**: Built-in logging for debugging

## 📋 Requirements

- **Python 3.7+** with Flask
- **FFMPEG** (for video thumbnail generation)
- **PHP GD Library** (for image processing)
- Modern web browser with JavaScript enabled

## 🛠️ Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Install FFMPEG and ensure it's accessible from command line

3. Configure your gallery (optional):
   - Copy `config_example.json` to `config.json`
   - Adjust settings as needed (gallery name, PIN protection, etc.)

4. Run the application:
```bash
python main.py
```

5. Open your browser to `http://localhost:5000`

## 🎨 Modern Features (2025 Update)

### What's New
- Complete UI/UX overhaul with mobile-first design
- Bottom navigation for mobile devices
- Three-section desktop layout for better organization
- Smooth animations and transitions throughout
- Improved accessibility with proper focus states
- Dark theme with consistent styling
- Better touch targets and mobile usability
- Responsive breakpoints for all screen sizes
- Enhanced lightgallery controls with better visibility
- Modern modal designs with smooth animations

### Mobile Excellence
- **Bottom Navigation**: Thumb-friendly fixed bar with 4 main actions
- **Slide-up Menus**: Beautiful overlays for detailed options
- **Smart Defaults**: Automatic sizing based on device and orientation
- **Touch Optimized**: All controls meet 48px minimum touch target guidelines
- **No Horizontal Scroll**: Everything fits perfectly within viewport

### Desktop Power
- **Logical Sections**: Controls grouped by function (Sort | Gallery | Slideshow)
- **Visual Hierarchy**: Primary and secondary button styles
- **Keyboard Shortcuts**: Full keyboard navigation support
- **Multi-monitor Ready**: Optimized for ultra-wide displays (up to 2400px)
- **Hover States**: Smooth feedback on all interactive elements

## 🎯 Usage Tips

- **Search**: Type in the search bar to instantly filter items
- **Sort**: Click sort buttons to change order (click again to reverse)
- **Shuffle**: Randomize the gallery layout
- **Slideshow**: Auto-play through your media with adjustable speed
- **Favorites**: Click the star icon to pin important items
- **Thumbnail Size**: Use the slider to adjust thumbnail size in real-time
- **Mobile Menus**: Tap Sort or View buttons for additional options

## 📱 Responsive Design

DHMG automatically adapts to your device:
- **Ultra-wide (1920px+)**: 240px thumbnails, 3+ columns
- **Desktop (1025-1919px)**: 200px thumbnails, optimized layout
- **Tablet (769-1024px)**: 160px thumbnails, compact controls
- **Mobile Portrait**: 150-170px thumbnails, bottom navigation
- **Mobile Landscape**: 100px thumbnails, maximized viewing area

## 🔒 Security

- Optional PIN protection for gallery access
- Session-based authentication
- Protected file serving
- Secure media path encoding

## 🙏 Credits

Built with:
- **LightGallery** - Media viewing
- **Shuffle.js** - Grid sorting and filtering
- **Blazy** - Lazy loading
- **Flask** - Python web framework
- **jQuery** - DOM manipulation
- **Bootstrap** - Base UI components

---

**Note**: This is a personal project built for specific use cases. Use at your own risk. Pull requests welcome!