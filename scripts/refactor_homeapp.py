from pathlib import Path

path = Path(__file__).resolve().parents[1] / "app" / "features" / "shell" / "HomeApp.jsx"
text = path.read_text(encoding="utf-8")
marker = "export default function Home()"
idx = text.index(marker)

header_path = Path(__file__).resolve().parent / "homeapp_header.jsx"
header = header_path.read_text(encoding="utf-8")
body = text[idx:].replace("export default function Home()", "export function HomeApp()", 1)
path.write_text(header + body, encoding="utf-8")
print("HomeApp refactored:", len(header), "+", len(body))
