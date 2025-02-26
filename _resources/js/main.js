let dataArray = false;
let fetchTimeout = false;
let lg = null;
let mediaArray = [];
let phpSelf = '.';
let protectedLinks = false;
let shuffleInstance = false;
let sortByName = true;
let sortReverse = false;
let favorites = false;
let trackTouch = false;
let pausePage = false;
let fadeInt;
let fadeTimeout;
let isSlideshow = false;
let isRandom = false;
let navTimeout;
let galleryElement = null;
let controlsTimeout;
let mouseTimeout;
let lastMouseMove = Date.now();
let isControlsVisible = true;
let controlsFadeTimeout = null;
let lastUserActivity = Date.now();
var galleryIndexToOpen = null;

$(function () {
    $.fn.imgLoad = function (callback) {
        return this.each(function () {
            if (callback) {
                if (this.complete || $(this).height() > 0) {
                    callback.apply(this);
                }
                else {
                    $(this).on('load', function () {
                        callback.apply(this);
                    });
                }
            }
        });
    };
    protectedLinks = $('#protectKey').attr('content');
    setSort();
    setInitialGridSize();
    setupControls();
    fetchGallery();
});

function setInitialGridSize() {
    const defaultSize = window.innerWidth <= 768 ? 150 : 200;
    document.documentElement.style.setProperty('--grid-size', `${defaultSize}px`);
    if (shuffleInstance) {
        shuffleInstance.update();
    }
}

function setupControls() {
    // Size slider control
    $('.size-slider').on('input', function(e) {
        const newSize = e.target.value;
        document.documentElement.style.setProperty('--grid-size', `${newSize}px`);
        
        // Update shuffle instance to re-layout items
        if (shuffleInstance) {
            shuffleInstance.update();
        }
        
        // Force a re-layout of the grid
        const galleryContent = document.getElementById('galleryContent');
        if (galleryContent) {
            galleryContent.style.display = 'none';
            // Force a reflow
            void galleryContent.offsetHeight;
            galleryContent.style.display = 'grid';
        }
    });

    // Slideshow controls
    $('#slideshowBtn').on('click', function() {
        try {
            if (lg && lg.modules && lg.modules.autoplay) {
                // If lightGallery is initialized, start slideshow and open if needed
                lg.settings.slideShowAutoplay = true;
                lg.modules.autoplay.startSlideShow();
                
                if (!lg.$container.hasClass('lg-show-in')) {
                    console.log('Opening gallery for slideshow');
                    lg.openGallery(lg.index || 0);
                }
            } else {
                // Initialize gallery with slideshow enabled and open it
                isSlideshow = true;
                console.log('Initializing gallery with slideshow');
                initGallery();
                
                // Wait for gallery to initialize before opening
                const checkGalleryInitialized = setInterval(() => {
                    if (lg) {
                        clearInterval(checkGalleryInitialized);
                        console.log('Opening gallery after initialization');
                        lg.openGallery(0);
                    }
                }, 50);
            }
        } catch (error) {
            console.error('Error starting slideshow:', error);
        }
    });

    // Add gallery close handler to stop slideshow
    $(document).on('lgAfterClose', function() {
        console.log('Gallery closed, stopping slideshow');
        isSlideshow = false;
        if (lg && lg.modules && lg.modules.autoplay) {
            lg.settings.slideShowAutoplay = false;
            lg.modules.autoplay.stopSlideShow();
        }
    });

    $('#shuffleBtn').on('click', function() {
        try {
            console.log('Shuffling items');
            if (shuffleInstance) {
                shuffleInstance.sort({
                    by: function() {
                        return Math.random() - 0.5; // Random sort function
                    }
                });
                
                // Force a re-sort of the DOM to match the new order
                sortDom();
            }
        } catch (error) {
            console.error('Error shuffling items:', error);
        }
    });

    // Update gallery close handler to reset after shuffle
    $(document).off('lgAfterClose').on('lgAfterClose', function() {
        console.log('Gallery closed, stopping slideshow');
        isSlideshow = false;
        if (lg && lg.modules && lg.modules.autoplay) {
            lg.settings.slideShowAutoplay = false;
            lg.modules.autoplay.stopSlideShow();
        }
        
        // Reset the shuffle order
        if (shuffleInstance) {
            console.log('Resetting shuffle order');
            shuffleInstance.sort({ by: function(element) {
                return element.getAttribute('data-name').toLowerCase();
            }});
            sortDom();
        }
    });

    // Slideshow speed control
    $('#slideshowSpeed').on('input', function() {
        try {
            if (lg) {
                lg.destroy();
                lg = null;
            }
            initGallery();
        } catch (error) {
            console.error('Error updating slideshow speed:', error);
        }
    });
}

