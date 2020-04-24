// ==UserScript==
// @name         QR-NSFW v2.0
// @namespace    http://dtf.ru/
// @version      2.0
// @description  Watch NSFW content on DTF using qr-codes magic!
// @author       Prostagma?
// @author       Zhenya Sokolov
// @author       Neko Natum
// @match        https://dtf.ru/*
// @require      https://raw.githubusercontent.com/cozmo/jsQR/master/dist/jsQR.js
// @require      https://www.cssscript.com/demo/canvas-based-qr-code-generator-with-pure-javascript-vanillaqr-js/VanillaQR.min.js
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/fotorama/4.6.4/fotorama.js
// @require      https://unpkg.com/axios/dist/axios.min.js
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_download
// @connect      leonardo.osnova.io
// @connect      i.postimg.cc
// @resource     customCSS https://userstyles.org/api/v1/styles/css/179778
// @resource     fotorama  https://cdnjs.cloudflare.com/ajax/libs/fotorama/4.6.4/fotorama.css
// @copyright 2020, Prostagma (https://openuserjs.org/users/Prostagma)
// @license MIT
// @icon          https://dtf-static-bf19cf1.gcdn.co/static/build/dtf.ru/favicons/favicon.ico
// @icon64        https://dtf-static-bf19cf1.gcdn.co/static/build/dtf.ru/favicons/favicon.ico
// ==/UserScript==

