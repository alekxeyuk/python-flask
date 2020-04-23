import os
from flask import Flask, Response, __version__
from flask import jsonify
from flask_pymongo import PyMongo

app = Flask(__name__, static_url_path='/static')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    # return app.send_static_file('index.html')
    return jsonify({'result': os.getenv('MONGODB_URI')})