from flask import Flask, Response, __version__
app = Flask(__name__, static_url_path='/static')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    return app.send_static_file('index.html')