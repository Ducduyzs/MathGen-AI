"""Trích văn bản và liên kết từ HTML bằng thư viện chuẩn: bỏ script/style/menu/chân trang, giữ xuống dòng theo khối,
chỉ số trên <sup>2</sup> → ^2 để pipeline đọc được biểu thức."""

from dataclasses import dataclass, field
from html.parser import HTMLParser

SKIP = {"script", "style", "noscript", "nav", "header", "footer", "aside", "form", "svg", "iframe", "button", "select"}
BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "table", "ul", "ol", "blockquote", "pre"}
VOID = {"br", "img", "hr", "input", "meta", "link", "source", "area", "base", "col", "embed", "wbr"}


@dataclass
class Page:
    title: str = ""
    text: str = ""
    links: list[str] = field(default_factory=list)
    noindex: bool = False


class _Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.page = Page()
        self.out: list[str] = []
        self.skip = 0
        self.in_title = False
        self.title: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta" and (a.get("name") or "").lower() in ("robots", "mathgenbot") and "noindex" in (a.get("content") or "").lower():
            self.page.noindex = True
        if tag in SKIP and tag not in VOID:
            self.skip += 1
            return
        if tag == "title":
            self.in_title = True
        if tag == "a" and a.get("href"):
            self.page.links.append(a["href"])
        if tag in BLOCK:
            self.out.append("\n")
        if tag == "sup" and not self.skip:
            self.out.append("^")
        if tag == "img" and a.get("alt") and not self.skip:  # công thức dạng ảnh thường có alt là LaTeX
            self.out.append(f" {a['alt']} ")

    def handle_endtag(self, tag):
        if tag in SKIP and tag not in VOID:
            self.skip = max(0, self.skip - 1)
            return
        if tag == "title":
            self.in_title = False
        if tag in BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        elif not self.skip:
            self.out.append(data)


def parse(html: str) -> Page:
    p = _Parser()
    p.feed(html)
    p.close()
    lines = [" ".join(line.split()) for line in "".join(p.out).splitlines()]
    page = p.page
    page.title = " ".join("".join(p.title).split())[:200]
    page.text = "\n".join(line for line in lines if line)
    return page
