from flask import Flask, Response, request, __version__
import requests
app = Flask(__name__)

@app.route('/<path:path>')
def catch_all(path):
    r = requests.get(path + f"?e={request.args.get('e')}&m={request.args.get('m')}")
    def generate():
        for chunk in r.iter_content(chunk_size=128):
            yield chunk
    return Response(generate(), mimetype='image/jpeg')