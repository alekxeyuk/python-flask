import json
import os
from io import BytesIO

import qrcode
import requests
from bson import json_util
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_pymongo import PyMongo
from PIL import Image, ImageDraw

app = Flask(__name__)
app.config["MONGO_URI"] = os.getenv('MONGODB_URI')[1:-1] if os.path.isfile('now.json') else os.getenv('MONGODB_URI')
CORS(app)
mongo = PyMongo(app)
ses = requests.Session()
ses.headers.update({"X-Device-Token": os.getenv('DTF_TOKEN'), "x-this-is-csrf": "THIS IS SPARTA!"})


def generate_qr_code(bg_size, qr_data):
    background = Image.new('RGBA', bg_size, (0, 0, 0, 0))
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=3 if min(bg_size) < 300 else 6,
        border=2,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    background.paste(qr_img, (0, 0))
    if qr.box_size != 3:
        ImageDraw.Draw(background).text((4, 0), 'prostagma? qr-nsfw v2', (0, 0, 0))
    buffer = BytesIO()
    background.save(buffer, 'png')
    return buffer


def parse_custom_text(text: str):
    text_data, text_type = '', ''
    if 'soundcloud.com' in text:
        text_data = text
        text_type = 'soundcloud'
    else:
        text_data, text_type = 'error', 'error'
    return text_data, text_type


@app.route("/")
def home_page():
    online_users = mongo.db.users.find_one({'online': True})
    return jsonify({'result': json.loads(json_util.dumps(online_users))})


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
                bg_size = (300, 300) if entry_type != 'image' else (entry['data']['width'], entry['data']['height'])
                file_type = entry.get('data').get('type') if entry_type == 'image' else 'mp3'
                qr_data = f"{entry['data']['uuid']}|{file_type}"
                qr_code = generate_qr_code(bg_size, qr_data)
                dtf_response = ses.post('https://api.dtf.ru/v1.8/uploader/upload', files={f'file_0': ('file.png', qr_code.getbuffer(), 'image/png')}).json()
                qrify_result_list.append({
                    'uuid': entry['data']['uuid'],
                    'qr_uuid': dtf_response['result'][0]['data']['uuid'],
                    'qr_data': qr_data,
                    'entry_data': {'type': entry_type, 'file_type': file_type}
                })
                mongo.db.codes.insert_one(qrify_result_list[-1].copy())
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