function addElements(elements) {
    console.time('add-elements-detail');
    let gc = document.getElementById("galleryContent");
    console.log(`Adding ${elements.length} elements to gallery`);
    
    $.each(elements, function (key, obj) {
        let isFav = ($.inArray(obj['link'], favorites) > -1);
        let typeIcon = '';
        let fullName = obj['name'];  // Store full name
        let name = thumbDisplayName(fullName);  // Shortened display name
        let type = obj['type'];
        let mediaPath;
        if (type === 'dir') typeIcon = 'folder';
        if (type === 'img') typeIcon = 'image';
        if (type === 'file') typeIcon = 'file-code';
        if (type === 'vid' || type === 'img') {
            mediaPath = './file?id=' + encodeURIComponent(obj['link']);
        } else {
            mediaPath = obj['link'];
        }

        let thumbPath = obj['thumb'];
        let thumbAlt = "./thumb?id=" + encodeURIComponent(obj['link']);
        let mDiv = document.createElement("div");
        mDiv.id = "media" + key;
        mDiv.classList.add("thumbDiv", "card", "bg-dark", "col-6", "col-md-4", "col-lg-3", "xol-xl-2");
        if (type === 'vid' || type === 'img') mDiv.classList.add("media");
        mDiv.setAttribute("data-type", type);
        mDiv.setAttribute("title", fullName);  // Add full name as title

        if (type === 'vid') {
            typeIcon = 'video';
            // Decode base64 to get the actual filename, using try-catch to avoid error if string is not properly encoded
            let decodedLink;
            try {
                decodedLink = atob(obj['link']);
            } catch (error) {
                console.warn('Invalid base64 string for video, using original link', obj['link']);
                decodedLink = obj['link'];
            }
            let vidType = decodedLink.split('.').pop().toLowerCase();
            mDiv.classList.add('video');
            mDiv.classList.add('media');
            
            // Simplified video configuration for better performance
            const videoConfig = {
                source: [{
                    src: './file?id=' + encodeURIComponent(obj['link']),
                    type: `video/${vidType}`
                }],
                attributes: {
                    preload: 'none', // Critical for performance
                    playsinline: true,
                    controls: true,
                    autoplay: false
                }
            };
            
            // Set data-video attribute with stringified config
            mDiv.setAttribute('data-video', JSON.stringify(videoConfig));
            
            // For videos, we don't set data-src as per documentation
            mDiv.removeAttribute('data-src');
        }

        mDiv.setAttribute("data-name", name);
        mDiv.setAttribute("data-time", obj['time']);
        mDiv.setAttribute("data-size", obj['size']);
        mDiv.setAttribute("data-link", obj['link']);
        if (isFav) mDiv.setAttribute("data-favorite", "true");
        if (type === "img") {
            mDiv.setAttribute("data-src", mediaPath);
            mDiv.setAttribute("data-responsive", mediaPath);
            mDiv.setAttribute("data-sub-html", name);
        }

        let ri = document.createElement("img");
        ri.classList.add("responsive-image", "b-lazy");
        ri.setAttribute("data-src", thumbPath);
        
        // Set type-specific fallback images
        let fallbackImage;
        if (type === 'dir') {
            fallbackImage = '/img/folder.png';
        } else if (type === 'vid') {
            fallbackImage = '/img/video.png';
        } else if (type === 'img') {
            fallbackImage = '/img/image.png';
        } else {
            fallbackImage = '/img/file.png';
        }
        ri.setAttribute("data-src-fallback", fallbackImage);

        let ai = document.createElement("div");
        ai.classList.add("aspect__inner");

        let a = document.createElement("div");
        a.classList.add("aspect");

        // Add default icon overlay
        let overlay = document.createElement("div");
        overlay.classList.add("default-icon-overlay");
        let icon = document.createElement("i");
        icon.classList.add("fas", `fa-${typeIcon}`);
        overlay.appendChild(icon);

        // Add video overlay for video files
        if (type === 'vid') {
            let videoOverlay = document.createElement("div");
            videoOverlay.classList.add("video-overlay");
            let playIcon = document.createElement("img");
            playIcon.src = '/img/play_video.png';
            videoOverlay.appendChild(playIcon);
            a.appendChild(videoOverlay);
        }

        ai.appendChild(ri);
        a.appendChild(ai);
        a.appendChild(overlay);  // Add the default icon overlay
        mDiv.appendChild(a);

        let ttd = document.createElement("div");
        ttd.classList.add("thumbtitle", "decorator");
        ttd.innerHTML = name;
        let tid = document.createElement("div");
        tid.classList.add("typeIcon", "decorator");
        let typeIconSmall = document.createElement("i");
        typeIconSmall.classList.add('fa', 'fa-' + typeIcon);
        tid.appendChild(typeIconSmall);
        let fad = document.createElement("div");
        fad.classList.add("favIcon");
        let fa = document.createElement("i");
        if (isFav) {
            fa.classList.add("favorite", "fa", "fa-star")
        } else {
            fa.classList.add("far", "fa-star");
        }
        fad.appendChild(fa);
        mDiv.appendChild(ttd);
        mDiv.appendChild(tid);
        mDiv.appendChild(fad);
        gc.appendChild(mDiv);
    });
    
    console.timeEnd('add-elements-detail');
}

