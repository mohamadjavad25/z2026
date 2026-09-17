from pathlib import Path
import re

root = Path(r"C:\Users\novin\Desktop\zibaban\app\api")

for path in root.rglob("route.js"):
    text = path.read_text(encoding="utf-8")
    original = text
    rel = path.relative_to(root)
    depth = len(rel.parts) - 1  # files under app/api
    prefix = "../" * (depth + 1)

    def repl_lib(m):
        return f'from "{prefix}lib/{m.group(1)}"'

    text = re.sub(r'from "(?:\.\./)+lib/([^"]+)"', repl_lib, text)
    if text != original:
        path.write_text(text, encoding="utf-8")
        print("fixed", rel.as_posix())
