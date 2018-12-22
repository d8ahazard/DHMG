var dataArray = false;
var fadeElements = true;
var fetchTimeout = false;
var isScrolling = false;
var lg = false;
var mediaArray = [];
var phpSelf = '.';
var protectedLinks = false;
var shuffleInstance = false;
var sortByName = true;
var sortReverse = false;
var favorites = false;


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
    var content = '';
    console.log("ELEMENTS: ", elements);
    console.log("Favorites: ", favorites);
    $.each(elements, function (key, obj) {
        var typeIcon = '';
        var name = thumbDisplayName(obj['name']);
        var vidDiv = '';
        var htmlData = '';

        var isFav = ($.inArray(obj['link'], favorites) > -1);
        if (isFav) console.log("Dis be fav");
        var favClass = (isFav) ? " favorite" : "";
        var favIcon = (isFav) ? "fa fa-star" : "far fa-star";
        var type = obj['type'];
        if (type === 'dir') typeIcon = 'folder';
        if (type === 'img') typeIcon = 'image';
        if (type === 'file') typeIcon = 'file-code';
        if (type === 'vid' || type === 'img') {
            favClass += ' media';
            var mediaPath = $('#pagePath').attr('content') + "/" + obj['name'];
        } else {
            var mediaPath = obj['link'];
        }
        if (type === 'vid') {
            typeIcon = 'video';
            htmlData += " data-html='#" + key + "vid'";
            favClass += " video";
            var vidType = mediaPath.substr((mediaPath.lastIndexOf('.') + 1));
            vidDiv = '<div style="display:none;" id="' + key + 'vid">\n' +
                '    <video class="lg-video-object lg-html5 " controls preload="none">' +
                '        <source src="' + mediaPath + '" type="video/' + vidType + '">' +
                '         Your browser does not support HTML5 video.' +
                '    </video>' +
                '</div>';
            //$('#lightContent').append(vidDiv);
        } else {
            htmlData += ' data-src="' + mediaPath + '"';
        }

        var thumbPath = obj['thumb'];
        var thumbAlt = "./?thumb&id=" + obj['link'];

        content += '<div id="media' + key + '" class="thumbDiv card bg-dark col-6 col-md-4 col-lg-3 xol-xl-2' + favClass + '"' +
            ' data-name="' + name + '" data-type="' + type + '" data-favorite="' + isFav + '"' +
            ' data-time="' + obj['time'] + '" data-size="' + obj['size'] + '" data-link="'+obj['link']+'"' + htmlData + '>' +
            '<div class="aspect">' +
            '<div class="aspect__inner">' +
            '<img class="responsive-image b-lazy" data-alt="' + thumbAlt + '" data-src="' + thumbPath + '"/>' +
            '</div>' +
            '</div>' +

            '<div class="thumbtitle decorator">' + name + '</div>' +
            '<div class="typeIcon decorator"><i class="fa fa-' + typeIcon + '"></i></div>' +
            '<div class="favIcon"><i class="' + favIcon + '"></i></div>' +
            '</div>' +
            '</div>' + vidDiv;
    });
    return content;
}


function buildGallery() {
    var gc = $("#galleryContent");
    console.log("Data array: ", dataArray);
    var content = '';
    if (dataArray && dataArray.hasOwnProperty('items')) {
        gc.addClass('fadeOut');
        gc.empty();
        mediaArray = dataArray['items'];
        favorites = dataArray['favorites'];
        content = addElements(mediaArray);
        if (content !== '') {
            gc.append(content);
        }
    }
    // var observer = lozad('.lozad', {
    //     loaded: function (el) {
    //         console.log("Loaded...");
    //         el.classList.add('loaded');
    //         if (lozadTimeout) clearTimeout(lozadTimeout);
    //         lozadTimeout = setTimeout(function () {
    //             console.log("Lozoaded.");
    //
    //         }, 5);
    //     }
    // });


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
    var bLazy = new Blazy({
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


function decodeSource(src) {

}


function fetchGallery() {
    var key = $('#pageKey').attr('content');
    var url = "./index.php?json";
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
    var media = [];
    var elements = $('.shuffle-item--visible');
    $.each(elements, function (key, elem) {
        var element = $(elem);
        if (element.data('type') !== 'dir' && element.data['type'] !== 'file') {
            var elemData = {
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
    var gc = $('#galleryContent');
    if (lg) {
        lg.data('lightGallery').destroy(true);
        $('.lg-counter').remove();
    }
    console.log("Initializing gallery...");
    setTimeout(function(){}, 500);
    lg = gc.lightGallery({
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
    var path = phpSelf + '?id=' + id;
    var currentYOffset = $('#galleryDiv').scrollTop();
    pageCookieSet('scrollPosition', currentYOffset);
    window.location = path;
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
            var typeA = a.element.getAttribute('data-type');
            var typeB = b.element.getAttribute('data-type');
            var favA = (a.element.getAttribute('data-favorite') === 'true');
            var favB = (b.element.getAttribute('data-favorite') === 'true');
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
        var tb = $('.lg-toolbar');
        var to = $('.lg-thumb-outer');
        var ln = $('.lg-next');
        var lp = $('.lg-prev');
        var isFullScreen = document.fullScreen ||
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


    $(document).on('click', '.thumbDiv', function() {
        console.log("thumbDiv click: ", $(this));
        var type = $(this).data('type');
        if (type === 'vid' || type === 'img') return false;
        var targetSrc = $(this).data('src');
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
        var searchText = $(this).val();
        shuffleInstance.filter(function (element) {
            var name = element.getAttribute('data-name');
            var titleText = name.toLowerCase().trim();
            return titleText.indexOf(searchText) !== -1;
        });
        sortDom();
    });

    var sp = pageCookieGet('scrollPosition');
    if (sp !== undefined) {
        console.log("We have a jump position: " + sp);
        document.getElementById('galleryDiv').scrollTop = sp;
        pageCookieClear('scrollPosition');
    }

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
    var sortDir = sortReverse ? "up" : "down";
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


function sortDom() {
    var items = shuffleInstance.items;
    var sorted = items.sort(sortByPosition);
    console.log("Sorted: ", sorted);
    var gc = $('#galleryContent');
    var last = false;
    $.each(sorted, function (key, value) {
        var elem = $(value.element);
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
    var aX = a.point.x;
    var aY = a.point.y;
    var bX = b.point.x;
    var bY = b.point.y;
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
    var aVal = 1;
    var bVal = 1;
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
    var dispName = name.substring(0, 20);
    if (name.length > 20) {
        dispName += '...';
    }
    dispName = dispName.replace("%20", "");
    return dispName;
}


function toggleFavorite(el) {
    var parent = el.closest('.thumbDiv');
    var id = parent.data('link');
    var isFav = (parent.data('favorite'));
    console.log("Parent fav: " + parent.data('favorite'));
    var clone = parent.clone();
    clone.attr('data-favorite', !isFav);
    clone.addClass('clone');
    $('#galleryContent').append(clone);
    console.log("Setting favorite to " + !isFav + " for ", parent);
    shuffleInstance.remove(parent);
    shuffleInstance.add(clone);
    $('.clone').removeClass('clone');
    getMedia();
    var page = $('#pageKey').attr('content');
    var child = clone.find('.fa-star');
    child.toggleClass('fa');
    child.toggleClass('far');

    var url = phpSelf + "?favorite&id=" + id;
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
