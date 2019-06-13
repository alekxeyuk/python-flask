from flask import Flask, Response, request, __version__
import requests
app = Flask(__name__)

@app.route('/<path:path>')
def catch_all(path):
    print(requests.get("https://capi-v2.sankakucomplex.com/posts").content)
    return Response(requests.get("https://capi-v2.sankakucomplex.com/posts").content, mimetype='application/json')
    # print(request.args)
    # r = requests.get(path[6:])
    # def generate():
    #     for chunk in r.iter_content(chunk_size=128):
    #         yield chunk
    # return Response(r.content, mimetype='image/jpeg')