function buildGallery() {
    console.time('build-gallery');
    console.log('Building gallery from data');
    
    let gc = $("#galleryContent");
    if (dataArray && dataArray.hasOwnProperty('items')) {
        console.log(`Processing ${dataArray.items.length} items`);
        gc.addClass('fadeOut');
        gc.empty();
        mediaArray = dataArray['items'];
        favorites = dataArray['favorites'];
        
        console.time('add-elements');
        addElements(mediaArray);
        console.timeEnd('add-elements');
    }

    $('#loader').addClass('fadeOut');
    gc.removeClass('fadeOut');
    
    console.time('shuffle-init');
    console.log('Initializing Shuffle.js');
    shuffleInstance = new Shuffle(document.getElementById('galleryContent'), {
        itemSelector: '.thumbDiv',
        sizer: '.sizer',
        isCentered: true,
        by: function(element) {
            return element.getAttribute('data-name').toLowerCase();
        },
        useTransform: false
    });
    console.timeEnd('shuffle-init');
    
    console.time('sort-elements');
    sortElements();
    console.timeEnd('sort-elements');
    
    console.time('blazy-init');
    console.log('Initializing Blazy for lazy loading');
    window.bLazy = new Blazy({
        container: '#galleryContent',
        success: function(ele){
            if (ele.getAttribute('data-src')) {
                ele.classList.add('loaded');
            }
        },
        error: function(ele, msg){
            console.error('Blazy error:', msg);
            ele.src = ele.getAttribute('data-src-fallback');
            ele.classList.add('reloaded');
        }
    });
    console.timeEnd('blazy-init');

    console.time('set-listeners');
    setListeners();
    console.timeEnd('set-listeners');
    
    console.time('sort-dom');
    sortDom();
    console.timeEnd('sort-dom');
    
    console.timeEnd('build-gallery');
}


