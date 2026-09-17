from pathlib import Path
import re

root = Path(r"C:\Users\novin\Desktop\zibaban\app\api")


def fix_auth_import(m, prefix):
    names = [n.strip() for n in m.group(1).split(",") if n.strip()]
    has_req = "requireUser" in names
    others = [n for n in names if n != "requireUser"]
    out = []
    if others:
        out.append(f'import {{ {", ".join(others)} }} from "{m.group(2)}lib/auth.js";')
    if has_req:
        out.append(f'import {{ requireUser }} from "{prefix}lib/http.js";')
    return "\n".join(out)


for path in root.rglob("route.js"):
    text = path.read_text(encoding="utf-8")
    original = text
    rel = path.relative_to(root)
    depth = len(rel.parts) - 1
    prefix = "../" * (depth + 1)

    text = re.sub(
        r'from "(?:\.\./)+lib/http\.js"',
        f'from "{prefix}lib/http.js"',
        text,
    )

    if "requireUser" in text and "lib/http.js" not in text:
        text = re.sub(
            r'import \{([^}]*)\} from "((?:\.\./)+)lib/auth\.js";',
            lambda m: fix_auth_import(m, prefix),
            text,
        )

    if "requireUser(" in text and "lib/http.js" not in text:
        lines = text.splitlines()
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith("import "):
                insert_at = i + 1
            elif insert_at:
                break
        lines.insert(insert_at, f'import {{ requireUser }} from "{prefix}lib/http.js";')
        text = "\n".join(lines)
        if original.endswith("\n"):
            text += "\n"

    if text != original:
        path.write_text(text, encoding="utf-8")
        print("fixed", rel)
