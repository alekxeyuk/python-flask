from flask import Flask, Response, request, __version__
import requests
app = Flask(__name__)
proxies = {
    'http': 'http://188.217.121.242:8118',
    'https': 'https://188.217.121.242:8118'
}
@app.route('/<path:path>')
def catch_all(path):
    print(requests.get("https://capi-v2.sankakucomplex.com/posts", proxies=proxies).content)
    return Response(requests.get("https://capi-v2.sankakucomplex.com/posts", proxies=proxies).content, mimetype='application/json')
    # print(request.args)
    # r = requests.get(path[6:])
    # def generate():
    #     for chunk in r.iter_content(chunk_size=128):
    #         yield chunk
    # return Response(r.content, mimetype='image/jpeg')