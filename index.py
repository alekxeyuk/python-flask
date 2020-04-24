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
        r_json_type = r_json.get('type', None)
        if r_json_type in ('image', 'audio'):
            if r_json_type == 'image':
                img = Image.new('RGBA', (r_json['data']['width'], r_json['data']['height']), (0, 0, 0, 0))
                qr = qrcode.QRCode(
                    error_correction=qrcode.constants.ERROR_CORRECT_L,
                    box_size=8,
                    border=2,
                )
                qr.add_data(r_json['data']['uuid'])
                qr.make(fit=True)
                qr_img = qr.make_image(fill_color="black", back_color="white")
                buffer = BytesIO()
                qr_img.save(buffer)
                with Image.open(buffer) as buffer_qr_img:
                    img.paste(buffer_qr_img, (0, 0))
                    ImageDraw.Draw(img).text((0, 0), 'prostagma? qr-nsfw v2', (0, 0, 0))
                buffer.flush()
                img.save(buffer)
                return ses.post('https://api.dtf.ru/v1.8/uploader/upload', files={f'file_0': buffer}).json()
        else:
            return jsonify({'error': 'Wrong upload type'})
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
