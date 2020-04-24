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
app.config["MONGO_URI"] = os.getenv('MONGODB_URI')
mongo = PyMongo(app)
ses = requests.Session()
ses.headers.update({"X-Device-Token": os.getenv('DTF_TOKEN'), "x-this-is-csrf": "THIS IS SPARTA!"})


@app.route("/")
def home_page():
    online_users = mongo.db.users.find_one({'online': True})
    return jsonify({'result': json.loads(json_util.dumps(online_users))})


@app.route('/v1/qrcodes/insert', methods=['POST'])
def qrcodes_insert():
    r_json = request.get_json(silent=True)
    if r_json:
        qr_uuids = []
        for upload_dict in r_json.get('result', []):
            r_json_type = upload_dict.get('type', None)
            if r_json_type in ('image', 'audio'):
                if r_json_type == 'image':
                    background = Image.new('RGBA', (upload_dict['data']['width'], upload_dict['data']['height']), (0, 0, 0, 0))
                    qr = qrcode.QRCode(
                        error_correction=qrcode.constants.ERROR_CORRECT_L,
                        box_size=8,
                        border=2,
                    )
                    qr.add_data(upload_dict['data']['uuid'])
                    qr.make(fit=True)
                    qr_img = qr.make_image(fill_color="black", back_color="white")
                    background.paste(qr_img, (0, 0))
                    ImageDraw.Draw(background).text((0, 0), 'prostagma? qr-nsfw v2', (0, 0, 0))
                    buffer = BytesIO()
                    background.save(buffer, 'png')
                    qr_uuids.append(ses.post('https://api.dtf.ru/v1.8/uploader/upload', files={f'file_0': ('file.png', buffer.getbuffer(), 'image/png')}).json())
        return jsonify({'result': qr_uuids})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})


@app.route('/v1/qrcodes/decode', methods=['POST'])
def qrcodes_decode():
    r_json = request.get_json(silent=True)
    if r_json:
        found_uuids = []
        for _ in mongo.db.codes.find({'qr_uuid': {'$in': r_json.get('uuids')}}):
            found_uuids.append(_.get('image_uuid'))
        return jsonify({'success': found_uuids})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})
