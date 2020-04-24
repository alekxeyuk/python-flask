import json
import os
from io import BytesIO

import qrcode
import requests
from bson import json_util
from flask import Flask, jsonify, request
from flask_pymongo import PyMongo
from PIL import Image, ImageDraw

app = Flask(__name__)
app.config["MONGO_URI"] = os.getenv('MONGODB_URI')[1:-1]
mongo = PyMongo(app)
ses = requests.Session()
ses.headers.update({"X-Device-Token": os.getenv('DTF_TOKEN'), "x-this-is-csrf": "THIS IS SPARTA!"})


@app.route("/")
def home_page():
    online_users = mongo.db.users.find_one({'online': True})
    return jsonify({'result': json.loads(json_util.dumps(online_users))})


@app.route('/v1/qrcodes/insert', methods=['POST'])
def qrcodes_insert():
    request_json = request.get_json(silent=True)
    if request_json:
        qrify_result_list = []
        for entry in request_json.get('payload', []):
            entry_type = entry.get('type', None)
            if entry_type in ('image', 'audio', 'custom'):
                db_check = mongo.db.codes.find_one({'uuid': entry['data']['uuid']})
                if db_check:
                    qrify_result_list.append({
                        'uuid': entry['data']['uuid'],
                        'qr_uuid': db_check.get('qr_uuid'),
                        'qr_data': db_check.get('qr_data')
                    })
                    continue
                if entry_type == 'image':
                    background = Image.new('RGBA', (entry['data']['width'], entry['data']['height']), (0, 0, 0, 0))
                    qr = qrcode.QRCode(
                        error_correction=qrcode.constants.ERROR_CORRECT_L,
                        box_size=8,
                        border=2,
                    )
                    qr.add_data(entry['data']['uuid'])
                    qr.make(fit=True)
                    qr_img = qr.make_image(fill_color="black", back_color="white")
                    background.paste(qr_img, (0, 0))
                    ImageDraw.Draw(background).text((4, 0), 'prostagma? qr-nsfw v2', (0, 0, 0))
                    buffer = BytesIO()
                    background.save(buffer, 'png')
                    qrify_result_list.append(ses.post('https://api.dtf.ru/v1.8/uploader/upload', files={f'file_0': ('file.png', buffer.getbuffer(), 'image/png')}).json())
                    mongo.db.codes.insert_one({
                        'uuid': entry['data']['uuid'],
                        'qr_uuid': qrify_result_list[-1]['result'][0]['data']['uuid'],
                        'qr_data': {'type': entry_type, 'file_type': entry.get('data').get('type')}
                    })
        return jsonify({'result': qrify_result_list})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})


@app.route('/v1/qrcodes/decode', methods=['POST'])
def qrcodes_decode():
    request_json = request.get_json(silent=True)
    if request_json:
        found_uuids = []
        for _ in mongo.db.codes.find({'qr_uuid': {'$in': request_json.get('uuids')}}):
            found_uuids.append(json.loads(json_util.dumps(_)))
        return jsonify({'success': found_uuids})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})
