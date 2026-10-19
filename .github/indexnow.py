"""Tells IndexNow search engines (Bing, Yandex, Seznam, Naver) about every page in sitemap.xml."""
import json
import pathlib
import re
import urllib.request

KEY = "47c93968dd283ee6dee613e604c3c050"
HOST = "inhasnain.com"

root = pathlib.Path(__file__).resolve().parent.parent
urls = re.findall(r"<loc>([^<]+)</loc>", (root / "sitemap.xml").read_text(encoding="utf-8"))
body = json.dumps({"host": HOST, "key": KEY, "keyLocation": f"https://{HOST}/{KEY}.txt", "urlList": urls}).encode("utf-8")
request = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, headers={
    "User-Agent": "inhasnain-IndexNow/1.0 (+https://inhasnain.com)",
    "Content-Type": "application/json; charset=utf-8",
})
with urllib.request.urlopen(request) as response:
    print(response.status, len(urls), "urls submitted")
