import os
import json
from flask import Flask
from flask import request
from flask import jsonify
from flask_pymongo import PyMongo
from bson import json_util

app = Flask(__name__)
app.config["MONGO_URI"] = os.getenv('MONGODB_URI')
mongo = PyMongo(app)


@app.route("/")
def home_page():
    online_users = mongo.db.users.find_one({'online': True})
    return jsonify({'result': json.loads(json_util.dumps(online_users))})


@app.route('/v1/qrcodes/insert', methods=['POST'])
def qrcodes_insert():
    r_json = request.get_json(silent=True)
    if r_json:
        # r_json.
        return jsonify({'success': 'Your ids'})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})


@app.route('/v1/qrcodes/decode', methods=['POST'])
def qrcodes_decode():
    r_json = request.get_json(silent=True)
    if r_json:
        found_uuids = []
        for _ in mongo.db.codes.find({'qr_uuid': {'$in': [uuid for uuid in r_json.get('uuids')]}}):
            found_uuids.append(_.get('image_uuid'))
        return jsonify({'success': found_uuids})
    return jsonify({'error': 'Your json is broken, or you forgot Content-Type header'})