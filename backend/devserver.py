"""
Local development server with a fixed pool of worker threads.

`manage.py runserver` starts a brand-new thread for every request, and Django
keeps database connections per thread, so each request opened a fresh TLS
connection to the remote (Neon) database — roughly two seconds of overhead on
every API call. Serving from a reused thread pool lets CONN_MAX_AGE keep those
connections alive between requests.

Usage:  python devserver.py [port]          (default port 8000)
Production still runs gunicorn (see Dockerfile); this is for local work only.
"""
import os
import socket
import sys
from concurrent.futures import ThreadPoolExecutor
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIRequestHandler, WSGIServer, make_server

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from django.conf import settings  # noqa: E402
from django.contrib.staticfiles.handlers import StaticFilesHandler  # noqa: E402
from django.core.wsgi import get_wsgi_application  # noqa: E402


class PooledWSGIServer(ThreadingMixIn, WSGIServer):
    """Hands each connection to a long-lived worker thread instead of a new one."""

    daemon_threads = True
    pool = ThreadPoolExecutor(max_workers=int(os.getenv("DEV_SERVER_THREADS", "12")))
    # Listen on IPv6 and IPv4 so "localhost" (which resolves to ::1 first on
    # Windows) does not stall for seconds before falling back to 127.0.0.1.
    address_family = socket.AF_INET6

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()

    def process_request(self, request, client_address):
        self.pool.submit(self.process_request_thread, request, client_address)


class QuietHandler(WSGIRequestHandler):
    def log_message(self, format, *args):  # noqa: A002 - signature fixed by base class
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), format % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    app = get_wsgi_application()
    if settings.DEBUG:
        app = StaticFilesHandler(app)
    with make_server("::", port, app, server_class=PooledWSGIServer, handler_class=QuietHandler) as httpd:
        print(f"ArogyaTrack dev server on http://localhost:{port}/ (pooled threads)", flush=True)
        httpd.serve_forever()


if __name__ == "__main__":
    main()
