from flask import Flask, Response, request, __version__
import requests
app = Flask(__name__, static_url_path='/static')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    return app.send_static_file('/index.html')

@app.route('/image/<path:path>')
def image(path):
    r = requests.get(path + f"?e={request.args.get('e')}&m={request.args.get('m')}")
    def generate():
        for chunk in r.iter_content(chunk_size=128):
            yield chunk
    return Response(generate(), mimetype='image/jpeg')