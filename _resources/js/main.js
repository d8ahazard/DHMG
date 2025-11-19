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

    // PIN Protection - check on page load
    checkPinProtection();

    protectedLinks = $('#protectKey').attr('content');
    setSort();
    setInitialGridSize();
    setupControls();
    setupGalleryControls();
    fetchGallery();
    
    // Update grid size on orientation change
    window.addEventListener('orientationchange', function() {
        setTimeout(function() {
            setInitialGridSize();
            if (shuffleInstance) {
                shuffleInstance.update();
            }
        }, 200);
    });
    
    // Also update on window resize (for desktop or when keyboard appears on mobile)
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            setInitialGridSize();
            if (shuffleInstance) {
                shuffleInstance.update();
            }
        }, 250);
    });
});

// PIN Protection Functions
function checkPinProtection() {
    fetch('./check_pin_status')
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Server error');
            }
        })
        .then(data => {
            if (data.pin_required) {
                showPinModal();
            }
        })
        .catch(error => {
            console.error('Error checking PIN status:', error);
            // If we can't check PIN status, show the modal anyway to be safe
            showPinModal();
        });
}

function showPinModal() {
    const modal = $('#pinModal');
    modal.show();

    // Focus on PIN input
    setTimeout(() => {
        $('#pinInput').focus();
    }, 100);

    // Handle PIN input
    $('#pinInput').off('keypress').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            verifyPin();
        }
    });

    // Handle verify button
    $('#verifyPinBtn').off('click').on('click', verifyPin);
}

function closePinModal() {
    $('#pinModal').hide();
    $('#pinInput').val('');
    $('#pinStatus').html('');
}

function verifyPin() {
    const pin = $('#pinInput').val().trim();
    if (!pin) {
        $('#pinStatus').html('<span style="color: red;">Please enter a PIN</span>');
        return;
    }

    $('#pinStatus').html('<span style="color: var(--color-accent);">Verifying...</span>');
    $('#verifyPinBtn').prop('disabled', true);

    fetch('./verify_pin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin: pin })
    })
    .then(response => response.json())
    .then(data => {
        if (data.authorized) {
            $('#pinStatus').html('<span style="color: green;">Access granted! Loading gallery...</span>');
            setTimeout(() => {
                closePinModal();
                // Reload the gallery data instead of the full page
                fetchGallery();
            }, 1000);
        } else {
            $('#pinStatus').html('<span style="color: red;">Invalid PIN. Please try again.</span>');
            $('#pinInput').val('').focus();
        }
    })
    .catch(error => {
        console.error('Error verifying PIN:', error);
        $('#pinStatus').html('<span style="color: red;">Error verifying PIN. Please try again.</span>');
    })
    .finally(() => {
        $('#verifyPinBtn').prop('disabled', false);
    });
}

