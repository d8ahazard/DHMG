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
    fetchGallery();
});


function addElements(elements) {
    let gc = document.getElementById("galleryContent");
    console.log("ELEMENTS: ", elements);
    console.log("Favorites: ", favorites);
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
            mediaPath = $('#pagePath').attr('content') + "/" + obj['name'];
        } else {
            mediaPath = obj['link'];
        }

        if (type === 'vid') {
            typeIcon = 'video';
        }

        let thumbPath = obj['thumb'];
        let thumbAlt = "./?thumb&id=" + obj['link'];
        let mDiv = document.createElement("div");
        mDiv.id = "media" + key;
        mDiv.classList.add("thumbDiv", "card", "bg-dark", "col-6", "col-md-4", "col-lg-3", "xol-xl-2");
        if (type === 'vid' || type === 'img') mDiv.classList.add("media");
        if (type === 'vid') {
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
        ri.setAttribute("data-alt", thumbAlt);
        ri.setAttribute("data-src", thumbPath);

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
        by: 'data-title',
        useTransform: false
    });
    sortElements();
    new Blazy({
        container: '#galleryContent',
        success: function(ele){
            // Image has loaded
            // Do your business here
        },
        error: function(ele, msg){
                console.log("Building image for ", $(ele).attr('data-alt'));
                $(ele).attr('src', $(ele).attr('data-alt'));
                $(ele).addClass('reloaded');

        }
    });

    console.log("Sorting");
    console.log("Sort done...");

    setListeners();
    sortDom();
}


function fetchGallery() {
    let key = $('#pageKey').attr('content');
    let url = "./index.php?json";
    if (key !== "") {
        url += "&id=" + key;
    }
    $.getJSON(url , function (data) {
        console.log("JSON retrieved data!", data);
        dataArray = data;
        if (fetchTimeout) clearTimeout(fetchTimeout);
        buildGallery();
        shuffleInstance.update();
    })
        .fail(function () {
            console.log("JSON Fetch failed, we're probably still building.");
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


function initGallery() {
    if (lg) {
        $('.lg-counter').remove();
    }
    console.log("Initializing gallery...");
    setTimeout(function(){}, 500);
    const $lgGalleryMethodsDemo = document.getElementById("galleryContent");
    $lgGalleryMethodsDemo.addEventListener("lgInit", () => {
        const previousBtn =
            '<button type="button" aria-label="Previous slide" class="lg-prev"></button>';
        const nextBtn =
            '<button type="button" aria-label="Next slide" class="lg-next"></button>';
        const $lgContainer = document.getElementById("galleryDiv");
        $lgContainer.insertAdjacentHTML("beforeend", nextBtn);
        $lgContainer.insertAdjacentHTML("beforeend", previousBtn);
        document.querySelector(".lg-next").addEventListener("click", () => {
            lg.goToNextSlide();
        });
        document.querySelector(".lg-prev").addEventListener("click", () => {
            lg.goToPrevSlide();
        });
    });
    lg = lightGallery($lgGalleryMethodsDemo, {
        plugins: [lgVideo, lgZoom, lgFullscreen, lgAutoplay],
        speed: 500,
        selector: '.thumbDiv.media.shuffle-item--visible',
        preload: 1,
        appendCounterTo: '.navbar',
        hash: false,
        thumbnail: false,
        videoMaxWidth: "100%"
    });

}


function openFile(id) {
    window.location = protectedLinks ? phpSelf + '?cmd=file&id=' + id : id;
}


function openGallery(id) {
    let path = phpSelf + '?id=' + id;
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
        document.getElementById('galleryDiv').scrollTop = sp;
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

    let url = phpSelf + "?favorite&id=" + id;
    if (isFav) url += "&delete";
    console.log("URL: " + url);
    $.getJSON(url, function (data) {
        if (data[0] !== "error") {
            console.log("REBUILDING.");
        } else {
            console.error("Something bad happened...");
        }
    });
    sortElements();
    setSortIcons();

    console.log("URL For el: " + url, el);

}