function updateSlideshowButtonState() {
    if (!lg || !lg.$container) return;
    
    // Check slideshow status directly from the instance
    let isPlaying = false;
    
    // Check if the autoplay plugin exists and slideshow is enabled
    if (lg.modules && lg.modules.autoplay) {
        isPlaying = lg.settings.slideShowAutoplay && lg.modules.autoplay.slideShowStatus;
    }
    
    const icon = $('#slideshowBtn').find('i');
    if (isPlaying) {
        icon.removeClass('fa-play').addClass('fa-pause');
    } else {
        icon.removeClass('fa-pause').addClass('fa-play');
    }
}

function fetchGallery() {
    console.time('fetch-gallery');
    let key = $('#pageKey').attr('content');
    let url = "./json";
    console.log("Page key:", key);
    if (key && key !== "") {
        url += "?id=" + encodeURIComponent(key);
    }
    console.log("Fetching gallery from:", url);
    
    $.getJSON(url, function (data) {
        console.timeEnd('fetch-gallery');
        console.log("JSON retrieved data!", data);
        dataArray = data;
        if (fetchTimeout) clearTimeout(fetchTimeout);
        
        console.time('build-gallery-after-fetch');
        buildGallery();
        console.timeEnd('build-gallery-after-fetch');
        
        if (shuffleInstance) {
            console.time('shuffle-update');
            console.log("Updating shuffle instance");
            shuffleInstance.update();
            console.timeEnd('shuffle-update');
        }
    })
    .fail(function (jqXHR, textStatus, errorThrown) {
        console.error("JSON Fetch failed:", textStatus, errorThrown);
        console.error("Response:", jqXHR.responseText);
        fetchTimeout = setTimeout(function () {
            console.log("Retrying gallery fetch...");
            fetchGallery();
        }, 5000);
    });
}

function getMedia() {
    let media = [];
    let elements = $('.shuffle-item--visible');
    $.each(elements, function (key, elem) {
        let element = $(elem);
        if (element.data('type') !== 'dir' && element.data['type'] !== 'file') {
            let elemData = {
                type: element.data('type'),
                src: element.data('src'),
                name: element.data('name'),
                time: element.data('time')
            };
            media.push(elemData);
        }
    });
    console.log("Elemedata: ", media);
    mediaArray = media;
}

// Add a function to patch the lightGallery core to prevent unnecessary reloading
function patchLightGalleryCore(lgInstance) {
    if (!lgInstance || !lgInstance.modules || !lgInstance.modules.core) {
        console.warn('Cannot patch lightGallery core - instance not properly initialized');
        return;
    }
    
    console.log('Patching lightGallery core to prevent unnecessary reloading');
    
    // Keep track of loaded slides
    lgInstance.loadedSlides = lgInstance.loadedSlides || {};
    
    // Override the loadContent method to prevent unnecessary reloading
    const originalLoadContent = lgInstance.modules.core.loadContent;
    lgInstance.modules.core.loadContent = function(index, rec, delay) {
        console.time(`load-content-${index}`);
        console.log(`Loading content for slide ${index}`);
        
        // Check if the slide is already loaded
        if (lgInstance.loadedSlides[index]) {
            console.log(`Slide ${index} already loaded, skipping reload`);
            
            // Just update the current index and trigger afterSlide event
            if (lgInstance.index !== index) {
                const prevIndex = lgInstance.index;
                lgInstance.index = index;
                
                // Update UI without reloading content
                lgInstance.updateCurrentCounter(index);
                lgInstance.LGel.trigger('lgAfterSlide', {
                    prevIndex: prevIndex,
                    index: index,
                    fromTouch: false,
                    fromThumb: false
                });
            }
            
            console.timeEnd(`load-content-${index}`);
            return;
        }
        
        // Call the original method for unloaded slides
        originalLoadContent.call(lgInstance.modules.core, index, rec, delay);
        
        // Mark the slide as loaded
        lgInstance.loadedSlides[index] = true;
        
        console.timeEnd(`load-content-${index}`);
    };
    
    // Override the goToNextSlide method for better performance
    const originalGoToNextSlide = lgInstance.goToNextSlide;
    lgInstance.goToNextSlide = function(fromTouch) {
        console.time('go-to-next-slide');
        console.log('Going to next slide');
        
        // Call the original method
        originalGoToNextSlide.call(lgInstance, fromTouch);
        
        console.timeEnd('go-to-next-slide');
    };
    
    // Override the goToPrevSlide method for better performance
    const originalGoToPrevSlide = lgInstance.goToPrevSlide;
    lgInstance.goToPrevSlide = function(fromTouch) {
        console.time('go-to-prev-slide');
        console.log('Going to previous slide');
        
        // Call the original method
        originalGoToPrevSlide.call(lgInstance, fromTouch);
        
        console.timeEnd('go-to-prev-slide');
    };
    
    console.log('lightGallery core patched successfully');
}

