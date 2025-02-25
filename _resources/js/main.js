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
}

function setupControls() {
    // Size slider control
    $('.size-slider').on('input', function(e) {
        document.documentElement.style.setProperty('--grid-size', `${e.target.value}px`);
    });

    // Slideshow controls
    $('#slideshowBtn').on('click', function() {
        isSlideshow = !isSlideshow;
        const icon = $(this).find('i');
        icon.toggleClass('fa-play fa-pause');
        
        try {
            if (lg) {
                lg.destroy();
                lg = null;
            }
            initGallery();
        } catch (error) {
            console.error('Error toggling slideshow:', error);
        }
    });

    $('#shuffleBtn').on('click', function() {
        isRandom = !isRandom;
        const icon = $(this).find('i');
        icon.toggleClass('fa-random fa-long-arrow-alt-right');
        
        try {
            if (lg) {
                lg.destroy();
                lg = null;
            }
            initGallery();
        } catch (error) {
            console.error('Error toggling shuffle:', error);
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
        let name = thumbDisplayName(obj['name']);
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

        if (type === 'vid') {
            typeIcon = 'video';
            // Decode base64 to get the actual filename
            let decodedLink = atob(obj['link']);
            let vidType = decodedLink.split('.').pop().toLowerCase();
            mDiv.classList.add("video");
            mDiv.classList.add("media");
            
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
            mDiv.setAttribute("data-video", JSON.stringify(videoConfig));
            
            // For videos, we don't set data-src as per documentation
            mDiv.removeAttribute("data-src");
        }

        mDiv.setAttribute("data-name", name);
        mDiv.setAttribute("data-type", type);
        mDiv.setAttribute("data-time", obj['time']);
        mDiv.setAttribute("data-size", obj['size']);
        mDiv.setAttribute("data-link", obj['link']);
        if (isFav) mDiv.setAttribute("data-favorite", "true");
        if (type === "img") {
            mDiv.setAttribute("data-src", mediaPath);
            // Add data-responsive attribute for responsive images
            mDiv.setAttribute("data-responsive", mediaPath);
            // CRITICAL FIX: Add sub-html attribute to prevent reloading
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

        // Add video overlay for video files
        if (type === 'vid') {
            let overlay = document.createElement("div");
            overlay.classList.add("video-overlay");
            let playIcon = document.createElement("img");
            playIcon.src = '/img/play_video.png';
            overlay.appendChild(playIcon);
            a.appendChild(overlay);
        }

        ai.appendChild(ri);
        a.appendChild(ai);
        mDiv.appendChild(a);

        let ttd = document.createElement("div");
        ttd.classList.add("thumbtitle", "decorator");
        ttd.innerHTML = name;
        let tid = document.createElement("div");
        tid.classList.add("typeIcon", "decorator");
        let icon = document.createElement("i");
        icon.classList.add('fa', 'fa-' + typeIcon);
        tid.appendChild(icon);
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
    
    const isPlaying = lg.autoplay;
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

// Modify the initGallery function to use the patch
function initGallery() {
    try {
        console.time('gallery-init-total');
        console.log('Initializing gallery...');
        
        // Clean up any existing instance
        if (lg) {
            console.log('Destroying existing gallery instance');
            console.time('gallery-destroy');
            $('.lg-counter').remove();
            lg.destroy();
            lg = null;
            console.timeEnd('gallery-destroy');
        }
        
        galleryElement = document.getElementById("galleryContent");
        if (!galleryElement) {
            console.warn('Gallery element not found');
            return;
        }
        
        // Add event listeners for monitoring
        galleryElement.addEventListener("lgInit", function(event) {
            console.log('Gallery initialized event fired');
            lg = event.detail.instance;
            
            // CRITICAL FIX: Patch the lightGallery core to prevent reloading
            patchLightGalleryCore(lg);
            
            // Add navigation buttons if needed
            const previousBtn = '<button type="button" aria-label="Previous slide" class="lg-prev"></button>';
            const nextBtn = '<button type="button" aria-label="Next slide" class="lg-next"></button>';
            const lgContainer = document.getElementById("galleryDiv");
            
            // Only add buttons if they don't exist
            if (!document.querySelector(".lg-next")) {
                console.log('Adding navigation buttons');
                lgContainer.insertAdjacentHTML("beforeend", nextBtn);
                lgContainer.insertAdjacentHTML("beforeend", previousBtn);
                
                document.querySelector(".lg-next").addEventListener("click", function() {
                    console.time('next-slide');
                    console.log('Next button clicked');
                    lg.goToNextSlide();
                    console.timeEnd('next-slide');
                });
                
                document.querySelector(".lg-prev").addEventListener("click", function() {
                    console.time('prev-slide');
                    console.log('Previous button clicked');
                    lg.goToPrevSlide();
                    console.timeEnd('prev-slide');
                });
            }
            
            // Make navigation buttons visible
            const prev = document.querySelector('.lg-prev');
            const next = document.querySelector('.lg-next');
            if (prev) prev.style.opacity = '1';
            if (next) next.style.opacity = '1';
            
            showPagers();
        });
        
        // Event listeners for performance monitoring
        galleryElement.addEventListener("lgBeforeOpen", function() {
            console.time('gallery-open');
            console.log('Gallery before open event');
        });
        
        galleryElement.addEventListener("lgAfterOpen", function() {
            console.timeEnd('gallery-open');
            console.log('Gallery after open event');
            showPagers();
        });
        
        galleryElement.addEventListener("lgBeforeSlide", function(event) {
            const { index, prevIndex } = event.detail;
            console.time(`slide-${prevIndex}-to-${index}`);
            console.log(`Slide transition starting: ${prevIndex} -> ${index}`);
        });
        
        galleryElement.addEventListener("lgAfterSlide", function(event) {
            const { index, prevIndex } = event.detail;
            console.timeEnd(`slide-${prevIndex}-to-${index}`);
            console.log(`Slide transition complete: ${prevIndex} -> ${index}`);
            showPagers();
        });
        
        galleryElement.addEventListener("lgSlideItemLoad", function(event) {
            const { index } = event.detail;
            console.time(`slide-item-load-${index}`);
            console.log(`Slide item ${index} loading started`);
        });
        
        // Track when slide item load is complete
        galleryElement.addEventListener("lgAfterSlide", function(event) {
            const { index } = event.detail;
            try {
                console.timeEnd(`slide-item-load-${index}`);
                console.log(`Slide item ${index} loading complete`);
            } catch (e) {
                // Timer might not exist, ignore
            }
        });
        
        // Use the original approach with selector instead of dynamic elements
        const speed = parseInt($('#slideshowSpeed').val() || 3) * 1000;
        console.log('Gallery speed setting:', speed);
        
        console.time('lightGallery-init');
        console.log('Creating lightGallery with selector mode');
        
        // Count visible media items
        const visibleItems = document.querySelectorAll('.thumbDiv.media.shuffle-item--visible');
        console.log(`Initializing gallery with ${visibleItems.length} visible items`);
        
        // CRITICAL FIX: Optimize gallery configuration to prevent reloading
        lg = lightGallery(galleryElement, {
            plugins: [lgZoom, lgVideo, lgFullscreen, lgAutoplay],
            speed: 500,
            selector: '.thumbDiv.media.shuffle-item--visible',
            preload: 3, // Set to 0 to only load the current slide
            download: false,
            counter: true,
            autoplayControls: true,
            autoplay: isSlideshow,
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
            // Critical performance optimizations
            loadYouTubeThumbnail: false,
            loadVimeoThumbnail: false,
            thumbWidth: 100,
            thumbHeight: 100,
            thumbMargin: 5,
            showThumbByDefault: false,
            allowMediaOverlap: false,
            getCaptionFromTitleOrAlt: false,
            subHtmlSelectorRelative: false,
            // Disable unnecessary features
            mousewheel: false,
            backdropDuration: 0,
            startAnimationDuration: 0,
            hideBarDelay: 2000,
            loadYouTubeVideoOnOpen: false,
            loadVimeoVideoOnOpen: false,
            // CRITICAL FIX: Disable unnecessary callbacks
            onBeforeNextSlide: false,
            onBeforePrevSlide: false
        });
        
        console.timeEnd('lightGallery-init');
        console.timeEnd('gallery-init-total');
    } catch (error) {
        console.error('Error initializing lightGallery:', error);
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
    if (type === 'type') {
        sortByName = !sortByName;
        console.log("Changing sortyByName to " + sortByName);
        pageCookieSet("sortByName", sortByName);
    } else {
        sortReverse = !sortReverse;
        console.log("Changing reverse sort to " + sortReverse);
        pageCookieSet("sortReverse", sortReverse);
    }
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
        trackTouch = true;
    });

    $(document).on('touchend','.lg-current', function() {
        if (trackTouch) {
            console.log("TouchEnd!");
            trackTouch = false;
        }
    });

    $(document).on('touchstart','video', function() {
        trackTouch = true;
    });

    $(document).on('touchend','video', function() {
        if (trackTouch) {
            trackTouch = false;
            showPagers();
        }
    });

    $(document).on('touchstart','.lg-object.lg-image', function() {
        trackTouch = true;
    });

    $(document).on('touchend','.lg-object.lg-image', function() {
        if (trackTouch) {
            trackTouch = false;
            showPagers();
        }
    });

    $(document).on('click', 'video', function() {
        showPagers();
    });

    $(document).on('click', '.lg-object.lg-image', function() {
        showPagers();
    });

    $(document).on('mouseenter', '.lg-next, .lg-prev', function() {
        pausePage = true;
        this.style.opacity = '1';
        if (fadeTimeout) clearTimeout(fadeTimeout);
    });

    $(document).on('mouseleave', '.lg-next, .lg-prev', function() {
        pausePage = false;
        if (fadeTimeout) clearTimeout(fadeTimeout);
        fadeTimeout = setTimeout(() => {
            if (!pausePage) {
                const prev = document.querySelector('.lg-prev');
                const next = document.querySelector('.lg-next');
                if (prev) prev.style.opacity = '0';
                if (next) next.style.opacity = '0';
            }
        }, 3000);
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

    $("#divFilter").on('input', function () {
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

    // Navigation button handlers
    $(document).on('mouseenter', '.lg-next, .lg-prev', function() {
        this.style.opacity = '1';
    });

    $(document).on('mouseleave', '.lg-next, .lg-prev', function() {
        if (!lg || !lg.$container) return;
        const isFullscreen = document.fullscreenElement || 
                           document.webkitFullscreenElement || 
                           document.mozFullScreenElement;
        if (!isFullscreen) {
            this.style.opacity = '0';
        }
    });
}

function showPagers() {
    console.time('show-pagers');
    
    // Clear any existing timeouts to prevent multiple fades
    if (fadeTimeout !== null) {
        clearTimeout(fadeTimeout);
        fadeTimeout = null;
    }
    
    if (fadeInt !== null) {
        clearInterval(fadeInt);
        fadeInt = null;
    }
    
    // Get navigation buttons
    let nb = document.querySelectorAll(".lg-next");
    let pb = document.querySelectorAll(".lg-prev");
    
    // If no buttons found, exit early
    if (nb.length === 0 && pb.length === 0) {
        console.timeEnd('show-pagers');
        return;
    }
    
    let op = 1;  // initial opacity

    // Set initial opacity
    for (let i = 0; i < nb.length; i++) {
        nb[i].style.opacity = op;
    }
    for (let i = 0; i < pb.length; i++) {
        pb[i].style.opacity = op;
    }
    
    // If page is paused, keep buttons visible
    if (pausePage) {
        console.timeEnd('show-pagers');
        return;
    }
    
    // Set timeout to fade out buttons
    fadeTimeout = setTimeout(function() {
        fadeInt = setInterval(function() {
            if (op <= 0.1) {
                for (let i = 0; i < nb.length; i++) {
                    nb[i].style.opacity = "0";
                }
                for (let i = 0; i < pb.length; i++) {
                    pb[i].style.opacity = "0";
                }
                clearInterval(fadeInt);
                fadeInt = null;
                return;
            }
            
            op -= op * 0.1;
            
            for (let i = 0; i < nb.length; i++) {
                nb[i].style.opacity = op;
            }
            for (let i = 0; i < pb.length; i++) {
                pb[i].style.opacity = op;
            }
        }, 50);
    }, 3000);
    
    console.timeEnd('show-pagers');
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
    let dirIcon = $('.dirIcon');
    let selIcon = $('.selIcon');
    let sortDir = sortReverse ? "up" : "down";
    let typeIcon;
    if (sortByName) {
        typeIcon = 'fa-sort-alpha-' + sortDir;
    } else {
        typeIcon = 'fa-sort-numeric-' + sortDir;
    }
    dirIcon.removeClass('fa-sort-down fa-sort-up');
    selIcon.removeClass('fa-sort-alpha-up fa-sort-alpha-down fa-sort-numeric-up fa-sort-numeric-down');
    selIcon.addClass(typeIcon);
    dirIcon.addClass('fa-sort-' + sortDir);
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
    if (sortByName) {
        aVal = a.element.getAttribute('data-name');
        bVal = b.element.getAttribute('data-name');
    } else {
        aVal = a.element.getAttribute('data-time');
        bVal = b.element.getAttribute('data-time');
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
    
    // CRITICAL FIX: Use a more direct approach to open the gallery
    if (!lg) {
        console.log('Gallery not initialized, initializing now');
        initGallery();
        
        // Wait for gallery to initialize before opening
        const checkGalleryInitialized = setInterval(() => {
            if (lg) {
                clearInterval(checkGalleryInitialized);
                console.log(`Gallery initialized, opening at index ${index}`);
                lg.openGallery(index);
                console.timeEnd('open-gallery-item-total');
            }
        }, 50);
    } else {
        // Gallery is already initialized, open directly
        console.log(`Gallery already initialized, opening at index ${index}`);
        lg.openGallery(index);
        console.timeEnd('open-gallery-item-total');
    }
}
