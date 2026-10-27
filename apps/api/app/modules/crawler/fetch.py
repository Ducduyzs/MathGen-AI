"""Tải trang cho worker: tự xưng danh, tôn trọng robots.txt + Crawl-delay, giới hạn dung lượng, tự xử lý chuyển hướng
(để mỗi bước chuyển hướng cũng qua kiểm tra phạm vi và địa chỉ công cộng)."""

import time
from dataclasses import dataclass
from urllib.robotparser import RobotFileParser

import httpx

from app.modules.crawler import policy


def make_client() -> httpx.Client:
    return httpx.Client(headers={"User-Agent": policy.USER_AGENT, "Accept-Language": "vi,en;q=0.5"}, timeout=20.0, follow_redirects=False)


# Test thay bằng client dùng httpx.MockTransport; kiểm tra địa chỉ công cộng cũng thay được
CLIENT_FACTORY = make_client
PUBLIC_HOST_CHECK = policy.is_public_host
sleep = time.sleep


class FetchError(Exception):
    pass


@dataclass
class Fetched:
    url: str  # URL cuối cùng sau chuyển hướng
    status: int
    content_type: str
    body: bytes


@dataclass
class Robots:
    parser: RobotFileParser | None  # None: không có robots.txt (cho phép tất cả)
    disallow_all: bool
    crawl_delay: float | None

    def allowed(self, url: str) -> bool:
        if self.disallow_all:
            return False
        return self.parser is None or self.parser.can_fetch(policy.BOT_TOKEN, url)


class Fetcher:
    def __init__(self, client: httpx.Client, delay: float, domain: str, include_paths: list[str]):
        self.client, self.delay, self.domain, self.include_paths = client, max(delay, policy.MIN_DELAY), domain, include_paths
        self._robots: dict[str, Robots] = {}
        self._last = 0.0

    def _wait(self, extra: float | None = None) -> None:
        gap = max(self.delay, extra or 0) - (time.monotonic() - self._last)
        if gap > 0:
            sleep(gap)
        self._last = time.monotonic()

    def robots(self, url: str) -> Robots:
        """robots.txt của origin (có cache). Theo RFC 9309: 4xx → được phép; 5xx / lỗi mạng → coi như cấm."""
        parts = httpx.URL(url)
        origin = f"{parts.scheme}://{parts.netloc.decode()}"
        if origin not in self._robots:
            try:
                self._wait()
                r = self.client.get(origin + "/robots.txt")
            except httpx.HTTPError:
                self._robots[origin] = Robots(None, True, None)
                return self._robots[origin]
            if r.status_code >= 500:
                self._robots[origin] = Robots(None, True, None)
            elif r.status_code >= 400:
                self._robots[origin] = Robots(None, False, None)
            else:
                rp = RobotFileParser()
                rp.parse(r.text.splitlines())
                delay = rp.crawl_delay(policy.BOT_TOKEN)
                self._robots[origin] = Robots(rp, False, float(delay) if delay else None)
        return self._robots[origin]

    def allowed(self, url: str) -> bool:
        return self.robots(url).allowed(url)

    def get(self, url: str) -> Fetched:
        for _ in range(policy.MAX_REDIRECTS + 1):
            host = policy.host_of(url)
            if not policy.in_scope(url, self.domain, self.include_paths):
                raise FetchError("Chuyển hướng ra ngoài phạm vi đã khai báo")
            if not PUBLIC_HOST_CHECK(host):
                raise FetchError("Địa chỉ không phải địa chỉ công cộng")
            robots = self.robots(url)
            if not robots.allowed(url):
                raise FetchError("robots.txt không cho phép")
            self._wait(robots.crawl_delay)
            try:
                with self.client.stream("GET", url) as r:
                    if r.is_redirect:
                        nxt = policy.normalize(r.headers.get("location", ""), url)
                        if not nxt:
                            raise FetchError("Chuyển hướng không hợp lệ")
                        url = nxt
                        continue
                    declared = int(r.headers.get("content-length") or 0)
                    if declared > policy.MAX_BYTES:
                        raise FetchError("Tài liệu quá lớn")
                    body = bytearray()
                    for chunk in r.iter_bytes():
                        body += chunk
                        if len(body) > policy.MAX_BYTES:
                            raise FetchError("Tài liệu quá lớn")
                    return Fetched(url, r.status_code, r.headers.get("content-type", "").split(";")[0].strip().lower(), bytes(body))
            except httpx.HTTPError as e:
                raise FetchError(f"Lỗi mạng: {e.__class__.__name__}") from e
        raise FetchError("Chuyển hướng quá nhiều lần")