function initGallery() {
    try {
        // Clean up any existing instance
        if (lg) {
            lg.destroy();
            lg = null;
        }
        
        galleryElement = document.getElementById("galleryContent");
        if (!galleryElement) return;

        // Initialize gallery with basic config, including onAfterOpen callback
        lg = lightGallery(galleryElement, {
            plugins: [lgZoom, lgVideo, lgFullscreen, lgAutoplay],
            speed: 500,
            selector: '.thumbDiv.media.shuffle-item--visible',
            preload: 2,
            download: false,
            counter: true,
            autoplayControls: false,
            slideShowAutoplay: isSlideshow,
            slideShowInterval: parseInt($('#slideshowSpeed').val() || 3) * 1000,
            progressBar: true,
            mode: isRandom ? 'lg-slide-random' : 'lg-slide',
            addClass: 'lg-custom-thumbnails',
            mobileSettings: {
                controls: true,
                showCloseIcon: true,
                download: false
            },
            hideControlOnEnd: false,
            controls: true,
            keyPress: true,
            enableDrag: true,
            enableSwipe: true,
            swipeThreshold: 50,
            videoMaxWidth: "100%",
            appendCounterTo: '.navbar',
            hash: false,
            thumbnail: false,
            allowMediaOverlap: false,
            scaleImageToRatio: true,
            actualSize: false,
            width: '100vw',
            height: '100vh',
            addClass: 'lg-contain',
            loadYouTubeThumbnail: false,
            loadVimeoThumbnail: false,
            thumbWidth: 100,
            thumbHeight: 100,
            thumbMargin: 5,
            showThumbByDefault: false,
            getCaptionFromTitleOrAlt: false,
            subHtmlSelectorRelative: false,
            mousewheel: false,
            backdropDuration: 0,
            startAnimationDuration: 0,
            hideBarDelay: 2000,
            loadYouTubeVideoOnOpen: false,
            loadVimeoVideoOnOpen: false,
            onBeforeNextSlide: false,
            onBeforePrevSlide: false
        });

    } catch (error) {
        console.error('Error initializing gallery:', error);
    }
}

function openFile(id) {
    window.location = protectedLinks ? './file?id=' + id : id;
}

function openGallery(id) {
    console.log("Opening gallery with id:", id);
    if (!id) {
        console.error("Invalid gallery ID");
        return;
    }
    
    // The id parameter is already the encoded path from the server
    // so we can use it directly
    let path = './?id=' + encodeURIComponent(id);
    
    // Save scroll position before navigation
    const galleryDiv = document.getElementById('galleryDiv');
    if (galleryDiv) {
        pageCookieSet('scrollPosition', galleryDiv.scrollTop);
    }
    
    window.location = path;
}

