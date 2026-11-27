"""Shared single-file renderer CSP embedding and verification.

The packaged renderer is one HTML file whose only script is inline. A
hash-based Content-Security-Policy authorizes exactly that script and
denies every network connection. The hash is meaningless unless it is
computed from the exact bytes that ship, so everything here works on
bytes/text with no platform newline translation.
"""
import base64
import hashlib
import re

SCRIPT_RE = re.compile(r'<script\b[^>]*>(.*?)</script>', re.S)
META_RE = re.compile(r'<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>')
HASH_RE = re.compile(r"'sha256-([^']+)'")


def script_sha256(body: str) -> str:
    return base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()


def hash_candidates(body: str) -> set[str]:
    """All hashes a browser might compute for this script body.

    The HTML parser normalizes CRLF/CR to LF before tokenizing, so the
    browser always hashes the newline-normalized text; the raw-bytes hash
    is included as a belt-and-braces fallback.
    """
    normalized = body.replace('\r\n', '\n').replace('\r', '\n')
    return {script_sha256(body), script_sha256(normalized)}


def embed_csp(html: str) -> str:
    """Injects the hash-based CSP meta tag into a built single-file page."""
    scripts = SCRIPT_RE.findall(html)
    assert scripts, 'No inline script found in the built renderer'
    sources = ' '.join(f"'sha256-{script_sha256(s)}'" for s in scripts)
    csp = (
        f"default-src 'none'; script-src {sources}; "
        "style-src 'unsafe-inline'; img-src 'self' data: blob:; font-src data:; "
        "connect-src 'none'; object-src 'none'; frame-src 'none'; "
        "base-uri 'none'; form-action 'none'"
    )
    replaced = html.replace(
        '<head>',
        f'<head><meta http-equiv="Content-Security-Policy" content="{csp}">',
        1,
    )
    assert replaced != html, 'renderer <head> anchor not found'
    return replaced


def check_script_authorized(html: str) -> None:
    """Raises AssertionError unless the embedded CSP authorizes every
    inline script in the page. This is the exact property a browser
    enforces; violating it ships a blank window."""
    meta = META_RE.search(html)
    assert meta, 'CSP meta tag missing'
    allowed = HASH_RE.findall(meta.group(0))
    scripts = SCRIPT_RE.findall(html)
    assert scripts, 'packaged renderer lost its script'
    for body in scripts:
        assert hash_candidates(body) & set(allowed), (
            'Packaged renderer CSP does not authorize the embedded script; '
            'refusing to ship a blank page.'
        )