function setInitialGridSize() {
    // Set larger size for mobile portrait to ensure thumbnails and text are readable
    let defaultSize;
    if (window.innerWidth <= 768) {
        // Check if portrait or landscape
        if (window.innerHeight > window.innerWidth) {
            // Portrait mode - larger thumbnails for better visibility
            defaultSize = 180;
        } else {
            // Landscape mode - smaller thumbnails to fit more
            defaultSize = 120;
        }
    } else {
        defaultSize = 200;
    }
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
            console.log('Slideshow button clicked');
            isSlideshow = !isSlideshow; // Toggle slideshow state
            
            if (lg && lg.modules && lg.modules.autoplay) {
                // If lightGallery is initialized
                if (isSlideshow) {
                    console.log('Starting slideshow');
                    lg.settings.slideShowAutoplay = true;
                    lg.modules.autoplay.startSlideShow();
                    
                    if (!lg.$container.hasClass('lg-show-in')) {
                        console.log('Opening gallery for slideshow');
                        lg.openGallery(lg.index || 0);
                    }
                    
                    // Update button icon
                    $('#slideshowBtn').find('i').removeClass('fa-play').addClass('fa-pause');
                } else {
                    console.log('Stopping slideshow');
                    lg.settings.slideShowAutoplay = false;
                    lg.modules.autoplay.stopSlideShow();
                    
                    // Update button icon
                    $('#slideshowBtn').find('i').removeClass('fa-pause').addClass('fa-play');
                }
            } else {
                // Initialize gallery with slideshow enabled and open it
                console.log('Initializing gallery with slideshow');
                isSlideshow = true; // Ensure slideshow is enabled
                $('#slideshowBtn').find('i').removeClass('fa-play').addClass('fa-pause');
                
                initGallery();
                
                // Wait for gallery to initialize before opening
                const checkGalleryInitialized = setInterval(() => {
                    if (lg) {
                        clearInterval(checkGalleryInitialized);
                        console.log('Opening gallery after initialization');
                        lg.openGallery(0);
                        
                        // For mobile: enter fullscreen automatically for better experience
                        if (window.innerWidth <= 768) {
                            setTimeout(function() {
                                console.log('Auto entering fullscreen on mobile');
                                $('.lg-fullscreen').trigger('click');
                            }, 500);
                        }
                    }
                }, 50);
            }
        } catch (error) {
            console.error('Error toggling slideshow:', error);
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

    // Update gallery close handler - DO NOT auto-reset shuffle order
    $(document).off('lgAfterClose').on('lgAfterClose', function() {
        console.log('Gallery closed, stopping slideshow');
        isSlideshow = false;
        if (lg && lg.modules && lg.modules.autoplay) {
            lg.settings.slideShowAutoplay = false;
            lg.modules.autoplay.stopSlideShow();
        }
        
        // DO NOT reset shuffle order - let users keep their randomized layout
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
                    autoplay: true
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
        rootMargin: '50px', // Start loading images 50px before they come into view
        threshold: 0.01, // Very small threshold for better performance
        success: function(ele){
            if (ele.getAttribute('data-src')) {
                ele.classList.add('loaded');
                console.log('Image loaded successfully:', ele.src);
            }
        },
        error: function(ele, msg){
            console.error('Blazy error:', msg, 'for element:', ele);
            if (ele.getAttribute('data-src-fallback')) {
                ele.src = ele.getAttribute('data-src-fallback');
                ele.classList.add('reloaded');
                console.log('Applied fallback image for:', ele.getAttribute('data-src'));
            }
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

    // Hide loading indicator after everything is built and displayed
    setTimeout(() => {
        $('#loadingIndicator').removeClass('show');
        console.log('Loading indicator hidden after gallery build complete');
    }, 100);
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

function persistSlideshowState() {
    // This function ensures the slideshow state is properly maintained
    // across fullscreen toggles and other UI interactions
    if (!lg || !lg.modules || !lg.modules.autoplay) return;
    
    console.log('Persisting slideshow state, current slideshow status:', isSlideshow);
    
    if (isSlideshow) {
        // Make sure slideshow settings are applied
        lg.settings.slideShowAutoplay = true;
        
        // Check if we need to restart the slideshow
        if (!lg.modules.autoplay.slideShowStatus) {
            console.log('Restarting stopped slideshow');
            lg.modules.autoplay.startSlideShow();
        }
        
        // Update button state
        $('#slideshowBtn').find('i').removeClass('fa-play').addClass('fa-pause');
    } else {
        // Make sure slideshow is stopped if it shouldn't be running
        if (lg.modules.autoplay.slideShowStatus) {
            console.log('Stopping slideshow that should be stopped');
            lg.settings.slideShowAutoplay = false;
            lg.modules.autoplay.stopSlideShow();
        }
        
        // Update button state
        $('#slideshowBtn').find('i').removeClass('fa-pause').addClass('fa-play');
    }
}

function fetchGallery() {
    console.time('fetch-gallery');

    // Show loading indicator
    $('#loadingIndicator').addClass('show');

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

        // Hide loading indicator after gallery is built
        $('#loadingIndicator').removeClass('show');
    })
    .fail(function (jqXHR, textStatus, errorThrown) {
        console.error("JSON Fetch failed:", textStatus, errorThrown);
        console.error("Response:", jqXHR.responseText);

        // Check if it's an authentication error
        if (jqXHR.status === 401) {
            console.log("Authentication required, showing PIN modal");
            $('#loadingIndicator').removeClass('show');
            showPinModal();
            return;
        }

        // Hide loading indicator on other errors too
        $('#loadingIndicator').removeClass('show');

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

function setupGalleryControls() {
    // Remove any existing handlers first
    $(window).off('click.gallery-controls');
    
    // Set up the global click handler
    $(window).on('click.gallery-controls', function(e) {
        // Only proceed if we have a gallery open
        const $container = $('.lg-container');
        if (!$container.length) return;
        
        const $target = $(e.target);
        
        // Don't handle clicks on controls or video elements
        if ($target.closest('.lg-toolbar, .lg-prev, .lg-next, .lg-video-play-button, .lg-video-cont video').length) {
            return;
        }
        
        // Handle clicks on gallery content
        if ($target.closest('.lg-object, .lg-container, .lg-item').length) {
            console.log('Gallery content clicked, toggling controls');
            const isVisible = $container.hasClass('lg-show-controls');
            console.log('Controls currently visible:', isVisible);
            
            if (isVisible) {
                $container.removeClass('lg-show-controls');
            } else {
                $container.addClass('lg-show-controls');
            }
            
            e.preventDefault();
            e.stopPropagation();
        }
    });
}

function isMobileDevice() {
    return (window.innerWidth <= 768) ||
           (navigator.userAgent.match(/Android/i) ||
            navigator.userAgent.match(/webOS/i) ||
            navigator.userAgent.match(/iPhone/i) ||
            navigator.userAgent.match(/iPad/i) ||
            navigator.userAgent.match(/iPod/i) ||
            navigator.userAgent.match(/BlackBerry/i) ||
            navigator.userAgent.match(/Windows Phone/i));
}

// Add mobile close button for better mobile UX
function addMobileCloseButton() {
    if (!isMobileDevice()) return;

    // Remove existing button if present
    removeMobileCloseButton();

    // Create the close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'lg-mobile-close-btn';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.title = 'Close Gallery';
    closeBtn.setAttribute('aria-label', 'Close Gallery');

    // Add click handler
    closeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        if (lg) {
            lg.closeGallery();
        }
    });

    // Add to gallery container
    const galleryContainer = document.querySelector('.lg-container');
    if (galleryContainer) {
        galleryContainer.appendChild(closeBtn);

        // Show button after a short delay
        setTimeout(() => {
            closeBtn.classList.add('show');
        }, 500);

        // Set up auto-hide/show based on user activity
        setupMobileCloseButtonVisibility(closeBtn, galleryContainer);
    }
}

// Remove mobile close button
function removeMobileCloseButton() {
    const existingBtn = document.querySelector('.lg-mobile-close-btn');
    if (existingBtn) {
        existingBtn.remove();
    }
}

// Set up mobile close button visibility based on user activity
function setupMobileCloseButtonVisibility(closeBtn, galleryContainer) {
    let hideTimeout;
    let isUserActive = false;

    function showCloseButton() {
        if (!galleryContainer.classList.contains('lg-show-controls')) {
            closeBtn.classList.add('show');
        }
        isUserActive = true;

        // Hide after 3 seconds of inactivity
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            if (!galleryContainer.classList.contains('lg-show-controls')) {
                closeBtn.classList.remove('show');
            }
            isUserActive = false;
        }, 3000);
    }

    function hideCloseButton() {
        if (!galleryContainer.classList.contains('lg-show-controls')) {
            closeBtn.classList.remove('show');
        }
        isUserActive = false;
    }

    // Show button on various user interactions
    const events = ['touchstart', 'touchmove', 'click', 'mousemove', 'keydown'];

    events.forEach(event => {
        galleryContainer.addEventListener(event, showCloseButton, { passive: true });
    });

    // Hide button when controls are shown (to avoid overlap)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (galleryContainer.classList.contains('lg-show-controls')) {
                    closeBtn.classList.remove('show');
                } else if (isUserActive) {
                    closeBtn.classList.add('show');
                }
            }
        });
    });

    observer.observe(galleryContainer, { attributes: true, attributeFilter: ['class'] });
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
        
        // Determine if on mobile
        const isMobile = isMobileDevice();
        console.log('Initializing gallery, mobile device detected:', isMobile);

        // Initialize gallery with performance-optimized config
        lg = lightGallery(galleryElement, {
            plugins: [lgZoom, lgVideo, lgFullscreen, lgAutoplay],
            speed: isMobile ? 300 : 500, // Faster transitions on mobile
            selector: '.thumbDiv.media.shuffle-item--visible',
            preload: isMobile ? 1 : 2, // Reduce preload on mobile for performance
            download: false,
            counter: true,
            autoplayControls: true,
            slideShowAutoplay: isSlideshow,
            slideShowInterval: parseInt($('#slideshowSpeed').val() || 3) * 1000,
            progressBar: true,
            mode: isRandom ? 'lg-slide-random' : 'lg-slide',
            addClass: 'lg-custom-thumbnails' + (isMobile ? ' lg-mobile' : ''),
            mobileSettings: {
                controls: true,
                showCloseIcon: true,
                download: false,
                autoplayControls: true,
                // Performance optimizations for mobile
                speed: 300,
                preload: 1,
                hideControlOnEnd: false
            },
            hideControlOnEnd: false,
            controls: true,
            keyPress: true,
            enableDrag: !isMobile, // Disable drag on mobile for better touch performance
            enableSwipe: true,
            swipeThreshold: isMobile ? 30 : 50, // Lower threshold on mobile for better responsiveness
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
            hideBarDelay: isMobile ? 1500 : 2000, // Shorter delay on mobile
            loadYouTubeVideoOnOpen: false,
            loadVimeoVideoOnOpen: false,
            // Performance optimizations
            videojs: false, // Disable VideoJS for better performance with native HTML5 video
            videojsOptions: false
        });

        // Global variables for video management
        let currentPlayingVideo = null;
        let currentVolume = 0.7; // Default volume (70%)
        const VOLUME_STORAGE_KEY = 'gallery_video_volume';

        // Load saved volume from localStorage
        function loadSavedVolume() {
            try {
                const savedVolume = localStorage.getItem(VOLUME_STORAGE_KEY);
                if (savedVolume !== null) {
                    currentVolume = parseFloat(savedVolume);
                    if (isNaN(currentVolume) || currentVolume < 0 || currentVolume > 1) {
                        currentVolume = 0.7; // Reset to default if invalid
                    }
                }
            } catch (error) {
                console.warn('Could not load saved volume:', error);
                currentVolume = 0.7;
            }
        }

        // Save current volume to localStorage
        function saveCurrentVolume() {
            try {
                localStorage.setItem(VOLUME_STORAGE_KEY, currentVolume.toString());
            } catch (error) {
                console.warn('Could not save volume:', error);
            }
        }

        // Apply volume to a video element
        function applyVolumeToVideo(videoElement) {
            if (videoElement && typeof videoElement.volume !== 'undefined') {
                videoElement.volume = currentVolume;
                console.log(`Applied volume ${currentVolume} to video`);
            }
        }

        // Function to pause all videos except the specified one
        function pauseAllVideos(exceptVideo = null) {
            // Pause any HTML5 videos in the document
            $('video').not(exceptVideo).each(function() {
                if (!this.paused) {
                    // Store current volume before pausing
                    if (typeof this.volume !== 'undefined') {
                        this.dataset.lastVolume = this.volume;
                    }
                    this.pause();
                }
            });

            // If using LightGallery, pause any other videos through its API
            if (lg && lg.modules && lg.modules.video) {
                // The LightGallery video module should handle its own video pausing
                // but we'll ensure any playing videos are stopped
                const videoElements = document.querySelectorAll('video');
                videoElements.forEach(video => {
                    if (video !== exceptVideo && !video.paused) {
                        // Store current volume before pausing
                        if (typeof video.volume !== 'undefined') {
                            video.dataset.lastVolume = video.volume;
                        }
                        video.pause();
                    }
                });
            }

            // Update our tracking variable
            currentPlayingVideo = exceptVideo;
        }

        // Handle gallery events
        if (lg) {
            // When the gallery opens
            lg.LGel.on('lgAfterOpen', function() {
                console.log('Gallery opened, checking slideshow state');

                // Add mobile close button for better mobile UX
                addMobileCloseButton();

                // If slideshow mode is enabled, make sure it's running
                if (isSlideshow && lg.modules && lg.modules.autoplay) {
                    console.log('Starting slideshow after gallery opened');
                    lg.settings.slideShowAutoplay = true;
                    lg.modules.autoplay.startSlideShow();
                    $('#slideshowBtn').find('i').removeClass('fa-play').addClass('fa-pause');
                }

                // For mobile devices or slideshow mode, enter fullscreen automatically
                if (isSlideshow || isMobile) {
                    setTimeout(function() {
                        console.log('Auto entering fullscreen');
                        if (!document.fullscreenElement &&
                            !document.mozFullScreenElement &&
                            !document.webkitFullscreenElement &&
                            !document.msFullscreenElement) {
                            $('.lg-fullscreen').trigger('click');
                        }
                    }, 300);
                }
            });

            // When the gallery closes
            lg.LGel.on('lgAfterClose', function() {
                console.log('Gallery closed');
                if (isSlideshow) {
                    console.log('Slideshow was active, resetting state');
                    isSlideshow = false;
                    $('#slideshowBtn').find('i').removeClass('fa-pause').addClass('fa-play');
                }

                // Remove mobile close button
                removeMobileCloseButton();

                // Pause any playing videos when gallery closes
                pauseAllVideos();
                
                // Stop video observer
                stopVideoObserver();
            });

            // When autoplay starts/stops
            lg.LGel.on('lgAutoplayStart', function() {
                console.log('Autoplay started');
                isSlideshow = true;
                $('#slideshowBtn').find('i').removeClass('fa-play').addClass('fa-pause');
            });

            lg.LGel.on('lgAutoplayStop', function() {
                console.log('Autoplay stopped');
                isSlideshow = false;
                $('#slideshowBtn').find('i').removeClass('fa-pause').addClass('fa-play');
            });

            // Track which video elements already have listeners
            const processedVideos = new WeakSet();

            // Function to setup volume persistence for a video element
            function setupVideoVolumePersistence(videoElement) {
                if (!videoElement || videoElement.tagName !== 'VIDEO') {
                    console.log('setupVideoVolumePersistence: Invalid video element', videoElement);
                    return;
                }

                // Avoid duplicate setup
                if (processedVideos.has(videoElement)) {
                    console.log('setupVideoVolumePersistence: Video already processed, skipping');
                    return;
                }
                processedVideos.add(videoElement);

                console.log('setupVideoVolumePersistence: Setting up volume persistence for video element', videoElement);

                // Apply saved volume immediately if possible
                if (videoElement.readyState >= 1) { // HAVE_METADATA or higher
                    videoElement.volume = currentVolume;
                    console.log(`Applied saved volume ${currentVolume} immediately (readyState: ${videoElement.readyState})`);
                }

                // Apply saved volume when metadata is loaded (first time video is ready)
                const applyVolumeHandler = function() {
                    if (typeof videoElement.volume !== 'undefined') {
                        videoElement.volume = currentVolume;
                        console.log(`Applied saved volume ${currentVolume} on loadedmetadata`);
                    }
                };
                videoElement.addEventListener('loadedmetadata', applyVolumeHandler, { once: true });

                // Backup: Apply volume on canplay event
                const canplayHandler = function() {
                    if (videoElement.volume !== currentVolume) {
                        videoElement.volume = currentVolume;
                        console.log(`Applied saved volume ${currentVolume} on canplay`);
                    }
                };
                videoElement.addEventListener('canplay', canplayHandler, { once: true });

                // Backup: Apply volume on play event (in case loadedmetadata already fired)
                const playHandler = function() {
                    if (videoElement.volume !== currentVolume) {
                        videoElement.volume = currentVolume;
                        console.log(`Applied saved volume ${currentVolume} on play`);
                    }
                };
                videoElement.addEventListener('play', playHandler, { once: true });

                // Save volume when user changes it - using native event listener
                const volumeChangeHandler = function(e) {
                    console.log('volumechange event fired!', 'new volume:', this.volume, 'current saved:', currentVolume);
                    if (Math.abs(this.volume - currentVolume) > 0.001) { // Use threshold to avoid floating point issues
                        currentVolume = this.volume;
                        saveCurrentVolume();
                        console.log(`Volume changed to ${currentVolume}, saved to localStorage`);
                    }
                };
                // Try both jQuery and native event listeners
                videoElement.addEventListener('volumechange', volumeChangeHandler);
                $(videoElement).on('volumechange.lgVolumeControl', volumeChangeHandler);

                // Also listen for muted state changes
                const mutedChangeHandler = function() {
                    console.log('Video muted state changed:', this.muted);
                };
                videoElement.addEventListener('volumechange', mutedChangeHandler);

                console.log('setupVideoVolumePersistence: All event listeners attached');

                // Store the video element reference
                currentPlayingVideo = videoElement;
            }

            // MutationObserver to watch for dynamically added video elements
            let videoObserver = null;

            function startVideoObserver() {
                // Stop existing observer if any
                if (videoObserver) {
                    videoObserver.disconnect();
                }

                const galleryContainer = document.querySelector('.lg-container');
                if (!galleryContainer) {
                    console.log('Gallery container not found for observer');
                    return;
                }

                videoObserver = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                        mutation.addedNodes.forEach(function(node) {
                            // Check if the added node is a video element
                            if (node.tagName === 'VIDEO') {
                                console.log('MutationObserver: Video element added to DOM', node);
                                setupVideoVolumePersistence(node);
                                // Start playing the video
                                setTimeout(function() {
                                    const playPromise = node.play();
                                    if (playPromise !== undefined) {
                                        playPromise.then(function() {
                                            console.log('MutationObserver: Video playback started');
                                        }).catch(function(error) {
                                            console.log('MutationObserver: Autoplay prevented:', error.message);
                                        });
                                    }
                                }, 50);
                            }
                            // Check if the added node contains video elements
                            else if (node.querySelectorAll) {
                                const videos = node.querySelectorAll('video');
                                videos.forEach(function(video) {
                                    console.log('MutationObserver: Video element found in added node', video);
                                    setupVideoVolumePersistence(video);
                                    // Start playing the video
                                    setTimeout(function() {
                                        const playPromise = video.play();
                                        if (playPromise !== undefined) {
                                            playPromise.then(function() {
                                                console.log('MutationObserver: Video playback started');
                                            }).catch(function(error) {
                                                console.log('MutationObserver: Autoplay prevented:', error.message);
                                            });
                                        }
                                    }, 50);
                                });
                            }
                        });
                    });
                });

                videoObserver.observe(galleryContainer, {
                    childList: true,
                    subtree: true
                });

                console.log('Video MutationObserver started');
            }

            function stopVideoObserver() {
                if (videoObserver) {
                    videoObserver.disconnect();
                    videoObserver = null;
                    console.log('Video MutationObserver stopped');
                }
            }

            // Function to find and setup all video elements in current slide
            function findAndSetupVideos(slideIndex) {
                console.log('findAndSetupVideos: Searching for videos in slide', slideIndex);
                
                const $slide = lg.getSlideItem(slideIndex);
                console.log('findAndSetupVideos: Slide wrapper object', $slide);
                
                if (!$slide) {
                    console.log('findAndSetupVideos: Slide wrapper is null/undefined');
                    return;
                }
                
                // Get the actual DOM element from the lightgallery wrapper
                // Lightgallery uses a custom wrapper with a 'firstElement' property
                let slideElement = null;
                if ($slide.firstElement) {
                    slideElement = $slide.firstElement;
                    console.log('findAndSetupVideos: Got slide from .firstElement property');
                } else if ($slide.get) {
                    slideElement = $slide.get(0);
                    console.log('findAndSetupVideos: Got slide from .get(0) method');
                } else if ($slide[0]) {
                    slideElement = $slide[0];
                    console.log('findAndSetupVideos: Got slide from [0] index');
                } else if ($slide.selector) {
                    // Try to query by the selector property
                    slideElement = document.querySelector($slide.selector);
                    console.log('findAndSetupVideos: Got slide by querying .selector property');
                } else {
                    slideElement = $slide;
                    console.log('findAndSetupVideos: Using slide wrapper as-is');
                }
                
                console.log('findAndSetupVideos: Raw slide element', slideElement);
                
                if (!slideElement) {
                    console.log('findAndSetupVideos: Could not extract DOM element from slide wrapper');
                    return;
                }
                
                // Try multiple methods to find video elements
                let videos = [];
                
                // Method 1: Query from the slide element directly for video tags
                if (slideElement.querySelectorAll) {
                    videos = Array.from(slideElement.querySelectorAll('video'));
                    console.log('findAndSetupVideos: Found videos with querySelectorAll("video"):', videos.length);
                }
                
                // Method 2: Look specifically in .lg-video-cont containers
                if (videos.length === 0 && slideElement.querySelectorAll) {
                    videos = Array.from(slideElement.querySelectorAll('.lg-video-cont video'));
                    console.log('findAndSetupVideos: Found videos with querySelectorAll(".lg-video-cont video"):', videos.length);
                }
                
                // Method 3: Look for .lg-video-object class
                if (videos.length === 0 && slideElement.querySelectorAll) {
                    videos = Array.from(slideElement.querySelectorAll('.lg-video-object'));
                    console.log('findAndSetupVideos: Found videos with querySelectorAll(".lg-video-object"):', videos.length);
                }
                
                // Method 4: Check in the entire current slide container as fallback
                if (videos.length === 0) {
                    const currentVideos = document.querySelectorAll('.lg-current video');
                    if (currentVideos.length > 0) {
                        videos = Array.from(currentVideos);
                        console.log('findAndSetupVideos: Found videos with document.querySelectorAll(".lg-current video"):', videos.length);
                    }
                }
                
                // Method 5: Nuclear option - find ALL videos in the gallery and filter
                if (videos.length === 0) {
                    const allVideos = document.querySelectorAll('.lg-container video');
                    if (allVideos.length > 0) {
                        videos = Array.from(allVideos);
                        console.log('findAndSetupVideos: Found videos with document.querySelectorAll(".lg-container video"):', videos.length);
                    }
                }
                
                console.log('findAndSetupVideos: Total videos found:', videos.length);
                
                if (videos.length === 0) {
                    console.log('findAndSetupVideos: NO VIDEOS FOUND! Dumping slide element HTML:');
                    console.log(slideElement.outerHTML ? slideElement.outerHTML.substring(0, 500) : 'No outerHTML available');
                }
                
                videos.forEach(function(videoElement, index) {
                    console.log('findAndSetupVideos: Processing video', index, videoElement);
                    if (videoElement && videoElement.tagName === 'VIDEO') {
                        setupVideoVolumePersistence(videoElement);
                        
                        // Ensure video controls are enabled
                        videoElement.controls = true;
                        videoElement.style.pointerEvents = 'auto';
                        
                        if (isMobile) {
                            videoElement.style.maxWidth = '100%';
                            videoElement.style.maxHeight = '100%';
                        }
                        
                        // Start playing the video
                        const playPromise = videoElement.play();
                        if (playPromise !== undefined) {
                            playPromise.then(function() {
                                console.log('Video playback started successfully');
                            }).catch(function(error) {
                                console.log('Video autoplay was prevented:', error.message);
                                // Autoplay was prevented, but that's OK - user can click play
                            });
                        }
                    }
                });
            }

            // Load saved volume on gallery open
            lg.LGel.on('lgAfterOpen', function() {
                console.log('Gallery opened, loading saved volume');
                loadSavedVolume();
                
                // Start watching for video elements
                startVideoObserver();
                
                // Check for videos in the initial slide
                setTimeout(function() {
                    findAndSetupVideos(lg.index);
                }, 100);
            });

            // Handle slide changes to ensure only one video plays and setup volume persistence
            lg.LGel.on('lgAfterSlide', function(event) {
                console.log('lgAfterSlide: Slide changed to:', event.detail.index);

                // Pause all videos when slide changes
                pauseAllVideos();

                // Find and setup videos - try immediately first
                findAndSetupVideos(event.detail.index);
                
                // Also try with a small delay to catch videos that load async
                setTimeout(function() {
                    findAndSetupVideos(event.detail.index);
                }, 100);
                
                // And one more time with a longer delay as final backup
                setTimeout(function() {
                    findAndSetupVideos(event.detail.index);
                }, 300);
            });

            // Handle video elements when slide is fully loaded (backup for delayed video loading)
            lg.LGel.on('lgSlideItemLoad', function(event) {
                const index = event.detail.index;
                console.log('lgSlideItemLoad: Slide loaded', index, 'current index:', lg.index);
                
                // Only setup for the current slide
                if (index === lg.index) {
                    findAndSetupVideos(index);
                }
            });

            // Cleanup video event listeners before slide changes
            lg.LGel.on('lgBeforeSlide', function(event) {
                const prevIndex = event.detail.prevIndex;
                const $prevSlide = lg.getSlideItem(prevIndex);
                const $prevVideo = $prevSlide.find('video.lg-video-object');
                
                if ($prevVideo.length > 0) {
                    const prevVideoElement = $prevVideo.get(0);
                    // Remove jQuery event listeners
                    $(prevVideoElement).off('.lgVolumeControl');
                    console.log('Cleaned up video event listeners from previous slide');
                }
            });

            // Auto-hide controls functionality
            let controlsHideTimeout;
            const CONTROLS_HIDE_DELAY = 3000; // 3 seconds
            
            function showControls() {
                const $container = $('.lg-container');
                if ($container.length) {
                    $container.addClass('lg-show-controls');
                    console.log('Controls shown');
                    
                    // Clear existing timeout
                    if (controlsHideTimeout) {
                        clearTimeout(controlsHideTimeout);
                    }
                    
                    // Set new timeout to hide controls
                    controlsHideTimeout = setTimeout(() => {
                        $container.removeClass('lg-show-controls');
                        console.log('Controls hidden after inactivity');
                    }, CONTROLS_HIDE_DELAY);
                }
            }
            
            function resetControlsTimer() {
                showControls();
            }
            
            // Show controls on various user interactions
            lg.LGel.on('lgAfterOpen', function() {
                const $container = $('.lg-container');
                
                // Show controls initially
                showControls();
                
                // Add event listeners for user activity
                $container.on('mousemove.controls touchstart.controls click.controls keydown.controls', function(e) {
                    // Don't show controls when interacting with video controls
                    if (!$(e.target).closest('video').length) {
                        resetControlsTimer();
                    }
                });
                
                // Show controls when hovering over toolbar or navigation buttons
                $container.on('mouseenter.controls', '.lg-toolbar, .lg-prev, .lg-next', function() {
                    showControls();
                });
            });
            
            // Clean up on close
            lg.LGel.on('lgAfterClose', function() {
                if (controlsHideTimeout) {
                    clearTimeout(controlsHideTimeout);
                }
                $('.lg-container').off('.controls');
            });
        }

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
    // Check if cfg_cookie.txt exists and show download button if it does
    fetch('./check_cookie')
        .then(response => response.json())
        .then(data => {
            if (data.cookie_exists) {
                document.getElementById('downloadBtn').style.display = 'inline-flex';
            }
        })
        .catch(error => console.error('Error checking cookie:', error));

    // Download button click handler
    $('#downloadBtn').on('click', function() {
        $('#downloadModal').show();
    });

    // Close button handler
    $('.close').on('click', function() {
        $('#downloadModal').hide();
    });

    // Click outside modal to close
    $(window).on('click', function(event) {
        if ($(event.target).is('#downloadModal')) {
            $('#downloadModal').hide();
        }
    });

    // Start download handler
    $('#startDownload').on('click', function() {
        const url = $('#downloadUrl').val().trim();
        if (!url) {
            $('#downloadStatus').html('<p style="color: red;">Please enter a valid URL</p>');
            return;
        }

        $('#downloadStatus').html('<p>Starting download...</p>');
        fetch('./fetch_images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: url })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                $('#downloadStatus').html('<p style="color: green;">Download completed successfully!</p>');
                setTimeout(() => {
                    $('#downloadModal').hide();
                    $('#downloadUrl').val('');
                    $('#downloadStatus').html('');
                }, 2000);
            } else {
                $('#downloadStatus').html(`<p style="color: red;">Error: ${data.error}</p>`);
            }
        })
        .catch(error => {
            $('#downloadStatus').html(`<p style="color: red;">Error: ${error.message}</p>`);
        });
    });

    $(document).bind('webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange', function() {
        let isFullScreen = document.fullScreen ||
            document.mozFullScreen ||
            document.webkitIsFullScreen || (document.msFullscreenElement != null);
        if (isFullScreen) {
            console.log('fullScreen mode entered!');
            // Don't hide controls - let them fade in/out naturally via CSS
            
            // Use a delay to ensure UI has updated before checking slideshow state
            setTimeout(function() {
                persistSlideshowState();
            }, 500);
        } else {
            console.log('fullScreen mode exited!');
            // Don't force show controls - let them fade in/out naturally via CSS
            
            // Use a delay to ensure UI has updated before checking slideshow state
            setTimeout(function() {
                persistSlideshowState();
            }, 500);
        }
    });

    $(document).on('click', '.favIcon', function (e) {
        toggleFavorite($(this));
        e.stopPropagation();
    });

    // Remove ALL old gallery control handlers
    $(document).off('click.lg-controls');
    $(document).off('click', '#lg-container-1');
    $(document).off('click', '.lg-container');
    $(document).off('touchstart', '.lg-current');
    $(document).off('touchend', '.lg-current');
    $(document).off('click', 'video, .lg-object.lg-image');
    $('.lg-container').off('click.lg-controls');

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
