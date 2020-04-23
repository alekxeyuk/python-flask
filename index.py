import os
from flask import Flask
from flask import jsonify
from flask_pymongo import PyMongo

app = Flask(__name__)
app.config["MONGO_URI"] = os.getenv('MONGODB_URI')
mongo = PyMongo(app)

@app.route("/")
def home_page():
    online_users = mongo.db.qrcodes.users.find({"online": True})
    return jsonify({'result': online_users})

# app = Flask(__name__, static_url_path='/static')

# @app.route('/', defaults={'path': ''})
# @app.route('/<path:path>')
# def catch_all(path):
#     # return app.send_static_file('index.html')
#     return jsonify({'result': os.getenv('MONGODB_URI')})