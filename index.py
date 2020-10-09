import json
import sys
import os
import re
from io import BytesIO
from contextlib import closing

import numpy
import qrcode
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

def generate_qr_code(bg_size, qr_data):
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
                    response = ses.get(f'https://music.yandex.ru/api/v2.1/handlers/album/{album}').json()
                    if not response.get('error'):
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
        mongo.db.codes.insert_one(request_json)
        return jsonify({'result': 'QRCode Inserted Successfully'})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})

@app.route('/v1/qrcodes/generate', methods=['POST'])
def qrcodes_generate():
    request_json = request.get_json(silent=True)
    if request_json:
        qrify_result_list = []
        for entry in request_json.get('payload', []):
            entry_type = entry.get('type', None)
            if entry_type in ('image', 'audio'):
                db_check = mongo.db.codes.find_one({'uuid': entry['data']['uuid']})
                if db_check:
                    qrify_result_list.append({
                        'uuid': entry['data']['uuid'],
                        'qr_uuid': db_check.get('qr_uuid'),
                        'qr_data': db_check.get('qr_data'),
                        'entry_data': db_check.get('entry_data')
                    })
                    continue
                bg_size = (300, 300) # if entry_type != 'image' else (entry['data']['width'], entry['data']['height'])
                file_type = entry.get('data').get('type') if entry_type == 'image' else 'mp3'
                qr_data = f"{entry['data']['uuid']}|{file_type}"
                qr_code = generate_qr_code(bg_size, qr_data)
                dtf_response = ses.post('https://api.dtf.ru/v1.9/uploader/upload', files={f'file_0': ('file.png', qr_code.getbuffer(), 'image/png')}).json()
                dtf_qr_uuid = dtf_response['result'][0]['data']['uuid']
                # fucking around new dtf CDN
                url = f'https://leonardo.osnova.io/{dtf_qr_uuid}/'
                uuid_for_db = ses.get(f'https://dtf.ru/andropov/extract/render?url={url}').json()['result'][0]['data']['uuid']
                # stop fucking
                qrify_result_list.append({
                    'uuid': entry['data']['uuid'],
                    'qr_uuid': dtf_qr_uuid,
                    'qr_data': qr_data,
                    'entry_data': {'type': entry_type, 'file_type': file_type}
                })
                db_dict = qrify_result_list[-1].copy()
                db_dict.update({'qr_uuid': uuid_for_db})
                mongo.db.codes.insert_one(db_dict)
            elif entry_type == 'custom':
                db_check = mongo.db.codes.find_one({'qr_data': entry['data']['text']})
                if db_check:
                    qrify_result_list.append({
                        'uuid': None,
                        'qr_uuid': db_check.get('qr_uuid'),
                        'qr_data': db_check.get('qr_data'),
                        'entry_data': db_check.get('entry_data')
                    })
                    continue
                bg_size = (300, 300)
                qr_data, file_type = parse_custom_text(entry.get('data').get('text'))
                if any(i == 'error' for i in (qr_data, file_type)):
                    continue
                if isinstance(qr_data, dict):
                    bg_size = qr_data.get('size')
                    qr_data = qr_data.get('text')
                qr_code = generate_qr_code(bg_size, qr_data)
                dtf_response = ses.post('https://api.dtf.ru/v1.8/uploader/upload', files={f'file_0': ('file.png', qr_code.getbuffer(), 'image/png')}).json()
                qrify_result_list.append({
                    'uuid': None,
                    'qr_uuid': dtf_response['result'][0]['data']['uuid'],
                    'qr_data': qr_data,
                    'entry_data': {'type': entry_type, 'file_type': file_type}
                })
                mongo.db.codes.insert_one(qrify_result_list[-1].copy())
        return jsonify({'result': qrify_result_list})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})


@app.route('/v1/qrcodes/decode', methods=['POST'])
def qrcodes_decode():
    request_json = request.get_json(silent=True)
    if request_json:
        found = list()
        found_uuids = set()
        for _ in mongo.db.codes.find({'qr_uuid': {'$in': request_json.get('uuids')}}):
            found.append(json.loads(json_util.dumps(_)))
            found_uuids.add(_.get('qr_uuid'))
        return jsonify({'success': found, 'not_qr': list(set(request_json.get('uuids')).difference(found_uuids))})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})

@app.route('/v1/permission', methods=['GET'])
def permission():
    return jsonify({"rc": 200, "rm": "", "data": {"access": True}})
