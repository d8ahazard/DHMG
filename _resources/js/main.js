var dataArray = false;
var fadeElements = true;
var fadeTimeout = false;
var fetchTimeout = false;
var galleryOpen = false;
var index = false;
var isScrolling = false;
var letter = 'nan';
var letters = [];
var mediaArray = [];
var phpSelf = '.';
var preloadImg = new Image();
var preloaded = -1;
var preloadedFull = -1;
var protectedLinks = false;
var sliding = false;
var sortByName = true;
var sortReverse = false;
var sortWithDirs = false;

var pz = false;


$(function() {
    $.fn.imgLoad = function(callback) {
        return this.each(function() {
            if (callback) {
                if (this.complete || /*for IE 10-*/ $(this).height() > 0) {
                    callback.apply(this);
                }
                else {
                    $(this).on('load', function(){
                        callback.apply(this);
                    });
                }
            }
        });
    };
    protectedLinks = $('#protectKey').attr('content');
    setSort();
    fetchGallery();
});


function addElements(elements, isMedia) {
    console.log("Function fired, byName and reverse are now ", sortByName, sortReverse);
    if (!sortByName || sortByName === "false") console.log("We should be sorting by date.");
    if (sortReverse) console.log("We should be sorting in reverse");
    var sorted = elements.sort(sortByValue);
    var firstChar = '';
    if (isMedia) {
        var mediaIndex = mediaArray.length;
        if (!mediaArray.length) mediaArray = sorted; else mediaArray = mediaArray.concat(sorted);
        console.log("Media Array: ", mediaArray);
    }

    console.log("Unsorted and sorted", elements, sorted);
    $.each(sorted, function(key, obj) {
        var objLink = obj['thumb'];
        if (objLink && objLink.includes("&build=true")) {
            objLink.replace("&build=true", '');
        }
        var content = '';
        var name = thumbDisplayName(obj['name']);
        var type = obj['type'];
        firstChar = name.charAt(0).toUpperCase();
        if (letter !== firstChar) {
            letter = firstChar;
            letters.push(letter);
        }
        var typeIcon = '';
        if (type === 'dir') typeIcon = 'folder';
        if (type === 'img') typeIcon = 'image';
        if (type === 'vid') typeIcon = 'video';
        if (type === 'file') typeIcon = 'file-code';
        console.log("Fav: " + obj['favorite']);
        var favIcon = (obj['favorite']) ? "fa fa-star" : "far fa-star";
        var favClass = (obj['favorite']) ? " favorite" : "";
        var thumbPath = phpSelf + '?cmd=thumb&id=' + obj['thumb'];
        thumb = obj['thumb'].replace(/%2F/g, '/');
        thumb = thumb.replace(/\+/g, '%20');
        content += '<div class="cell thumbDiv col-6 col-md-4 col-lg-2 col-xl-1 card bg-dark'+favClass+'" data-name="'+name+'" data-text="' + letter + '" data-index="' + mediaIndex + '" data-src="'+obj['link']+'" data-type="'+type+'">' +
            '<img class="responsive-image lozad" data-alt="' + thumb + '" data-src="' + thumbPath + '"/>' +
            '<div class="thumbtitle decorator">' + name + '</div>' +
            '<div class="typeIcon decorator"><i class="fa fa-' + typeIcon + '"></i></div>' +
            '<div class="favIcon"><i class="'+ favIcon +'"</div>' +
            '</div></div>';
        if (content !== '') {
            var galleryDiv = $('#galleryContent');
            galleryDiv.append(content);
        }
        if (isMedia) mediaIndex++;
    });
}


function buildGallery(reload) {
    var gc = $("#galleryContent");
    gc.addClass('fadeOut');
    gc.empty();
    console.log("Data array: ", dataArray);
    if (dataArray && dataArray.hasOwnProperty('media')) {
        mediaArray = dataArray['media'];
        if (sortWithDirs) {
            // Separate favorites out here, or delete this option
            addElements(mediaArray);
        } else {
            var favoriteDirs = [];
            var favoriteFiles = [];
            var dirs = [];
            var files = [];
            $.each(mediaArray, function (key, item) {
                if (item['type'] === 'dir') {
                    if (item['favorite']) favoriteDirs.push(item); else dirs.push(item);
                } else {
                    if (item['favorite']) favoriteFiles.push(item); else files.push(item);
                }

            });
            mediaArray = [];
            console.log("Fav: ", favoriteFiles);
            console.log("Files: ", files);
            if (favoriteDirs.length) addElements(favoriteDirs, false);
            if (dirs.length) addElements(dirs, false);
            if (favoriteFiles.length) addElements(favoriteFiles, true);
            if (files.length)addElements(files, true);
        }
    }
    setTimeout(function(){
        $('#loader').addClass('fadeOut');
        gc.removeClass('fadeOut');
        if (!reload) setListeners();
        var observer = lozad();
        observer.observe();

    }, 1000);
    filterDivs();
    scaleThumbs();
}


