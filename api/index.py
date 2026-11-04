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
    Vercel rewrites (/(.*) -> /api/index) send all traffic to this function.
    This middleware restores the original requested path from Vercel's x-matched-path header,
    ensuring Flask routes ('/', '/api/pastors', '/static/...') match perfectly.
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        matched_path = environ.get('HTTP_X_MATCHED_PATH')
        if matched_path:
            if '?' in matched_path:
                path, qs = matched_path.split('?', 1)
                environ['PATH_INFO'] = path
                if not environ.get('QUERY_STRING'):
                    environ['QUERY_STRING'] = qs
            else:
                environ['PATH_INFO'] = matched_path
        elif environ.get('PATH_INFO', '').startswith('/api/index'):
            subpath = environ['PATH_INFO'][10:]
            environ['PATH_INFO'] = subpath if subpath.startswith('/') else '/' + subpath

        return self.wsgi_app(environ, start_response)

app.wsgi_app = VercelPathMiddleware(app.wsgi_app)
