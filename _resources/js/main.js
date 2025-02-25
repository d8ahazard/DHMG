let dataArray = false;
let fetchTimeout = false;
let lg = false;
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
    let gc = document.getElementById("galleryContent");
    console.log("Adding elements:", elements);
    console.log("Favorites:", favorites);
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
            let vidType = mediaPath.substr((mediaPath.lastIndexOf('.') + 1));
            mDiv.classList.add("video");
            mDiv.setAttribute("data-lg-size", "1920-1080");
            mDiv.setAttribute("data-video",'{"source": [{"src":"'+mediaPath+'", "type":"video/'+vidType+'"}], "attributes": {"preload": false, "playsinline": true, "controls": true}}');
        }

        mDiv.setAttribute("data-name", name);
        mDiv.setAttribute("data-type", type);
        mDiv.setAttribute("data-time", obj['time']);
        mDiv.setAttribute("data-size", obj['size']);
        mDiv.setAttribute("data-link", obj['link']);
        if (isFav) mDiv.setAttribute("data-favorite", "true");
        if (type === "vid") {
            mDiv.setAttribute("data-html", "#" + key + "vid");
        } else {
            mDiv.setAttribute("data-src", mediaPath)
        }

        let ri = document.createElement("img");
        ri.classList.add("responsive-image", "b-lazy");
        ri.setAttribute("src", "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==");
        ri.setAttribute("data-src", thumbPath);
        ri.setAttribute("data-src-fallback", thumbAlt);
        ri.setAttribute("loading", "lazy");

        let ai = document.createElement("div");
        ai.classList.add("aspect__inner");

        let a = document.createElement("div");
        a.classList.add("aspect");

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
}

function buildGallery() {
    let gc = $("#galleryContent");
    console.log("Data array: ", dataArray);
    if (dataArray && dataArray.hasOwnProperty('items')) {
        gc.addClass('fadeOut');
        gc.empty();
        mediaArray = dataArray['items'];
        favorites = dataArray['favorites'];
        addElements(mediaArray);
    }

    console.log("Showing");
    $('#loader').addClass('fadeOut');
    gc.removeClass('fadeOut');
    console.log("Shuffle create.");
    shuffleInstance = new Shuffle(document.getElementById('galleryContent'), {
        itemSelector: '.thumbDiv',
        sizer: '.sizer',
        isCentered: true,
        by: function(element) {
            return element.getAttribute('data-name').toLowerCase();
        },
        useTransform: false
    });
    sortElements();
    new Blazy({
        container: '#galleryContent',
        success: function(ele){
            // Image has loaded successfully
            console.log("Image loaded successfully:", ele.getAttribute('data-src'));
        },
        error: function(ele, msg){
            console.log("Primary image load failed, trying fallback:", ele.getAttribute('data-src-fallback'));
            ele.src = ele.getAttribute('data-src-fallback');
            ele.classList.add('reloaded');
        }
    });

    setListeners();
    sortDom();
}

function initGallery() {
    try {
        if (lg) {
            try {
                lg.destroy();
            } catch (e) {
                console.warn('Error destroying previous lightGallery instance:', e);
            }
            lg = null;
        }
        
        console.log("Initializing gallery...");
        const $lgGalleryMethodsDemo = document.getElementById("galleryContent");
        
        if (!$lgGalleryMethodsDemo) {
            console.warn('Gallery container not found');
            return;
        }

        const mediaItems = mediaArray.filter(item => item.type === 'img' || item.type === 'vid');
        if (mediaItems.length === 0) {
            console.log('No media items to display');
            return;
        }
        
        lg = lightGallery($lgGalleryMethodsDemo, {
            plugins: [lgZoom, lgVideo, lgFullscreen, lgAutoplay],
            speed: 500,
            selector: '.thumbDiv.media.shuffle-item--visible',
            preload: 2,
            appendCounterTo: '.navbar',
            hash: false,
            thumbnail: false,
            videoMaxWidth: "100%",
            download: false,
            counter: true,
            autoplayControls: true,
            slideShowAutoplay: isSlideshow,
            slideShowInterval: $('#slideshowSpeed').val() * 1000,
            progressBar: true,
            mode: isRandom ? 'lg-slide-random' : 'lg-slide',
            addClass: 'lg-custom-thumbnails',
            licenseKey: 'your-license-key',
            mobileSettings: {
                controls: true,
                showCloseIcon: true,
                download: false
            }
        });

        // Handle navigation fade
        if (lg.$container) {
            lg.$container.on('mousemove.lg touchstart.lg', showNavigation);
            lg.$container.on('mouseout.lg touchend.lg', () => {
                navTimeout = setTimeout(hideNavigation, 2000);
            });
        }

        // Update slideshow button state when autoplay changes
        lg.$container.on('lgAfterSlide', function() {
            const isPlaying = lg.$container.find('.lg-autoplay-button').hasClass('lg-icon-pause');
            const icon = $('#slideshowBtn').find('i');
            if (isPlaying) {
                icon.removeClass('fa-play').addClass('fa-pause');
            } else {
                icon.removeClass('fa-pause').addClass('fa-play');
            }
        });
    } catch (error) {
        console.error('Error initializing lightGallery:', error);
    }
}