function clearSlides(el) {
    el.removeClass('slideInLeft slideInRight slideOutLeft slideOutRight');
}


function closeMedia() {
    console.log('Closing media.');
    exitFullScreen();
    var video = $('video');
    var full = $('#full');
    $('#waitModal').hide();
    $('#wait').hide();
    $('#galleryModal').hide();
    $('#videoHolder').hide();
    fadeElements = true;
    $('.navBtn').addClass('fadeOut');
    video.trigger('pause');
    galleryOpen = false;
    index = false;
    full.width = 1;
    full.height = 1;
    full.src = '';
    video.src = '';
}


function cycleMedia(direction, preload) {
    if (!preload) console.log('Cycling media...' + direction);
    var item = false;
    var selection = false;
    var type = false;
    var i = 0;
    var nextId = index;
    var len = (mediaArray.length - 1);
    var flipDirection = false;
    while (!selection && i < len) {
        flipDirection = false;
        nextId = nextId + direction;
        if (nextId > (len)) {
            nextId = 0;
            flipDirection = true;
        }
        if (nextId < 0) {
            nextId = len;
            flipDirection = true;
        }
        item = mediaArray[nextId];
        type = item['type'];
        if ((type !== 'file') && (type !== 'dir')) {
            if (!preload) index = nextId;
            selection = item;
        }
        i++;
    }

    if (selection) {
        console.log("Selecting item...");
        var target = selection['link'];
        if (!preload) {
            if (flipDirection) {
                direction = -direction;
                console.log("Flipped direction to " + direction);
            }
            openMedia(target, type, direction);
        }
        if (preload && ('img' === type)) preloadImage(target);
    } else {
        if (preload && i === len) {
            console.log("No other images to preload...");
        } else {
            console.error("Can't cycle item!");
        }
    }
}


function enterFullScreen() {
    var element = $('#galleryModal').get(0);
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
    }
}

function exitFullScreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}


function fetchGallery() {
    var key = $('#pageKey').attr('content');
    $.getJSON("./index.php?cmd=json&id=" + key, function(data) {
        console.log("JSON retrieved data!", data);
        dataArray = data;
        if (fetchTimeout) clearTimeout(fetchTimeout);
        buildGallery(false);
    })
    .fail(function(){
        console.log("JSON Fetch failed, we're probably still building.");
        fetchTimeout = setTimeout(function(){
            fetchGallery();
        }, 5000);
    });
}


function filter(e) {
    console.log("Should be filtering for " + e);
    var td = $('.thumbDiv');
    if (e.trim() !== '') {
        var regex = new RegExp('\\b\\w*' + e + '\\w*\\b', 'i');
        td.hide().filter(function () {
            return regex.test($(this).data('name'))
        }).show();
    } else {
        td.show();
    }
}


function filterDivs() {
    var selectText = $("#divFilter").val();
    filter(selectText);
}


function initPanZoom() {
    if (pz) pz.dispose();
    var el = $('.full_image')[0];
    console.log("Inint pz for ", el);
    pz = panzoom(el, {
        filterKey: function(/* e, dx, dy, dz */) {
            return true;
        },
        smoothScroll: false
    });

}