function pageCookieGet(key) {
    let temp = Cookies.get(key + "." + window.location);
    if (temp === "true") temp = true;
    if (temp === "false") temp = false;
    return temp;
}

function pageCookieSet(key, value) {
    Cookies.set(key + "." + window.location, value);
}

function pageCookieClear(key) {
    Cookies.remove(key + "." + window.location);
}

function sortGallery(type) {
    // If clicking the same sort type, just reverse the order
    if (type === pageCookieGet('sortType')) {
        sortReverse = !sortReverse;
        console.log("Toggling sort direction for " + type);
    } else {
        // Switching to new sort type, start with ascending
        sortReverse = false;
        console.log("Changing sort type to " + type);
    }
    pageCookieSet('sortType', type);
    pageCookieSet('sortReverse', sortReverse);
    setSortIcons();
    sortElements();
}

function sortElements() {
    console.log("Sort fired!");
    shuffleInstance.sort({
        compare: function (a, b) {
            // Sort by dir, then media
            let typeA = a.element.getAttribute('data-type');
            let typeB = b.element.getAttribute('data-type');
            let favA = (a.element.getAttribute('data-favorite') === 'true');
            let favB = (b.element.getAttribute('data-favorite') === 'true');
            if (typeA === 'dir' && typeB !== 'dir') {
                return -1;
            }
            if (typeB === 'dir' && typeA !== 'dir') {
                return 1;
            }

            if (favA && !favB) {
                console.log("FAVA");
                return -1;
            }
            if (!favA && favB) {
                console.log("FavB");
                return 1;
            }

            return sortByValue(a, b);
        }
    });
    getMedia();
    sortDom();
}

function setListeners() {
    $(document).bind('webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange', function() {
        let tb = $('.lg-toolbar');
        let to = $('.lg-thumb-outer');
        let ln = $('.lg-next');
        let lp = $('.lg-prev');
        let isFullScreen = document.fullScreen ||
            document.mozFullScreen ||
            document.webkitIsFullScreen || (document.msFullscreenElement != null);
        if (isFullScreen) {
            console.log('fullScreen!');
            tb.hide();
            to.hide();
            ln.hide();
            lp.hide();
        } else {
            tb.show();
            to.show();
            ln.show();
            lp.show();
        }
    });

    $(document).on('click', '.favIcon', function (e) {
        toggleFavorite($(this));
        e.stopPropagation();
    });

    $(document).on('touchstart','.lg-current', function() {
        // When touch starts on the current slide, show controls
        showAndFadeControls();
    });

    $(document).on('touchend','.lg-current', function() {
        // When touch ends on the current slide, show controls
        showAndFadeControls();
    });

    $(document).on('click', 'video, .lg-object.lg-image', function() {
        // Show controls when clicking on video or image
        showAndFadeControls();
    });

    // Optimize thumbnail click handler for better performance
    $(document).on('click', '.thumbDiv', function(e) {
        console.time('thumb-click-handler');
        let type = $(this).data('type');
        let targetLink = $(this).data('link');
        
        if (type === 'dir') {
            openGallery(targetLink);
        } else if (type === 'file') {
            openFile(targetLink);
        } else if (type === 'vid' || type === 'img') {
            // Find the index directly without using Array.from
            const visibleMedia = document.querySelectorAll('.media.shuffle-item--visible');
            let index = -1;
            
            for (let i = 0; i < visibleMedia.length; i++) {
                if (visibleMedia[i] === this) {
                    index = i;
                    break;
                }
            }
            
            if (index !== -1) {
                console.log(`Opening gallery at index ${index}`);
                
                // CRITICAL FIX: Use a more direct approach to open the gallery
                // If gallery is not initialized, initialize it first
                if (!lg) {
                    console.log('Initializing gallery');
                    initGallery();
                    
                    // Wait for gallery to initialize before opening
                    const checkGalleryInitialized = setInterval(() => {
                        if (lg) {
                            clearInterval(checkGalleryInitialized);
                            console.log(`Gallery initialized, opening at index ${index}`);
                            lg.openGallery(index);
                        }
                    }, 50);
                } else {
                    // Gallery is already initialized, open directly
                    console.log(`Gallery already initialized, opening at index ${index}`);
                    lg.openGallery(index);
                }
            }
        }
        console.timeEnd('thumb-click-handler');
        return false;
    });

    $("#searchBox").on('input', function () {
        let searchText = $(this).val();
        shuffleInstance.filter(function (element) {
            let name = element.getAttribute('data-name');
            let titleText = name.toLowerCase().trim();
            return titleText.indexOf(searchText) !== -1;
        });
        sortDom();
    });

    let sp = pageCookieGet('scrollPosition');
    if (sp !== undefined) {
        console.log("We have a jump position: " + sp);
        const galleryDiv = document.getElementById('galleryDiv');
        if (galleryDiv) {
            galleryDiv.scrollTop = sp;
        }
        pageCookieClear('scrollPosition');
    }
}

