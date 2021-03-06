import datetime
import json
import sys
import os
import re
from io import BytesIO
from contextlib import closing
from typing import Tuple

import numpy
import requests
import validators
from bson import json_util
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_pymongo import PyMongo
from PIL import Image, ImageDraw, ImageFile

app = Flask(__name__)
app.config["MONGO_URI"] = os.getenv('MONGODB_URI')
CORS(app)
mongo = PyMongo(app)
ses = requests.Session()
ses.headers.update({"X-Device-Token": os.getenv('DTF_TOKEN'), "x-this-is-csrf": "THIS IS SPARTA!", 'x-retpath-y': 'xyz'})

YANDEX_REGEX = r"/album/(?P<album>\d+)(?:/track/(?P<track>\d+))?|users/(?P<user>.+)/playlists/(?P<playlist>\d+)"
YANDEX_PATTERN = re.compile(YANDEX_REGEX)

SKYNET = 'siasky.net'

def get_image_size(uri):
    with closing(requests.get(uri, stream=True, timeout=16)) as response:
        p = ImageFile.Parser()
        for data in response.iter_content(128):
            if not data:
                break
            p.feed(data)
            if p.image:
                return p.image.size[0], p.image.size[1]
        return 300, 300

def generate_qr_code(bg_size: tuple) -> BytesIO:
    background = Image.new('RGBA', bg_size, (0, 0, 0, 0))
    a = numpy.random.rand(300, 300, 4) * 255
    im_out = Image.fromarray(a.astype('uint8')).convert('RGBA')
    background.paste(im_out, (0, 0))
    if min(bg_size) >= 300:
        ImageDraw.Draw(background).text((4, 0), 'prostagma? qr-nsfw v2', (0, 0, 0))
    buffer = BytesIO()
    background.save(buffer, 'png')
    return buffer


def parse_custom_text(text: str):
    text_data, text_type = 'error', 'error'
    if validators.url(text):
        if 'soundcloud.com' in text:
            if requests.get(f'https://w.soundcloud.com/player/?url={text}').status_code == 200:
                text_data = text
                text_type = 'soundcloud'
        elif 'music.yandex.ru' in text:
            matches = YANDEX_PATTERN.search(text)
            if matches:
                match_dict = matches.groupdict()
                track, album, user, playlist = match_dict.get('track'), match_dict.get('album'), match_dict.get('user'), match_dict.get('playlist')
                if track:
                    response = ses.get('https://music.yandex.ru/api/v2.1/handlers/tracks', params=(('tracks', track),)).json()
                    if isinstance(response, list):
                        text_data, text_type = f'{album}|{track}', 'yamusic'
                elif album:
                    response = ses.head(f'https://music.yandex.ru/handlers/album.jsx?album={album}')
                    # if not response.status_code == 404:
                    text_data, text_type = f'{album}', 'yamusic'
                elif user and playlist:
                    response = ses.get(f'https://music.yandex.ru/api/v2.1/handlers/playlist/{user}/{playlist}').json()
                    if not response.get('error'):
                        text_data, text_type = f'{user}|{playlist}', 'yamusic_playlist'
        elif 'pornhub.com' in text:
            viewkey = text.split('viewkey=')[-1]
            response = ses.head(f'https://rt.pornhub.com/embed/{viewkey}')
            if response.status_code == 200:
                text_data, text_type = viewkey, 'pornhub'
        elif 'gofile.io' in text:
            response = requests.get(text).json().get('status')
            if response == 'ok':
                text_data, text_type = text, 'gofile'
        else:
            response = requests.head(text).headers.get('content-type')
            if response:
                registry = response.split('/')[0]
                if registry in ('audio', 'video'):
                    text_data = text
                    text_type = registry
                elif registry in ('image'):
                    text_data = {'text': text, 'size': get_image_size(text)}
                    text_type = registry
    return text_data, text_type


def cdn_fix(url: str) -> str:
    return ses.get('https://dtf.ru/andropov/extract', params={'url': url}).json()['result'][0]['data']['uuid']


def upload_qr(qr_code: BytesIO) -> Tuple[str, str]:
    skyportal_response = ses.post(f'https://{SKYNET}/skynet/skyfile', files={f'file': ('file.png', qr_code.getbuffer(), 'image/png')}).json()
    return cdn_fix(url := f'https://{SKYNET}/{skyportal_response["skylink"]}'), url