function isInViewport(elem) {
    var bounding = elem.getBoundingClientRect();
    return (
        bounding.top >= 0 &&
        bounding.left >= 0 &&
        bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        bounding.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}


function keyNavigate(key) {
    console.log("Key, stupid: ", key);
    var k = (window.event) ? event.keyCode : key.keyCode;
    if (galleryOpen) {
        if (k === 33 || k === 38 || k === 37) /// Page up, Arrow up, Arrow left
        {
            cycleMedia(-1);
            return false;
        } else if (k === 32 || k === 34 || k === 39 || k === 40) {
            cycleMedia(1);
            return false;
            //esc
        } else if (k === 27) {
            closeMedia();
            return false;
        }
    }
}


function isTouchDevice() {
    var userAgent = window.navigator.userAgent;
    return !!(userAgent.match(/iPad/i) || userAgent.match(/iPhone/i));
}


function openFile(id) {
    window.location = protectedLinks ? phpSelf + '?cmd=file&id=' + id : id;
}


function openGallery(id) {
    var path = phpSelf + '?id=' + id;
    var currentYOffset = $('#galleryDiv').scrollTop();
    pageCookieSet('scrollPosition', currentYOffset);
    window.location = path;
}


function openImage(id, direction) {
    console.log("Open image fired, direction is " + direction);
    var video = $('#video1');
    if (!video.get(0).paused) video.trigger('pause');
    //video.show();
    var full = $('.full_image.active');
    var fullWrap = $('#fullWrap');
    var wait = $('#wait');
    var cssString = "url('"+id+"')";
    if (galleryOpen) {
        console.log("Preslide, direction is " + direction);
        var newImg = $('<div class="full_image fit active imgItem animated faster" onclick="closeMedia()"></div>');
        newImg.css('background-image', cssString);
        newImg.css("background-image", "url(" + id + ") center center no-repeat");
        fullWrap.append(newImg);
        newImg.imgLoad(function() {
        slideImages($(this), full, direction);
        });
    } else {
        console.log("Adding...");
        full.css("background-image", cssString);
        full.show();
        initPanZoom();
    }

    cycleMedia(1, true);
    cycleMedia(-1, true);
    wait.hide();

}


function openMedia(id, type, direction) {
    console.log('Opening media of type ' + type + ' with an id of ' + id + ", direction is " + direction);
    var item = mediaArray[index];
    console.log("Item Data for index " + index, item);
    var name = item['name'];
    var time = item['info']['time'];
    var d = new Date(0); // The 0 there is the key, which sets the date to the epoch
    d.setUTCSeconds(time);
    d = d.toLocaleString('en-GB', { hour12:false } );
    $('#mediaTitle').html("<span>"+name+"</span>");
    $('#mediaInfo').html("<span>"+d+"</span>");
    $('#wait').hide();
    $('#waitModal').show();
    $('#galleryModal').show();
    toggleHover();

    if (type === 'vid') {
        openVideo(id, direction);
    } else {
        openImage(id, direction);
    }
    galleryOpen = true;

}


function openVideo(id, direction) {
    var videoPath = id;
    if (typeof document.createElement('canvas').getContext !== "function") {
        if (protectedLinks) videoPath = phpSelf + '?cmd=url&id=' + id;
        console.log('Trying to open ' + id);
        window.open(videoPath);
    } else {
        var playDirect = (id.includes(".avi"));
        if (playDirect) console.log("We need to do something different here?");
        if (protectedLinks) videoPath = phpSelf + '?cmd=url&id=' + id;
        if (playDirect) videoPath = phpSelf + '?cmd=video&id=' + id;
        console.log("Setting video player source to " + videoPath);
        var myVideo = $('video');
        if (galleryOpen) {
            slideVideo(myVideo, videoPath, direction);
        } else {
            var resume = false;
            myVideo.css('z-index', 1131);
            $('.full_image').css('z-index', 1130);

            if (!myVideo.get(0).paused) {
                myVideo.trigger('pause');
                console.log("We should resume playback on next item.");
                resume = true;
            }
            myVideo.currentTime = 0;
            myVideo.attr('src', videoPath);
            myVideo.attr('autoplay', false);
            myVideo.attr('controls', true);
            if (resume) myVideo.trigger('play');
        }
    }
    $('#waitModal').hide();
}


function pageCookieGet(key) {
    var temp = Cookies.get(key + "." + window.location);
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


function preloadImage(id) {
    if (preloaded !== id) {
        preloadImg = new Image();
        preloadImg.src = '';
        preloadImg.src = protectedLinks ? phpSelf + '?cmd=img&id=' + id : id;
        preloadedFull = 0;
        preloaded = id;
    }
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
    buildGallery(true);
}


function setListeners() {

    var gm = $('#galleryModal');
    gm.mousemove(function () {
        if (isTouchDevice()) console.log("Touch device move.");
        if (!isTouchDevice()) console.log("NonTouch device move.");
        toggleHover();
    });

    // $('img:not(".reloaded")').on('error', function() {
    //     if ($(this).attr('data-alt') !== undefined && !$(this).hasClass('reloaded')) {
    //         console.log("Building image for ", $(this).data('alt'));
    //         $(this).attr('src', $(this).attr('data-alt'));
    //         $(this).addClass('reloaded');
    //     }
    // });

    $(document).on('click', '#fullToggle', function(){
        toggleFullScreen();
    });

    $(document).on('click', '.favIcon', function(e){
        var parent = $(this).closest('.thumbDiv');
        $('#loader').removeClass('fadeOut');
        var lastOffset = $('.far').last().offset();
        var gc = $('#galleryContent');
        parent.animate({ 'top': lastOffset.top + 'px', 'left': lastOffset.left + 'px'}, 150, function(){

        });
        gc.addClass('fadeOut');
        setTimeout(toggleFavorite($(this), 500));

        e.stopPropagation();
    });

    $(window).on('resize', function(){
        scaleThumbs();
    });

    gm.bind('webkitfullscreenchange mozfullscreenchange fullscreenchange', function(e) {
        var state = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen;
        var event = state ? 'FullscreenOn' : 'FullscreenOff';
        if (event === 'FullscreenOff') {
            var ti = $('.toggleIcon');
            if (ti.hasClass('fa-compress')) ti.removeClass('fa-expand');
            if (!ti.hasClass('fa-expand')) ti.addClass('fa-expand');
        }
    });

    $(document).on('click', '.thumbDiv', function() {
        console.log("thumbDiv click: ", $(this));
        var targetSrc = $(this).data('src');
        var targetType = $(this).data('type');
        console.log("Target source: ", targetSrc);
        targetSrc = targetSrc.replace(".//", "./");
        if (targetType === 'dir') {
            openGallery(targetSrc);
        } else if (targetType === 'file') {
            openFile(targetSrc);
        } else {
            index = $(this).data('index');
            openMedia(targetSrc, targetType);
        }
    });

    $(document).on('click', '.cycleBtn', function() {
        cycleMedia(($(this).hasClass('left')) ? -1 : 1);
    });

    $('#galleryDiv').scroll(function() {
        if (sortByName) {
            var scrollTip = $('#scrollTip');
            scrollTip.removeClass('fadeOut');
            var elements = $('.thumbDiv');
            $.each(elements, function (key, el) {
                if (isInViewport(el)) {
                    var elText = $(el).data('text');
                    console.log("El texto " + elText);
                    scrollTip.html('<span class="tipText">' + elText + '</span>');
                    return false;
                }
            });
            // Clear our timeout throughout the scroll
            window.clearTimeout(isScrolling);

            // Set a timeout to run after scrolling ends
            if (fadeElements && !isTouchDevice()) {
                isScrolling = setTimeout(function () {
                    // Run the callback
                    scrollTip.addClass('fadeOut');
                }, 1000);
            }
        }
    });

    $("#divFilter").on('input', function(){
        filterDivs();
    });

    var sp = pageCookieGet('scrollPosition');
    if(sp !== undefined) {
        console.log("We have a jump position: " + sp);
        document.getElementById('galleryDiv').scrollTop = sp;
        pageCookieClear('scrollPosition');
    }

    var hammer = new Hammer(document.getElementById('fullWrap'), {
        domEvents: true
    });

    hammer.add(new Hammer.Pinch({ threshold: 0, pointers: 0 }));

    hammer.on("swipeleft", function(){
        console.log("LEFT");
        cycleMedia(1);
    });

    hammer.on("swiperight", function(){
        console.log("RIGHT");
        cycleMedia(-1);
    });

    hammer.on("tap", function(){
        console.log("TAP");
        fadeElements = !fadeElements;
        toggleHover();
    });

    $( window ).on( "navigate", function( event, data ) {
        console.log( data.state );
    });


    document.onkeyup = keyNavigate;
}


function scaleThumbs() {
    console.log("Resizing da thumbs.");
    var td = $('.thumbDiv');
    //td.css('height',td.width());
}

function setSort() {
    var sortCheck = pageCookieGet('sortByName');
    var orderCheck = pageCookieGet('sortReverse');
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
    var dirIcon = $('.dirIcon');
    var selIcon = $('.selIcon');
    var  sortDir = sortReverse ? "up" : "down";
    var typeIcon = '';
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


function SetVolume(val) {
    var player = document.getElementById('video1');
    console.log('Before: ' + player.volume);
    player.volume = val / 100;
    console.log('After: ' + player.volume);
}


function slideImages(show, hide, direction) {
    console.log("Sliding fired, direction: " + direction);
    if (!sliding) {
        sliding = true;
        var vid = $('#video1');
        var showClass = false;
        var hideClass = false;
        if (direction === 1) {
            showClass = 'slideInRight';
            hideClass = 'slideOutLeft';
        } else {
            showClass = 'slideInLeft';
            hideClass = 'slideOutRight';
        }
        clearSlides(hide);
        show.hide();
        clearSlides(show);
        show.show().addClass(showClass);
        hide.addClass(hideClass);
        vid.addClass(hideClass);

        setTimeout(function () {
            hide.remove();
            vid.hide();
            show.addClass('active');
            clearSlides(show);
            initPanZoom();
            sliding = false;
        }, 500);
    }
}


function slideVideo(myVideo, videoPath, direction) {
    console.log("Sliding video.");
    var img = $('.imgItem');
    var resume = false;
    var oldPath = myVideo.attr('src');
    var showClass = false;
    var hideClass = false;

    if (direction === 1) {
        showClass = 'slideInRight';
        hideClass = 'slideOutLeft';
    } else {
        showClass = 'slideInLeft';
        hideClass = 'slideOutRight';
    }
    if (!sliding) {
        sliding = true;
        myVideo.addClass(hideClass).show();
        if (img.length) {
            img.addClass(hideClass);
        }
        setTimeout(function () {
            myVideo.hide();
            if (img.length) img.remove();
            myVideo.removeClass('slideInLeft slideInRight slideOutLeft slideOutRight');
            if (!myVideo.get(0).paused) {
                myVideo.trigger('pause');
                console.log("We should resume playback on next item.");
                resume = true;
            }
            console.log("Changing video src from " + oldPath + " to " + videoPath);
            console.log("Showclass is " + showClass + ", hideclass is " + hideClass);
            myVideo.currentTime = 0;
            myVideo.attr('src', videoPath);
            myVideo.attr('autoplay', false);
            myVideo.attr('controls', true);

            // Slide in from right
            myVideo.addClass(showClass).show();
            if (resume) myVideo.trigger('play');
            sliding = false;
        }, 500);
    }
}


function sortByValue(a, b) {
    var aVal = 1;
    var bVal = 1;
    if (sortByName) {
        aVal = a['name'];
        bVal = b['name'];
    } else {
        aVal = a['info']['time'];
        bVal = b['info']['time'];
    }
    return sortReverse ? ((aVal > bVal) ? -1 : ((aVal < bVal) ? 1 : 0)) : ((aVal < bVal) ? -1 : ((aVal > bVal) ? 1 : 0));
}


function thumbDisplayName(name) {
    var dispName = name.substring(0, 20);
    if (name.length > 20) {
        dispName += '...';
    }
    dispName = dispName.replace("%20", "");
    return dispName;
}


function toggleFavorite(el) {
    $('#galleryContent').empty();
    var parent = el.closest('.thumbDiv');
    var id = parent.data('src');
    var page = $('#pageKey').attr('content');
    var dataIndex = false;
    console.log("Data array: ", dataArray);
    var media = dataArray['media'];
    $.each(media, function(key, value){
        if (value['link'] === id) dataIndex = key;
    });

    if (dataIndex !== false) {
        var item = media[dataIndex];
        item['favorite'] = !item['favorite'];
        console.log("Setting favorite: ", item);
        dataArray['media'][dataIndex] = item;
        buildGallery(true);
    } else {
        console.log("Unable to find value in data array!");
    }
    var action = 'addFav';
    var child = el.find('.fa');
    console.log("Toggling for ", child);
    var delFavorite = !!(child.length);
    if (delFavorite) {
        console.log("This should be an unset");
        action = 'delFav';
    }
    var url = phpSelf + "?cmd=" + action + "&target=" + id + "&id=" + page;

    $.getJSON(url, function(data){
        //dataArray = data;
        if (data[0] !== "error") {
            console.log("REBUILDING.");
        } else {
            console.error("Something bad happened...");
        }
    });
    console.log("URL For el: " + url, el);
}


function toggleFullScreen() {
    var ti = $('.toggleIcon');
    ti.toggleClass('fa-expand');
    ti.toggleClass('fa-compress');
    if (
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
    ) {
        exitFullScreen();
    } else {
        enterFullScreen();
    }
}


function toggleHover() {
    if (galleryOpen) {
        if (fadeTimeout) clearTimeout(fadeTimeout);
        $('.navBtn').removeClass('fadeOut');
        if (fadeElements && !isTouchDevice()) {
            fadeTimeout = setTimeout(function () {
                $('.navBtn').addClass('fadeOut');
            }, 3000);
        }
    } else {
        if (fadeTimeout) clearTimeout(fadeTimeout);
        $('.navBtn').addClass('fadeOut');
    }
}