function sortDom() {
    console.time('sort-dom');
    console.log('Sorting DOM elements');
    
    let items = shuffleInstance.items;
    let sorted = items.sort(sortByPosition);
    let gc = $('#galleryContent');
    let last = false;
    
    console.log(`Reordering ${sorted.length} items in the DOM`);
    $.each(sorted, function (key, value) {
        let elem = $(value.element);
        if (key === 0) {
            gc.prepend(elem);
        } else {
            last.after(elem);
        }
        last = elem;
    });

    // Update lazy loading after DOM changes
    if (window.bLazy) {
        console.time('blazy-revalidate');
        console.log('Revalidating lazy loading');
        window.bLazy.revalidate();
        console.timeEnd('blazy-revalidate');
    }
    
    // Only reinitialize gallery if it's already been initialized
    // or if we're explicitly sorting (not just on initial load)
    if (lg) {
        console.log('Reinitializing gallery after sorting');
        
        // Destroy existing gallery before reinitializing
        console.time('gallery-destroy');
        lg.destroy();
        lg = null;
        console.timeEnd('gallery-destroy');
        
        // Delay initialization slightly to allow DOM to settle
        setTimeout(() => {
            initGallery();
        }, 10);
    }
    
    console.timeEnd('sort-dom');
}

function sortByPosition(a, b) {
    let aX = a.point.x;
    let aY = a.point.y;
    let bX = b.point.x;
    let bY = b.point.y;
    if (aY > bY) {
        return 1;
    }

    if (aY < bY) {
        return -1;
    }

    if (aX > bX) {
        return 1;
    }
    if (aX < bX) {
        return -1;
    }
    return 0;
}

function sortByValue(a, b) {
    let aVal;
    let bVal;
    const type = pageCookieGet("sortType") || 'name';
    
    if (type === 'name') {
        aVal = a.element.getAttribute('data-name');
        bVal = b.element.getAttribute('data-name');
    } else if (type === 'time') {
        aVal = a.element.getAttribute('data-time');
        bVal = b.element.getAttribute('data-time');
    } else if (type === 'type') {
        aVal = a.element.getAttribute('data-type');
        bVal = b.element.getAttribute('data-type');
    }
    
    return sortReverse ? ((aVal > bVal) ? -1 : ((aVal < bVal) ? 1 : 0)) : ((aVal < bVal) ? -1 : ((aVal > bVal) ? 1 : 0));
}

function thumbDisplayName(name) {
    let dispName = name.substring(0, 20);
    if (name.length > 20) {
        dispName += '...';
    }
    dispName = dispName.replace("%20", "");
    return dispName;
}

