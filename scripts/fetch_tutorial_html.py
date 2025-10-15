"""
从米哈游OS官方获取教程的html文件
需读取`web/public/tutorial/catalog`中`course.json`和`knowledge.json`中的path_id的值
需在此仓库的根目录运行 `python scripts/fetch_tutorial_html.py`
"""

from __future__ import annotations

import json
import random
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, List
import requests
from requests.exceptions import RequestException

BASE_URL = "https://act-webstatic.hoyoverse.com/ugc-tutorial"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0" # 网上随便抄的ua，按需调整
DELAY_RANGE = (0.15, 0.25)  # 完成获取每个html后随机等待时间，按需调整 | 单位：秒


@dataclass
class CatalogEntry:
  kind: str
  path_id: str
  real_id: str | None


def repo_root() -> Path:
  return Path(__file__).resolve().parents[1]


def load_catalog_entries(kind: str, catalog_path: Path) -> Iterator[CatalogEntry]:
  try:
    raw = json.loads(catalog_path.read_text(encoding="utf-8"))
  except FileNotFoundError:
    print(f"[WARN] 未找到目录文件: {catalog_path}", file=sys.stderr)
    return

  def walk(nodes: Iterable[dict]) -> Iterator[CatalogEntry]:
    for node in nodes:
      path_id = node.get("path_id") or node.get("real_id")
      real_id = node.get("real_id")
      if path_id:
        yield CatalogEntry(kind=kind, path_id=path_id, real_id=real_id)
      for child in node.get("children") or []:
        yield from walk([child])

  yield from walk(raw)


def build_url(entry: CatalogEntry) -> str:
  return f"{BASE_URL}/{entry.kind}/sea/zh-cn/{entry.path_id}/content.html"


def destination_path(entry: CatalogEntry) -> Path:
  return (
      repo_root()
      / "web"
      / "public"
      / "tutorial"
      / "content"
      / entry.kind
      / f"{entry.path_id}.html"
  )


def fetch_html(url: str) -> str:
  headers = {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml",
  }
  response = requests.get(url, headers=headers, timeout=20, verify=True)
  response.raise_for_status()
  return response.text


def delay() -> None:
  time.sleep(random.uniform(*DELAY_RANGE))


def ensure_directory(path: Path) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)


def process_entry(entry: CatalogEntry) -> None:
  url = build_url(entry)
  dest = destination_path(entry)
  try:
    html = fetch_html(url)
  except requests.HTTPError as exc:
    print(f"[ERROR] {url} 出现 HTTP {exc.response.status_code} 错误", file=sys.stderr)
    return
  except RequestException as exc:
    print(f"[ERROR] 访问 {url} 时出现网络错误: {str(exc)}", file=sys.stderr)
    return

  ensure_directory(dest)
  dest.write_text(html, encoding="utf-8")
  print(f"[OK] {entry.kind}/{entry.path_id} -> {dest.relative_to(repo_root())}")
  delay()


def main() -> None:
  root = repo_root()
  catalogs: List[tuple[str, Path]] = [
      ("knowledge", root / "web" / "public" / "tutorial" / "catalog" / "knowledge.json"),
      ("course", root / "web" / "public" / "tutorial" / "catalog" / "course.json"),
  ]

  entries = list(
      entry for kind, path in catalogs for entry in load_catalog_entries(kind, path)
  )

  if not entries:
    print("[WARN] 未找到目录条目。没有要获取的内容。", file=sys.stderr)
    return

  print(f"[INFO] 共需获取 {len(entries)} 个教程html文件")
  for entry in entries:
    process_entry(entry)

  print("[INFO] 运行完毕")


if __name__ == "__main__":
  main()
