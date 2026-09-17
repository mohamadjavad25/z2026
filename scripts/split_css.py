from pathlib import Path

styles_path = Path(__file__).resolve().parents[1] / "app" / "styles.css"
styles = styles_path.read_text(encoding="utf-8")
start = styles.index(":root")
end = styles.index("}", start) + 1
tokens = styles[start:end]
rest = styles[end:].lstrip("\n")
styles_dir = Path(__file__).resolve().parents[1] / "app" / "styles"
styles_dir.mkdir(exist_ok=True)
(styles_dir / "tokens.css").write_text(tokens + "\n", encoding="utf-8")
feat_dir = styles_dir / "features"
feat_dir.mkdir(exist_ok=True)
for name in ["shell", "explore", "shops", "artist", "salon", "auth", "wallet", "ai"]:
    p = feat_dir / f"{name}.css"
    if not p.exists():
        p.write_text(f"/* {name} feature styles — incremental split placeholder */\n", encoding="utf-8")
imports = '@import "./styles/tokens.css";\n'
for name in ["shell", "explore", "shops", "artist", "salon", "auth", "wallet", "ai"]:
    imports += f'@import "./styles/features/{name}.css";\n'
imports += "\n"
styles_path.write_text(imports + rest, encoding="utf-8")
print("css split ok")