@app.route("/")
def home_page():
    online_users = mongo.db.users.find_one({'online': True})
    return jsonify({'result': json.loads(json_util.dumps(online_users)), 'python_version': sys.version})


@app.route('/v1/qrcodes/insert', methods=['POST'])
def qrcodes_insert():
    request_json = request.get_json(silent=True)
    if request_json:
        db_check = mongo.db.codes.find_one({'qr_uuid': request_json['qr_uuid']})
        if db_check:
            return jsonify({'result': 'QRCode already exist'})
        request_json.update({"last_modified": datetime.datetime.utcnow()})
        mongo.db.codes.insert_one(request_json)
        return jsonify({'result': 'QRCode Inserted Successfully'})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})


@app.route('/v2/qrcodes/generate', methods=['POST'])
def siasky_qr_generate():
    request_json = request.get_json(silent=True)
    if request_json and 'skylink' in request_json.get('payload', []):
        request_json = request_json['payload']
        skylink = request_json["skylink"]
        if db_check := mongo.db.codes.find_one({'skylink': skylink}):
            return jsonify({'result': db_check.get('files')})

        qrify_file_list = []
        skynet = f'https://{SKYNET}/skynet/metadata/{skylink}'
        files = ses.get(skynet).json()['subfiles']
        for file in files.values():
            qr_size = get_image_size(f'https://{SKYNET}/{skylink}/{file["filename"]}') if 'image' in file['contenttype'] else (300, 300)
            content_type, file_type  = file['contenttype'].split('/')
            qr_code = generate_qr_code(qr_size)
            uuid_for_db, url = upload_qr(qr_code)
            qrify_file_list.append({
                'filename': file['filename'],
                'content_type': content_type,
                'file_type': file_type,
                'initial_qr_uuid': url,
                'final_qr_uuid': uuid_for_db,
                'last_modified': datetime.datetime.utcnow()
            })
        mongo.db.codes.insert_one({
            'skylink': skylink,
            'files': qrify_file_list
        })
        return jsonify({'result': qrify_file_list})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})


@app.route('/v2/custom/generate', methods=['POST'])
def custom_qr_generate():
    request_json = request.get_json(silent=True)
    if request_json and 'link' in request_json.get('payload', []):
        request_json = request_json['payload']
        link = request_json["link"]
        if db_check := mongo.db.codes.find_one({'skylink': link}):
            return jsonify({'result': db_check.get('files')})

        qrify_file_list = []
        qr_data, file_type = parse_custom_text(link)
        if 'error'in (qr_data, file_type):
            return jsonify({'error': 'Your link is broken, or it is not supported'})
        if isinstance(qr_data, dict):
            bg_size = qr_data.get('size')
            qr_data = qr_data.get('text')
        else:
            bg_size = (300, 300)
        qr_code = generate_qr_code(bg_size)
        uuid_for_db, url = upload_qr(qr_code)
        qrify_file_list.append({
            'filename': qr_data,
            'content_type': 'custom',
            'file_type': file_type,
            'initial_qr_uuid': url,
            'final_qr_uuid': uuid_for_db,
            'last_modified': datetime.datetime.utcnow()
        })
        mongo.db.codes.insert_one({
            'skylink': link,
            'files': qrify_file_list
        })
        return jsonify({'result': qrify_file_list})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})

@app.route('/v2/qrcodes/decode', methods=['POST'])
def siasky_qr_decode():
    request_json = request.get_json(silent=True)
    if request_json:
        requested_ids = set(request_json.get('uuids'))
        cache = set()
        found_ids = set()
        return_data = list()
        for _ in mongo.db.codes.find({"files": {"$elemMatch": {"final_qr_uuid": {"$in": request_json.get('uuids')}}}}):
            if _['skylink'] not in cache:
                for file in _['files']:
                    if file['final_qr_uuid'] in requested_ids:
                        found_ids.add(file['final_qr_uuid'])
                        return_data.append(file | {'skylink': _['skylink']})
                if len(found_ids) == len(requested_ids):
                    break
                cache.add(_['skylink'])
        return jsonify({'success': return_data, 'not_qr': list(requested_ids.difference(found_ids))})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})


@app.route('/v1/permission', methods=['GET', 'POST'])
def permission():
    return jsonify({"rc": 200, "rm": "", "data": {"access": True}})
