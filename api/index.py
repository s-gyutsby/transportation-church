"""
Vercel Serverless Function entry point for 국군수송중앙교회
"""
import sys
import os

# Ensure the root project directory is on sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app import app

class VercelPathMiddleware:
    """
    Vercel rewrites (/(.*) -> /api/index/$1) send all traffic to this function.
    This middleware strips the '/api/index' prefix and restores the original path,
    so Flask routes ('/', '/api/pastors', '/static/...') match perfectly.
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path = environ.get('PATH_INFO', '')
        if path.startswith('/api/index'):
            subpath = path[10:]
            environ['PATH_INFO'] = subpath if subpath.startswith('/') else '/' + subpath
        return self.wsgi_app(environ, start_response)

app.wsgi_app = VercelPathMiddleware(app.wsgi_app)