function toggleFavorite(el) {
    let parent = el.closest('.thumbDiv');
    let id = parent.data('link');
    let isFav = (parent.data('favorite'));
    console.log("Parent fav: " + parent.data('favorite'));
    let clone = parent.clone();
    clone.attr('data-favorite', !isFav);
    clone.addClass('clone');
    $('#galleryContent').append(clone);
    console.log("Setting favorite to " + !isFav + " for ", parent);
    shuffleInstance.remove(parent);
    shuffleInstance.add(clone);
    $('.clone').removeClass('clone');
    getMedia();
    let child = clone.find('.fa-star');
    child.toggleClass('fa');
    child.toggleClass('far');

    let url = './favorite?id=' + id;
    if (isFav) url += "&delete";
    console.log("URL: " + url);
    $.getJSON(url, function (data) {
        if (data !== "error") {
            console.log("REBUILDING.");
        } else {
            console.error("Something bad happened...");
        }
    });
    sortElements();
    setSortIcons();
}

function openGalleryItem(index) {
    console.time('open-gallery-item-total');
    console.log(`Opening gallery item at index: ${index}`);
    
    // If gallery is not initialized, set the index to open and initialize the gallery
    if (!lg) {
        console.log('Gallery not initialized, initializing now');
        galleryIndexToOpen = index;
        initGallery();
        
        // Optional: Use a check interval if you want to monitor initialization
        const checkGalleryInitialized = setInterval(() => {
            if (lg) {
                clearInterval(checkGalleryInitialized);
                // Do nothing here as onAfterOpen in initGallery will handle opening the gallery
                console.timeEnd('open-gallery-item-total');
            }
        }, 50);
    } else {
        console.log(`Gallery already initialized, opening at index ${index}`);
        lg.openGallery(index);
        console.timeEnd('open-gallery-item-total');
    }
}

function showControls() {
    if (!lg || !lg.$container) return;
    $('.lg-toolbar, .lg-prev, .lg-next').css('opacity', '1');
    isControlsVisible = true;
}

function hideControls() {
    if (!lg || !lg.$container) return;
    $('.lg-toolbar, .lg-prev, .lg-next').css('opacity', '0');
    isControlsVisible = false;
}

function setSort() {
    let sortCheck = pageCookieGet('sortByName');
    let orderCheck = pageCookieGet('sortReverse');
    if (sortCheck !== undefined) {
        console.log("We have a sort by name cookie: " + sortCheck);
        sortByName = sortCheck;
    }
    if (orderCheck !== undefined) {
        console.log("We have an order cookie: " + orderCheck);
        sortReverse = orderCheck;
    }
    setSortIcons();
}

function setSortIcons() {
    const type = pageCookieGet("sortType") || 'name';
    
    // Reset all icons to base state
    $('.sort-name-icon').removeClass('fa-sort-alpha-up fa-sort-alpha-down').addClass('fa-sort-alpha-down');
    $('.sort-time-icon').removeClass('fa-sort-numeric-up fa-sort-numeric-down').addClass('fa-sort-numeric-down');
    $('.sort-type-icon').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort');
    
    // Remove active state from all sort buttons
    $('[onclick^="sortGallery"]').removeClass('active');
    
    // Add active state to current sort button
    $(`[onclick="sortGallery('${type}')"]`).addClass('active');
    
    // Update active sort icon based on direction
    const sortDir = sortReverse ? "up" : "down";
    if (type === 'name') {
        $('.sort-name-icon').removeClass('fa-sort-alpha-down fa-sort-alpha-up').addClass('fa-sort-alpha-' + sortDir);
    } else if (type === 'time') {
        $('.sort-time-icon').removeClass('fa-sort-numeric-down fa-sort-numeric-up').addClass('fa-sort-numeric-' + sortDir);
    } else if (type === 'type') {
        $('.sort-type-icon').removeClass('fa-sort').addClass('fa-sort-' + sortDir);
    }
}
