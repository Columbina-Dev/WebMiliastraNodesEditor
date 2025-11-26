"""
Input TS (relative):  web/src/data/nodeDefinitions.ts
Output CSV (relative): scripts/nodes.csv

AI生成
可将 `web/src/data/nodeDefinitions.ts` 中的所有节点定义转换为CSV文件，格式为：
id,displayName
以便在 `web/src/data/nodeDefinitions.server.ts` 和 `web/src/data/nodeDefinitions.client.ts` 中书写支持的节点的列表
"""
from pathlib import Path
import re
import csv
import sys

# === Hard-coded paths (edit here if you want different files) ===
INPUT_PATH = Path("web") / "src" / "data" / "nodeDefinitions.ts"
OUTPUT_PATH = Path("scripts") / "nodes.csv"
# =================================================================

def find_array_content(text, marker_regex=r'nodeDefinitions\s*:\s*NodeDefinition\[\]\s*=\s*\['):
    m = re.search(marker_regex, text)
    if not m:
        m2 = re.search(r'export\s+const\s+nodeDefinitions\s*[:=]', text)
        if not m2:
            raise ValueError("Couldn't locate nodeDefinitions declaration in the file.")
        start_idx = text.find('[', m2.end())
    else:
        start_idx = text.find('[', m.end() - 1)
    if start_idx == -1:
        raise ValueError("Couldn't find opening '[' for the nodeDefinitions array.")
    i = start_idx
    depth = 0
    while i < len(text):
        ch = text[i]
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0:
                end_idx = i
                return text[start_idx+1:end_idx]
        i += 1
    raise ValueError("Couldn't find matching closing ']' for nodeDefinitions array.")

def split_top_level_objects(array_text):
    objs = []
    i = 0
    n = len(array_text)
    brace = 0
    start = None
    in_string = False
    string_char = None
    escape = False

    while i < n:
        ch = array_text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == string_char:
                in_string = False
                string_char = None
        else:
            if ch in ('"', "'", "`"):
                in_string = True
                string_char = ch
            elif ch == '{':
                if brace == 0:
                    start = i
                brace += 1
            elif ch == '}':
                if brace > 0:
                    brace -= 1
                    if brace == 0 and start is not None:
                        objs.append(array_text[start:i+1])
                        start = None
        i += 1
    return objs

def unescape_js_string(s: str) -> str:
    """
    Only unescape if JS/TS-style escapes are present (e.g. \\uXXXX, \\xNN, \\n, etc.)
    Otherwise return s unchanged (keeps real Unicode intact).
    """
    if s is None:
        return s
    # quick check whether there are escape sequences
    if '\\u' not in s and '\\x' not in s and '\\n' not in s and '\\t' not in s and '\\\\' not in s:
        return s

    # Convert \uXXXX -> actual char
    def repl_u(m):
        try:
            return chr(int(m.group(1), 16))
        except Exception:
            return m.group(0)
    s = re.sub(r'\\u([0-9A-Fa-f]{4})', repl_u, s)

    # Convert \xNN -> actual char
    def repl_x(m):
        try:
            return chr(int(m.group(1), 16))
        except Exception:
            return m.group(0)
    s = re.sub(r'\\x([0-9A-Fa-f]{2})', repl_x, s)

    # Common escapes
    s = s.replace('\\r', '\r').replace('\\n', '\n').replace('\\t', '\t')
    s = s.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')
    return s

def extract_id_display(block):
    """
    Extract id and displayName from a single object block.
    Uses a named 'quote' group and allows escaped characters inside the quoted string.
    Returns (id, displayName) or (None, None).
    """
    # id: "..." or id: '...' or id: `...`
    id_re = re.search(
        r'\bid\s*:\s*(?P<quote>["\'`])(?P<id>(?:\\.|.)*?)(?P=quote)',
        block,
        flags=re.DOTALL | re.IGNORECASE
    )
    # displayName: "..." or displayName: '...' or displayName: `...`
    name_re = re.search(
        r'\bdisplayName\s*:\s*(?P<quote>["\'`])(?P<name>(?:\\.|.)*?)(?P=quote)',
        block,
        flags=re.DOTALL | re.IGNORECASE
    )

    id_val = id_re.group('id').strip() if id_re else None
    name_val = name_re.group('name').strip() if name_re else None

    # Unescape JS escapes only if present; otherwise leave as-is (keeps proper Unicode)
    if id_val is not None:
        id_val = unescape_js_string(id_val)
        id_val = re.sub(r'\s+', ' ', id_val).strip()
    if name_val is not None:
        name_val = unescape_js_string(name_val)
        name_val = re.sub(r'\s+', ' ', name_val).strip()

    return id_val, name_val

def main():
    if not INPUT_PATH.exists():
        print(f"ERROR: input file not found: {INPUT_PATH}", file=sys.stderr)
        return 1

    try:
        txt = INPUT_PATH.read_text(encoding='utf-8')
    except Exception as e:
        print(f"ERROR reading {INPUT_PATH}: {e}", file=sys.stderr)
        return 1

    try:
        array_text = find_array_content(txt)
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    objects = split_top_level_objects(array_text)

    rows = []
    for obj in objects:
        id_val, name_val = extract_id_display(obj)
        if id_val and name_val:
            rows.append((id_val, name_val))
        # skip objects with missing fields silently

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    try:
        # Use 'utf-8-sig' so Excel on Windows recognizes UTF-8; text editors still handle it fine.
        with OUTPUT_PATH.open('w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            for r in rows:
                writer.writerow(r)
    except Exception as e:
        print(f"ERROR writing {OUTPUT_PATH}: {e}", file=sys.stderr)
        return 1

    print(f"Wrote {len(rows)} rows to {OUTPUT_PATH} (encoding: utf-8-sig)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