function showNavigation() {
    if (navTimeout) {
        clearTimeout(navTimeout);
    }
    const prev = document.querySelector('.lg-prev');
    const next = document.querySelector('.lg-next');
    if (prev) prev.style.opacity = '1';
    if (next) next.style.opacity = '1';
}

function hideNavigation() {
    const prev = document.querySelector('.lg-prev');
    const next = document.querySelector('.lg-next');
    if (prev) prev.style.opacity = '0';
    if (next) next.style.opacity = '0';
}

function fetchGallery() {
    let key = $('#pageKey').attr('content');
    let url = "./json";
    console.log("Page key:", key);
    if (key && key !== "") {
        url += "?id=" + encodeURIComponent(key);
    }
    console.log("Fetching gallery from:", url);
    $.getJSON(url, function (data) {
        console.log("JSON retrieved data!", data);
        dataArray = data;
        if (fetchTimeout) clearTimeout(fetchTimeout);
        buildGallery();
        if (shuffleInstance) {
            shuffleInstance.update();
        }
    })
    .fail(function (jqXHR, textStatus, errorThrown) {
        console.log("JSON Fetch failed:", textStatus, errorThrown);
        console.log("Response:", jqXHR.responseText);
        fetchTimeout = setTimeout(function () {
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

function openFile(id) {
    window.location = protectedLinks ? './file?id=' + id : id;
}

function openGallery(id) {
    console.log("Opening gallery with id:", id);
    // Get the current path from the page
    let currentPath = $('#pageKey').attr('content');
    let newPath;
    
    if (currentPath && currentPath !== "") {
        // We're in a subdirectory, so append the new directory to the current path
        let decodedCurrent = decodeURIComponent(currentPath);
        console.log("Current decoded path:", decodedCurrent);
        newPath = id;  // Use the full path provided by the server
    } else {
        // We're at root, so just use the id directly
        newPath = id;
    }
    
    console.log("New path:", newPath);
    let path = './?id=' + encodeURIComponent(newPath);
    let currentYOffset = $('#galleryDiv').scrollTop();
    pageCookieSet('scrollPosition', currentYOffset);
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

    $(document).on('mouseenter', '.lg-next', function() {
        pausePage=true;
    });

    $(document).on('mouseenter', '.lg-prev', function() {
        pausePage=true;
    });

    $(document).on('mouseleave', '.lg-next', function() {
        pausePage=false;
        showPagers();
    });

    $(document).on('mouseleave', '.lg-prev', function() {
        pausePage=false;
        showPagers();
    });

    $(document).on('mousemove', 'video', function() {
        showPagers();
    });

    $(document).on('mousemove', '.lg-object.lg-image', function() {
        showPagers();
    });

    $(document).on('click', '.thumbDiv', function() {
        console.log("thumbDiv click: ", $(this));
        let type = $(this).data('type');
        if (type === 'vid' || type === 'img') {
            showPagers();
            return false;
        }
        let targetSrc = $(this).data('src');
        console.log("Target source: ", targetSrc);
        if (type === 'dir') {
            openGallery(targetSrc);
        } else if (type === 'file') {
            openFile(targetSrc);
        } else if (type === 'vid') {
            $(this).attr('src', targetSrc);
        }
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
}

function showPagers() {
    console.log("Showpagers...")
    if (fadeTimeout !== null) clearTimeout(fadeTimeout);
    let nb = document.querySelectorAll(".lg-next");
    let pb = document.querySelectorAll(".lg-prev");
    let op = 1;  // initial opacity

    for (let i= 0 ; i < nb.length; i++) {
        nb[i].style.opacity = op;
    }
    for (let i= 0 ; i < pb.length; i++) {
        pb[i].style.opacity = op;
    }
    if (pausePage) {
        if (fadeTimeout !== null) clearTimeout(fadeTimeout);
        if (fadeInt !== null) clearInterval(fadeInt);
        return;
    }
    fadeTimeout = setTimeout(function(){
        console.log("Fading?")
        fadeInt = setInterval(function () {
            if (op <= 0.1){
                for (let i= 0 ; i < nb.length; i++) {
                    nb[i].style.opacity = "0";
                }
                for (let i= 0 ; i < pb.length; i++) {
                    pb[i].style.opacity = "0";
                }
                clearInterval(fadeInt);
                fadeInt = null;
            }
            for (let i= 0 ; i < nb.length; i++) {
                nb[i].style.opacity = op;
            }
            for (let i= 0 ; i < pb.length; i++) {
                pb[i].style.opacity = op;
            }
            op -= op * 0.1;
        }, 50);
        clearTimeout(fadeTimeout);
        fadeTimeout = null;
    },3000);
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
    let items = shuffleInstance.items;
    let sorted = items.sort(sortByPosition);
    console.log("Sorted: ", sorted);
    let gc = $('#galleryContent');
    let last = false;
    $.each(sorted, function (key, value) {
        let elem = $(value.element);
        if (key === 0) {
            gc.prepend(elem);
        } else {
            last.after(elem);
        }
        last = elem;
    });
    initGallery();
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
