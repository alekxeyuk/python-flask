// ==UserScript==
// @name         QR-NSFW
// @namespace    http://dtf.ru/
// @version      2.1.15
// @description  Watch NSFW content on DTF using qr-codes magic!
// @author       Prostagma?
// @author       Zhenya Sokolov
// @author       Neko Natum
// @match        https://dtf.ru/*
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
// @resource     customCSS https://raw.githubusercontent.com/neko-natum/DTF-dark-themes/master/PornTF.user.css
// @resource     fotorama  https://cdnjs.cloudflare.com/ajax/libs/fotorama/4.6.4/fotorama.css
// @resource     qr_popup_css https://dtf-qrnsfw.herokuapp.com/static/qr_nsfw_css.css
// @copyright 2020, Prostagma (https://openuserjs.org/users/Prostagma)
// @license MIT
// @icon          https://dtfstaticbf19cf1-a.akamaihd.net/static/build/dtf.ru/favicons/favicon.ico
// @icon64        https://dtfstaticbf19cf1-a.akamaihd.net/static/build/dtf.ru/favicons/favicon.ico
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

    function generateRequest(payload_data) {
        axios.request({
            method: "post",
            url: "https://dtf-qrnsfw.herokuapp.com/v1/qrcodes/generate",
            data: JSON.stringify({payload: payload_data}),
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }).then(data => {
            console.log(data.data);
            data.data.result.forEach(qr_result => {
                GM_download(`https://leonardo.osnova.io/${qr_result.qr_uuid}/`, `${qr_result.uuid}.png`);
            })
        })
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
            console.log(data.data);
            if (!upl_server) {
                generateRequest(data.data.result);
            } else {
                let uploadedFileUrl = `https://${upl_server.server}.gofile.io/getUpload?c=${data.data.data.code}`;
                console.log(uploadedFileUrl);
                generateRequest([{type: 'custom', data: {'text': uploadedFileUrl}}]);
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
                            fd.append(`filesUploaded`, item);
                            big_names.push(item.name);
                            console.log(item);
                        });
                        fd.set('email', '9hanade.ahm@md0009.com');
                        upload_files(fd, `https://${data.data.data.server}.gofile.io/upload`, {'server': data.data.data.server, 'names': big_names});
                    });
                } else {
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

    function prepareCustomQrDiv(className = 'thesis__upload_file thesis__attach_something') {
        let entry = document.createElement('div');
        entry.className = className;
        entry.innerHTML = '<img class="icon icon--ui_image" id="reply-btn" src="https://leonardo.osnova.io/352313d2-eed6-edef-4af8-8ffb18cfa7ea/" height="16">';
        entry.onclick = (event) => {
            let qr_popup = document.querySelector('.qr_popup');
            let classes = ['qr_popup__container--shown', 'qr_popup__layout--shown'];
            qr_popup.childNodes.forEach(node => node.classList.add(classes.pop()));
        };
        return entry;
    }

    function addButtonsToPostEditor(change = null) {
        // Image uploader
        let entry = prepareImageUploaderDiv({
            limit: 10,
            accept: "image/*, video/*, audio/*"
        }, 'ui-button ui-button--6 ui-button--only-icon editor__header-save-button');
        // Qr from text generator
        entry.style = 'margin-right: 10px;';
        let qrGen = prepareCustomQrDiv('ui-button ui-button--6 ui-button--only-icon editor__header-save-button');
        qrGen.style = 'margin-right: 10px;';
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
            accept: "image/*, video/*, audio/*"
        });
        thesis_panel.insertBefore(entry, thesis_panel.querySelector('.thesis__attaches'));
        // Qr from text generator
        let qrGen = prepareCustomQrDiv();
        thesis_panel.insertBefore(qrGen, thesis_panel.querySelector('.thesis__attaches'));

        if (!document.querySelector('#qr-cmnt-btn')) {
            addCommentParseButton();
        }

        addMusicPlaylist();
    }

    var weather = false;

    function check(changes, observer) {
        for (let change of changes) {
            if (change.type !== 'childList') {
                continue;
            }
            if (!weather && change.target.className === 'page page--index ') {
                let weather_p = change.target.querySelector('.l-fs-16.lm-fs-15.t-ff-1-700');
                if (weather_p) {
                    if (weather_p.innerText.search('°') === -1) {
                        weather = true;
                        axios.request({
                            method: "get",
                            url: 'https://wttr.in?format=1',
                            headers: {
                                'Accept': 'text/plain',
                            }
                        }).then(data => {
                            weather_p.innerText = weather_p.innerText + '\t' + data.data.trim();
                        }).then(() => {
                            axios.request({
                                method: "get",
                                url: 'https://api.dtf.ru/v1.9/rates',
                                headers: {
                                    'Accept': 'text/plain',
                                }
                            }).then(data => {
                                weather_p.innerText = weather_p.innerText + '\t💲 = ' + data.data.result.USD.rate;
                                weather_p.innerText = weather_p.innerText + '\t💶 = ' + data.data.result.EUR.rate;
                            })
                        })
                    }
                }
            }
            else if (change.target.className === 'comments_form__editor') {
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

    window.addEventListener("load", () => {
        if (!isMozilla) {
            let fireOnHashChangesToo = true;
            let lastPathStr = location.pathname;
            let lastQueryStr = location.search;
            let lastHashStr = location.hash;
            let locationModule = Air.get("module.location");
            locationModule.on("Url changed", (change) => {
                console.log(change.url);
                if (lastPathStr !== change.url ||
                    lastQueryStr !== location.search ||
                    (fireOnHashChangesToo && lastHashStr !== location.hash)
                   ) {
                    lastPathStr = change.url;
                    lastQueryStr = location.search;
                    lastHashStr = location.hash;
                    observerChangeState();
                    weather = false;
                }
            });
        }
    });

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
        g.appendChild(center);
    }

    function formImageDiv(url, node) {
        node.setAttribute('data-image-src', url);
        let img = node.querySelector('img');
        if (img) {
            img.src = url;
        }
    }

    function formIframe(iframeHTML, node) {
        let g = node.parentNode;
        let player = document.createElement(g.className === 'comments__item__media' ? 'div' : 'center');
        player.innerHTML = iframeHTML;
        node.remove();
        g.appendChild(player);
        if (g.className === 'comments__item__media') {
            g.style.width = '100%';
            g.parentNode.style.paddingRight = '0';
        }
    }

    function formMusicPlayer(link, node) {
        formIframe(`<audio controls preload="metadata" style=" width:100%;"><source src="${link}" type="audio/mpeg"></audio>`, node);
    }

    function formSoundCloud(link, node) {
        formIframe(`<iframe width="100%" height="116" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=${link}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false"></iframe>`, node);
    }

    function formYaMusic(data, node) {
        let url = `https://music.yandex.ru/iframe/`;
        if (data.track) {
            url += `#track/${data.track}/${data.album}`;
        } else if (data.album) {
            url += `#album/${data.album}`;
        } else {
            url += `#playlist/${data.user}/${data.playlist}`;
        }
        formIframe(`<iframe frameborder="0" style="border:none;width:100%;height:${!data.track ? '400px' : '151px'};" width="100%" src="${url}"></iframe>`, node);
    }

    function formPornHub(data, node) {
        formIframe(`<iframe src="https://rt.pornhub.com/embed/${data}" frameborder="0" width="560" height="315" scrolling="no" allowfullscreen></iframe>`, node);
    }

    function formGoFile(url, node) {
        axios.request({
            method: "get",
            url: url,
            headers: {
                'Accept': 'application/json',
            }
        }).then(data => {
            console.log(data.data.data.files);
            node = node.parentNode;
            node.innerHTML = '';
            Object.values(data.data.data.files).forEach(file => {
                let new_node = document.createElement('div');
                node.appendChild(new_node);
                let mimetype = file.mimetype.split('/')[0];
                switch (mimetype) {
                    case 'audio':
                        formMusicPlayer(file.link, new_node);
                        break;
                    case 'image':
                        formImageDiv(file.link, new_node);
                        break;
                    case 'video':
                        formVideoDiv(file.link, new_node);
                        break;
                    default:
                        break;
                }
            });
        });
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
            case 'custom':
                switch(qr_data.entry_data.file_type) {
                    case 'gofile':
                        formGoFile(url_test, image_node);
                        break;
                    case 'pornhub':
                        formPornHub(url_test, image_node);
                        break;
                    case 'soundcloud':
                        formSoundCloud(url_test, image_node);
                        break;
                    case 'yamusic':
                        formYaMusic({track: tag_test, album: url_test}, image_node);
                        break;
                    case 'yamusic_playlist':
                        formYaMusic({playlist: tag_test, user: url_test}, image_node);
                        break;
                    case 'image':
                        formImageDiv(url_test, image_node);
                        break;
                    case 'video':
                        formVideoDiv(url_test, image_node, false);
                        break;
                    case 'audio':
                        formMusicPlayer(url_test, image_node);
                        break;
                    default:
                        break;
                }
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
                url: "https://dtf-qrnsfw.herokuapp.com/v1/qrcodes/decode",
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
            })
        }
    }

    function qrFastDecode() {
        console.log('qrfast implemented');
        for (let archor of document.querySelectorAll('.content__anchor')) {
            let sib_elem = archor.nextElementSibling;
            if (sib_elem.tagName === "FIGURE") {
                let split_code = archor.getAttribute('name').split('-');
                let tag_test = split_code.pop();
                let url_test = split_code.join('-');
                let data = {
                    entry_data: {
                        file_type: tag_test,
                        type: "image"
                    },
                    qr_data: archor.getAttribute('name'),
                    qr_uuid: sib_elem.querySelector('.andropov_image').attributes["data-image-src"].value.split('/')[3],
                    uuid: url_test
                }
                process_qr_data(data, sib_elem.querySelector('.andropov_image'), '-');
            }
        }
    }

    function parseMainBody(event, commentsOnly = false) {
        let notif = document.querySelector("#qr-notif");
        if (notif.style.display === "none") {
            notif.style.display = '';
            if (document.getElementsByClassName("l-entry").length === 0) {
                document.querySelector("#qr-text").textContent = "Зайдите в пост";
                setTimeout(() => {
                    notif.style.display = "none";
                }, 5000);
            }
            else {
                document.querySelector("#qr-text").textContent = "Ищу картинки";
                if (commentsOnly) {
                    evolution_decode();
                }
                else if (!GM_getValue("comments_show", false)) {
                    if (document.querySelector('[name="qrfast"]')) {
                        qrFastDecode();
                    } else {
                        evolution_decode('.l-entry__content');
                    }
                } else {
                    if (document.querySelector('[name="qrfast"]')) {
                        qrFastDecode();
                        evolution_decode();
                    } else {
                        evolution_decode(['.l-entry__content', '.comments__item__media']);
                    }
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

    function addPopUp() {
        let referenceNode = document.querySelector('.app');
        let popUp = document.createElement('div');
        popUp.classList.add('qr_popup');
        popUp.setAttribute('data-ignore-outside-click', '');
        popUp.innerHTML =
            `<div class="qr_popup__layout"></div><div class="qr_popup__container"><div class="qr_popup__container__window qr_popup__container__window--styled"><div class="qr_popup__container__window__close"><svg class="icon icon--ui_close" width="12" height="12"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#ui_close"></use></svg></div><div class="qr_popup__container__window__tpl"><div class="qr_popup__content qr_popup__content--popup_attach_service">
<h4>Custom QrCode Creation</h4>
<form class="ui_form l-mt-15" onsubmit="return false;">
<fieldset>
<input type="text" name="link" placeholder="Ссылка" autofocus="">
<label class="label l-block l-mt-5">Ya.Music, SoundCloud, PornHub</label>
</fieldset></form><div class="thesis__submit ui-button ui-button--1">Отправить</div><label class="qr_popup_label label l-block l-mt-5" style="visibility: hidden;color: red;"></label></div></div></div></div>`
        let closeButton = popUp.querySelector('.qr_popup__container__window__close');
        let sendButton = popUp.querySelector('.thesis__submit');
        let textField = popUp.querySelector('input');
        let statusLabel = popUp.querySelector('.qr_popup_label');
        closeButton.onclick = () => {
            console.log(popUp);
            popUp.childNodes.forEach(node => node.classList.remove('qr_popup__layout--shown', 'qr_popup__container--shown'));
            textField.value = '';
            statusLabel.style.visibility = 'hidden';
            sendButton.classList.remove('ui-button--loading');
        }

        function showError(label, errorText, button) {
            button.classList.remove('ui-button--loading');
            label.style.visibility = 'visible';
            label.style.color = 'red';
            label.textContent = errorText;
        }

        sendButton.onclick = () => {
            statusLabel.style.visibility = 'hidden';
            console.log(textField.value);
            if (textField.value.length >= 8) {
                let textValue = textField.value;
                textField.value = '';
                sendButton.classList.add('ui-button--loading');
                axios.request({
                    method: "post",
                    url: "https://dtf-qrnsfw.herokuapp.com/v1/qrcodes/generate",
                    data: JSON.stringify({payload: [{type: 'custom', data: {'text': textValue}}]}),
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }).then(data => {
                    sendButton.classList.remove('ui-button--loading');
                    if (data.data.result.length) {
                        data.data.result.forEach(qr_result => {
                            console.log(qr_result);
                            GM_download(`https://leonardo.osnova.io/${qr_result.qr_uuid}/`, `${qr_result.qr_uuid}.png`);
                        })
                        closeButton.click();
                    } else {
                        showError(statusLabel, 'Error - server was not able to parse your link', sendButton);
                    }
                }).catch(error => {
                    if (!error.status) {
                        showError(statusLabel, 'Error - Network Error', sendButton);
                    } else {
                        console.log(error);
                        showError(statusLabel, error.response, sendButton);
                    }
                });
            } else {
                showError(statusLabel, 'Error - too short url', sendButton);
            }
        }
        referenceNode.appendChild(popUp);
        GM_addStyle(GM_getResourceText ("qr_popup_css"));
    }

    function addQrButton() {
        waitForKeyElements(
            '.search__field', () => {
                if (!document.querySelector('#qr-btn')) {
                    let referenceNode = document.querySelector('.site-header__item--desktop');
                    console.log(referenceNode);
                    referenceNode.classList.add("l-mr-5");
                    let entry = document.createElement('div');
                    entry.classList.add("site-header__item--centered");
                    entry.classList.add("site-header__item");
                    entry.innerHTML = '<img id="qr-btn" src="https://leonardo.osnova.io/f44b037e-389d-4ed7-902c-83aeca953095/" height="32"><div id="qr-notif" class="messenger-panel__down" style="display: none;"><div id="qr-text" class="messenger-panel__down-head">Попробуйте еще раз</div> </div>';
                    entry.onclick = parseMainBodyFunc;
                    referenceNode.parentNode.insertBefore(entry, referenceNode.nextSibling);
                    let spacer = document.querySelector('.sidebar__spacer');
                    if (spacer) {
                        spacer.remove();
                    }
                }
            }
        )
    }

    function playlistObserver() {
        if(!PLayListObserverExist) {
            PLayListObserverExist = true;
            let eee = document.querySelector('.floating_player');

            let ob = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (eee.firstChild.getAttribute('data-state') === 'ended') {
                        if (music_object.length) {
                            music_object[0].click();
                            music_object[0].remove();
                            music_object.shift();
                        } else {
                            console.log("No More Music");
                        }
                    }
                });
            });

            ob.observe(eee, {
                attributes: true,
                attributeFilter: ['data-state'],
                subtree: true
            });
        } else {
            console.log("PLayListObserverExist");
        }
    }

    function addMusicPlaylist() {
        let music_list = document.querySelectorAll('.block-audio__wrapper');
        if (music_list.length >= 2) {
            let content = document.querySelector('.content-header');
            let playListCreateButton = document.createElement('div');
            playListCreateButton.setAttribute('class', 'content-header__item content-header__item--listen lm-hidden');
            playListCreateButton.innerHTML = '<button class="playlist_button v-button v-button--default v-button--size-tiny" data-layout-desktop="icon,label" data-layout-mobile="icon,label"><div class="v-button__icon v-button__icon--new"><svg class="icon icon--v_headphones" width="24" height="24" xmlns="http://www.w3.org/2000/svg"><use xlink:href="#v_headphones"></use></svg></div><span class="v-button__label">Listen</span></button>';
            content.insertBefore(playListCreateButton, content.lastElementChild);
            content.querySelector('.playlist_button').onclick = () => {
                music_object = [];
                let referenceNode = document.querySelector('body');
                let pPlNode = referenceNode.querySelector('.music_playlist');
                if (pPlNode) {
                    console.log('playlistnode already exist');
                    pPlNode.innerHTML = '';
                } else {
                    let playList = document.createElement('div');
                    playList.classList.add('music_playlist');
                    playList.setAttribute('style', 'display: none;');
                    referenceNode.appendChild(playList);
                    pPlNode = playList;
                }
                music_list.forEach(el => {
                    let mNode = document.createElement('div');
                    mNode.setAttribute('class', 'audio_listen_button');
                    mNode.setAttribute('data-src', el.firstElementChild.attributes.src.textContent);
                    mNode.setAttribute('data-title', el.firstElementChild.attributes.title.textContent);
                    mNode.setAttribute('data-duration', el.firstElementChild.attributes["data-duration"].textContent);
                    mNode.setAttribute('data-entry-url', el.firstElementChild.attributes["data-entry-url"].textContent);
                    mNode.setAttribute('data-hash', el.firstElementChild.attributes["data-hash"].textContent);
                    mNode.setAttribute('air-click', 'Listen audio entry');
                    mNode.setAttribute('data-gtm', 'audio_version_start');
                    music_object.push(mNode);
                    pPlNode.appendChild(mNode);
                })
                music_object[0].click();
                music_object[0].remove();
                music_object.shift();
            }
            playlistObserver();
        }
    }

    addQrButton();
    addPopUp();
    var PLayListObserverExist = false;
    var music_object = [];

    if (GM_getValue("darkTheme", false)) {
        let style = GM_getResourceText ("customCSS");
        GM_addStyle(style.slice(style.search('{') + 1, -1));
    }
    GM_addStyle(GM_getResourceText("fotorama").replace('fotorama.png', 'https://cdnjs.cloudflare.com/ajax/libs/fotorama/4.6.4/fotorama.png'));
})();