(function() {
    var qrs_cache = new Object();
    var not_qr_cache = new Set();
    let isMozilla = window.navigator.userAgent.includes('Firefox');
    const UUID_REGEX = /([0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12})/i;

    // TamperMonkey Buttons code block start
    function manipulate(value) {
        let db_value = GM_getValue(value, false);
        GM_setValue(value, !db_value);
        GM_notification(`${value} are now ${!db_value}`);
    }

    function darkTheme() {
        manipulate('darkTheme');
    }

    function getComments() {
        manipulate('comments_show');
    }

    GM_registerMenuCommand("Turn on/off comments", getComments);
    GM_registerMenuCommand("Turn on/off darkTheme", darkTheme);
    // End

    if (isMozilla) {
        waitForKeyElements(
            '.thesis__panel', addButtonsToCommEditor
        );
        waitForKeyElements(
            '.header__right', addButtonsToPostEditor
        );
    }
    else {
        var observerObserving = false;
        var pageObserver = new MutationObserver(check);
        observerChangeState();
    }

    var s = [];

    var u = {
        callFileUploader: function (t) {
            var e = t.accept,
                n = void 0 === e ? "image/*, video/mp4, video/x-m4v, video/*" : e,
                i = t.limit,
                r = void 0 === i ? 1 : i,
                s = document.createElement('input');
            s.type = "file";
            s.accept = n;
            s.style = "position: absolute; width: 1px; height: 1px; left: -100px; top: -100px;";
            s.multiple = true;
            document.body.appendChild(s);
            setTimeout((() => {
                s.click();
                u.remove(s);
            }), 0);
            return new Promise((function (t) {
                u.one(s, "change", (function (e) {
                    console.log(e);
                    t(Array.prototype.slice.call(e.target.files).slice(0, r));
                }));
            }));
        },
        parseHTML: function (e) {
            let o = document.implementation.createHTMLDocument("");
            o.body.innerHTML = e;
            return o;
        },
        remove: function (t) {
            t && t.parentElement && t.parentElement.removeChild(t);
        },
        one: function (t, e, n) {
            var i = this;
            u.on(t, e, (function () {
                u.off(t, e);
                n.apply(this, Array.prototype.slice.call(arguments));
            }));
        },
        on: function (t, e, n) {
            if (t) {
                var i = u.c(e);
                t.addEventListener(i, n);
                s.push({
                    el: t,
                    event_string: e,
                    event_name: i,
                    event_class: u.tt_u(e),
                    callback: n
                });
            }
        },
        off: function (t, e) {
            t && u.l(t, e, !0).forEach((function (e) {
                t.removeEventListener(e.event_name, e.callback);
                s.splice(s.indexOf(e), 1);
            }));
        },
        l: function (t, e) {
            var n = u.c(e),
                i = u.tt_u(e),
                o = "" === n && void 0 !== i;
            return s.filter((function (r, a) {
                return t === r.el && (void 0 === n || (!(!o || i !== r.event_class) || (void 0 === i && n === r.event_name || !(!i || e !== r.event_string))));
            }));
        },
        c: function (t) {
            return t && t.split(".")[0];
        },
        tt_u: function (t) {
            return t && t.split(".")[1];
        },
    };

    function filter(a, fun) {
        let [small, big] = [ [], [] ];
        for (var i = 0; i < a.length; i++) {
            if (fun(a[i])) {
                small.push(a[i]);
            }
            else {
                big.push(a[i]);
            }
        }
        return [small, big];
    }

    function downloadImage(url, data) {
        let downloadLink = document.createElement('a');
        downloadLink.setAttribute("download", url);
        downloadLink.href = data//data.replace("image/png", "image/octet-stream");
        downloadLink.click();
    }

    var qr = new VanillaQR({
        url: "http://www.cssscript.com/",
        width: 200,
        height: 200,

        colorLight: "#fff",
        colorDark: "#000000",

        onError: function () {
            alert("Something went wrong");
        }
    });

    function safeQrPrepare(size, link) {
        if (size < 200) {
            return new VanillaQR({
                url: link,
                width: size,
                height: size,
                colorLight: "#fff",
                colorDark: "#000000",
                onError: function () {
                    alert("Something went wrong");
                }
            });
        }
        else {
            qr.url = link;
            return qr;
        }
    }

    function upload_files(formData, url, upl_server = false) {
        let notif = document.querySelector('#qr-notif');
        notif.style.display = '';
        let pT = notif.querySelector('#qr-text');
        pT.innerHTML = '<progress id="prGS" max="100" value="0" style="width: 100%"></progress>';
        let prGS = pT.querySelector('progress');
        console.log(url);
        axios.request({
            method: "post",
            url: url,
            data: formData,
            headers: {
                'Accept': 'application/json',
                'x-this-is-csrf': 'THIS IS SPARTA!'
            },
            onUploadProgress: (p) => {
                prGS.max = p.total;
                prGS.value = p.loaded;
            }
        }).then(data => {
            pT.innerHTML = '<b>DONE</b>';

            let canvas = document.createElement('canvas');
            let context = canvas.getContext("2d");
            console.log(data.data);
            if (!upl_server) {
                axios.request({
                    method: "post",
                    url: "https://python-flask.alekxuk.now.sh/v1/qrcodes/generate",
                    data: JSON.stringify({payload: data.data.result}),
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }).then(data => {
                    console.log(data.data);
                    data.data.result.forEach(qr_result => {
                        GM_download(`https://leonardo.osnova.io/${qr_result.qr_uuid}/`, `${qr_result.uuid}.png`);
                        //downloadImage(`${qr_result.uuid}.png`, `https://leonardo.osnova.io/${qr_result.qr_uuid}/`);
                    })
                })
                //data.data.result.forEach((el, index) => {
                    //if (el.type === 'error') {
                    //    pT.innerHTML = '<b>Error</b>';
                    //} else {
                        //console.log(el.data.uuid);
                        //console.log(el);
                        //let imageMinSize = Math.min(Math.min(el.data.width, el.data.height), 200);
                        //let qr = safeQrPrepare(imageMinSize, `${el.data.uuid}|${"mp4,gif".includes(el.data.type) ? "mp4" : 'audio_info' in el.data ? el.data.audio_info.format : el.data.type}`);
                        //qr.init();
                        //canvas.width = 'width' in el.data ? el.data.width : 200;
                        //canvas.height = 'height' in el.data ? el.data.height : 200;
                        //context.drawImage(qr.domElement, 0, 0);
                        //downloadImage(`${el.data.uuid}.png`, canvas.toDataURL("image/png"));
                    //}
                //});
            } else {
                let canvas = document.createElement('canvas');
                let context = canvas.getContext("2d");
                let uploadedFileUrl = `https://${upl_server.server}.gofile.io/getUpload?c=${data.data.data.code}|gofile`;
                console.log(uploadedFileUrl);
                let qr = safeQrPrepare(200, uploadedFileUrl);
                qr.init();
                canvas.width = 200;
                canvas.height = 200;
                context.drawImage(qr.domElement, 0, 0);
                downloadImage(`${data.data.data.code}.png`, canvas.toDataURL("image/png"));
            }
            setTimeout(() => {
                notif.style.display = "none";
            }, 5000);
        });
    }

    function prepareImageUploaderDiv(t, className = 'thesis__upload_file thesis__attach_something') {
        let entry = document.createElement('div');
        entry.className = className;
        entry.innerHTML = '<img class="icon icon--ui_image" id="reply-btn" src="https://leonardo.osnova.io/f44b037e-389d-4ed7-902c-83aeca953095/" height="16">';
        entry.onclick = (event) => {
            u.callFileUploader(t).then(((e) => {
                let [small, big] = filter(e, (file) => {return file.size <= 50866700;});
                let fd = new FormData();
                if (big.length) {
                    axios.request({
                        method: "get",
                        url: 'https://apiv2.gofile.io/getServer',
                        headers: {
                            'Accept': 'application/json',
                        }
                    }).then(data => {
                        console.log(data.data.data.server);
                        let big_names = [];
                        big.forEach((item) => {
                            fd.set(`filesUploaded`, item);
                            big_names.push(item.name);
                            console.log(item);
                        });
                        fd.set('email', '9hanade.ahm@md0009.com');
                        upload_files(fd, `https://${data.data.data.server}.gofile.io/upload`, {'server': data.data.data.server, 'names': big_names});
                    });
                } else {
                    //return 0;
                    console.log('Uploading Small Files');
                    console.log(small);
                    fd = new FormData();
                    small.forEach((item, index) => {
                        fd.set(`file_${index}`, item);
                        console.log(item);
                    });
                    fd.set('render', false);
                    upload_files(fd, "https://dtf.ru/andropov/upload");
                }
            }));
        };
        return entry;
    }

    function addButtonsToPostEditor(change = null) {
        // Image uploader
        let entry = prepareImageUploaderDiv({
            limit: 10,
            accept: "image/*, video/mp4, audio/mp3"
        }, 'ui-button ui-button--6 ui-button--only-icon editor__header-save-button');
        // Qr from text generator
        entry.style = 'margin-right: 10px;';
        //let qrGen = prepareTextQRGeneratorDiv('ui-button ui-button--6 ui-button--only-icon editor__header-save-button');
        //qrGen.style = 'margin-right: 10px;';
        let editor__header = change || document.querySelector('.header__right');
        if (isMozilla) { // not working piece of shit
            let ddd = document.querySelector('.header__right');
            ddd.insertBefore(qrGen, ddd.firstElementChild);
            ddd.insertBefore(entry, ddd.firstElementChild);
        }
        else {
            editor__header.insertBefore(entry, editor__header.firstElementChild);
            editor__header.insertBefore(qrGen, editor__header.firstElementChild);
        }
    }

    function addButtonsToCommEditor() {
        let thesis_panel = document.querySelector('.thesis__panel');
        // Image uploader
        let entry = prepareImageUploaderDiv({
            limit: 2,
            accept: "image/*, video/mp4, audio/mp3"
        });
        thesis_panel.insertBefore(entry, thesis_panel.querySelector('.thesis__upload_file'));
        // Qr from text generator
        //let qrGen = prepareTextQRGeneratorDiv();
        //thesis_panel.insertBefore(qrGen, thesis_panel.querySelector('.ui_preloader'));

        if (!document.querySelector('#qr-cmnt-btn')) {
            addCommentParseButton();
        }
    }

    function check(changes, observer) {
        for (let change of changes) {
            if (change.type !== 'childList') {
                continue;
            }
            if (change.target.className === 'comments_form__editor') {
                observer.disconnect();
                addButtonsToCommEditor();
                observerObserving = !observerObserving;
                break;
            }
            else if (change.target.className === 'page page--editor') {
                observer.disconnect();
                addButtonsToPostEditor(change.addedNodes[0].firstElementChild.firstElementChild.lastElementChild);
                observerObserving = !observerObserving;
                break;
            }
        }
    }

    if (!isMozilla) {
        let fireOnHashChangesToo = true;
        let lastPathStr = location.pathname;
        let lastQueryStr = location.search;
        let lastHashStr = location.hash;
        let pageURLCheckTimer = setInterval(
            () => {
                if (lastPathStr !== location.pathname ||
                    lastQueryStr !== location.search ||
                    (fireOnHashChangesToo && lastHashStr !== location.hash)
                   ) {
                    lastPathStr = location.pathname;
                    lastQueryStr = location.search;
                    lastHashStr = location.hash;
                    observerChangeState();
                }
            }, 222
        );
    }

    function observerChangeState() {
        if (observerObserving) {
            console.log('OBSERVER ALREADY OBSERVING');
        } else {
            observerObserving = !observerObserving;
            console.log('OBSERVER STATE CHANGED');
            pageObserver.observe(document, {
                childList: true,
                subtree: true
            });
        }
    }

    function isValidURL(str) {
        let a = document.createElement('a');
        a.href = str;
        return (a.host && a.host != window.location.host);
    }

    function formMusicPlayer(link, node) {
        let g = node.parentNode;
        let player = document.createElement(g.className === 'comments__item__media' ? 'div' : 'center');
        player.innerHTML = `<audio controls preload="metadata" style=" width:300px;">
<source src="${link}" type="audio/mpeg">
Your browser does not support the audio element.
</audio>`;
        node.remove();
        g.appendChild(player);
    }

    function formVideoDiv(mp4Link, node, UUID = false) {
        let g = node.parentNode;
        let center = document.createElement('center');
        center.innerHTML = `
<div class="andropov_video andropov_video--service-default andropov_video--mp4" style="max-width: 100%;" data-video-thumbnail="${UUID ? mp4Link : 'https://leonardo.osnova.io/2733eb1a-912f-6a45-f1d4-7d2739b7947b'}-/format/jpg/" data-video-mp4="${mp4Link}" data-video-play-mode="click" data-video-service="default">
<div class="andropov_video__container" style="padding-top: 66%;">
<div class="andropov_video__dummy" style="background-color: rgb(12, 12, 12); background-image: url(&quot;${UUID ? mp4Link : 'https://leonardo.osnova.io/2733eb1a-912f-6a45-f1d4-7d2739b7947b'}-/format/jpg/-/scale_crop/640x360/center/&quot;);">
<svg class="icon icon--andropov_play_default" xmlns="http://www.w3.org/2000/svg"><use xlink:href="#andropov_play_default"></use></svg>
<span class="ui_preloader ui_preloader--big">
<span class="ui_preloader__dot"></span>
<span class="ui_preloader__dot"></span>
<span class="ui_preloader__dot"></span>
</span></div></div></div>`;

        function playVideo() {
            center.innerHTML = `<video autoplay loop playsinline controls width="100%"> <source src="${mp4Link}" type="video/mp4"> </video>`;
            center.removeEventListener("click", playVideo);
        }

        center.addEventListener('click', playVideo);
        node.remove();
        //g.lastElementChild.remove();
        g.appendChild(center);
    }

    function formImageDiv(url, node) {
        node.setAttribute('data-image-src', url);
        let img = node.querySelector('img');
        if (img) {
            img.src = url;
        }
    }

    function process_qr_data(qr_data, image_node, spliter = '|') {
        let [url_test, tag_test] = [null, null];
        if (spliter === '|') {
            [url_test, tag_test] = qr_data.qr_data.split('|');
        } else {
            let split_code = qr_data.qr_data.split(spliter);
            tag_test = split_code.pop();
            url_test = split_code.join('-');
        }

        console.log(tag_test, url_test, qr_data.entry_data.type, qr_data.entry_data.file_type);

        switch (qr_data.entry_data.type) {
            case 'image':
                switch(qr_data.entry_data.file_type) {
                    case 'png':
                    case 'jpg':
                        formImageDiv(`https://leonardo.osnova.io/${qr_data.uuid}/`, image_node);
                        break;
                    case 'gif':
                        formVideoDiv(`https://leonardo.osnova.io/${qr_data.uuid}/`, image_node, true);
                        break;
                    default:
                        break;
                }
                break;
            case 'audio':
                formMusicPlayer(`https://leonardo.osnova.io/audio/${qr_data.uuid}/`, image_node);
                break;
            default:
                break;
        }
    }

    function evolution_decode(selector = '.comments__item__media') {
        let uuids_set = new Set();
        for (let select of Array(selector)) {
            document.querySelectorAll(select).forEach(comment => {
                comment.querySelectorAll('.andropov_image').forEach(andr_img => {
                    if (!andr_img.parentElement.className.includes('link')) {
                        let uuid = andr_img.attributes["data-image-src"].value.split('/')[3];
                        if (qrs_cache.hasOwnProperty(uuid)) {
                            process_qr_data(qrs_cache[`${uuid}`], andr_img);
                            console.log(uuid, ' is CACHED QR');
                        } else if (!not_qr_cache.has(uuid)) {
                            uuids_set.add(uuid);
                            andr_img.setAttribute('uuid', uuid);
                        } else {
                            console.log(uuid, ' is CACHED NOT QR');
                        }
                    }})});
        }
        console.log(uuids_set);
        if (uuids_set.size) {
            axios.request({
                method: "post",
                url: "https://python-flask.alekxuk.now.sh/v1/qrcodes/decode",
                data: JSON.stringify({uuids: [...uuids_set]}),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }).then(data => {
                console.log(data);
                data.data.success.forEach(result => {
                    document.querySelectorAll(`[uuid="${result.qr_uuid}"]`).forEach(comment_node => {
                        qrs_cache[result.qr_uuid] = result;
                        process_qr_data(result, comment_node);
                    });
                });
                data.data.not_qr.forEach(not_qr => {
                    not_qr_cache.add(not_qr);
                });
                // console.log(not_qr_cache);
            })
        }
    }

    function parseMainBody(event, commentsOnly = false) {
        let notif = document.querySelector("#qr-notif");
        if (notif.style.display === "none") {
            notif.style.display = '';
            if (document.getElementsByClassName("layout--entry").length === 0) {
                document.querySelector("#qr-text").textContent = "Зайдите в пост";
            }
            else {
                document.querySelector("#qr-text").textContent = "Ищу картинки";
                if (commentsOnly) {
                    evolution_decode();
                }
                else if (!GM_getValue("comments_show", false)) {
                    evolution_decode('.layout--entry__content');
                } else {
                    evolution_decode(['.layout--entry__content', '.comments__item__media']);
                }

                setTimeout(() => {
                    notif.style.display = "none";
                }, 5000);
            }
        }
        else {
            notif.style.display = "none";
        }
    }

    function parseMainBodyFunc(event) {
        parseMainBody(event, false);
    }

    function parseCommentsOnlyFunc(event) {
        parseMainBody(event, true);
    }

    function addCommentParseButton() {
        let commQrButton = document.querySelector('.comments__subscribe');
        if (commQrButton) {
            let commButon = document.createElement('div');
            commButon.style = 'float: right; padding: 10px 10px 0px 10px;';
            commButon.innerHTML = '<img id="qr-cmnt-btn" src="https://leonardo.osnova.io/f44b037e-389d-4ed7-902c-83aeca953095/" height="32">';
            commButon.onclick = parseCommentsOnlyFunc;
            commQrButton.parentNode.appendChild(commButon);
        }
    }

    var referenceNode = document.querySelector('.creation_button');
    referenceNode.setAttribute("class", "creation_button main_menu__write-button ui-button ui-button--12 ui-button--small lm-hidden l-mr-5");
    let entry = document.createElement('div');
    entry.innerHTML = '<img id="qr-btn" src="https://leonardo.osnova.io/f44b037e-389d-4ed7-902c-83aeca953095/" height="32"><div id="qr-notif" class="messenger-panel__down" style="display: none;" data-v-d4ebc8c2=""><div id="qr-text" class="messenger-panel__down-head" data-v-d4ebc8c2="">Попробуйте еще раз</div> </div>';
    entry.onclick = parseMainBodyFunc;
    referenceNode.parentNode.insertBefore(entry, referenceNode.nextSibling);

    if (GM_getValue("darkTheme", false)) {
        GM_addStyle(JSON.parse(GM_getResourceText ("customCSS")).css.slice(33, -1));
    }
    GM_addStyle(GM_getResourceText ("fotorama").replace('fotorama.png', 'https://cdnjs.cloudflare.com/ajax/libs/fotorama/4.6.4/fotorama.png'));
    GM_addStyle('.andropov_image__inner {background: none !important;}');
})();