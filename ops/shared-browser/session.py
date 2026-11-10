#!/usr/bin/env python3
"""Run one private, visible browser session for noVNC and local CDP access."""
import json
import os
from pathlib import Path
import secrets
import signal
import socket
import subprocess
import time
import urllib.request

DATA = Path('/var/lib/rumah-shared-browser')
RUNTIME = Path('/run/rumah-shared-browser')
INSTALL = Path('/opt/rumah-shared-browser')
DISPLAY = ':99'
children = []
stopping = False


def stop(_signum, _frame):
    global stopping
    stopping = True


def start(name, args, env):
    # Browser output may contain URLs and session identifiers. Never log it.
    process = subprocess.Popen(args, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    children.append((name, process))
    return process


def wait_for(check, stage, timeout=45):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline and not stopping:
        for name, process in children:
            if process.poll() is not None:
                raise RuntimeError(f'{name} exited before {stage}')
        try:
            if check():
                return
        except (OSError, ValueError):
            pass
        time.sleep(0.2)
    raise RuntimeError(f'{stage} not ready')


def tcp_ready(port):
    with socket.create_connection(('127.0.0.1', port), timeout=1):
        return True


def cdp_ready():
    with urllib.request.urlopen('http://127.0.0.1:9222/json/version', timeout=2) as response:
        return 'Browser' in json.load(response)


def notify_ready():
    address = os.environ.get('NOTIFY_SOCKET')
    if address:
        if address.startswith('@'):
            address = '\0' + address[1:]
        with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as client:
            client.sendto(b'READY=1\nSTATUS=Shared browser ready on loopback', address)


def main():
    os.umask(0o077)
    for directory in [DATA / 'profile' / 'Default', DATA / 'downloads', DATA / 'cache']:
        directory.mkdir(parents=True, exist_ok=True)
    preferences = DATA / 'profile' / 'Default' / 'Preferences'
    if not preferences.exists():
        preferences.write_text(json.dumps({
            'credentials_enable_service': False,
            'profile': {'password_manager_enabled': False},
            'download': {'default_directory': str(DATA / 'downloads')},
        }))
    authority = RUNTIME / 'Xauthority'
    authority.touch(mode=0o600, exist_ok=True)
    # Feed the X cookie through stdin, never command arguments or logs.
    subprocess.run(['xauth', '-f', str(authority), 'source', '-'],
                   input=f'add {DISPLAY} . {secrets.token_hex(16)}\n', text=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    env = {**os.environ, 'DISPLAY': DISPLAY, 'XAUTHORITY': str(authority),
           'XDG_RUNTIME_DIR': str(RUNTIME), 'XDG_CACHE_HOME': str(DATA / 'cache')}
    start('Xvfb', ['Xvfb', DISPLAY, '-screen', '0', '1440x900x24', '-nolisten', 'tcp',
                   '-auth', str(authority), '-s', '0', '-noreset'], env)
    wait_for(lambda: Path('/tmp/.X11-unix/X99').exists(), 'display')
    start('openbox', ['openbox'], env)
    start('x11vnc', ['x11vnc', '-display', DISPLAY, '-auth', str(authority),
                    '-rfbauth', str(DATA / 'vnc.passwd'), '-rfbport', '5900',
                    '-listen', '127.0.0.1', '-localhost', '-no6', '-forever', '-shared',
                    '-repeat', '-noxdamage', '-quiet', '-o', '/dev/null'], env)
    wait_for(lambda: tcp_ready(5900), 'VNC')
    start('chromium', [str(INSTALL / 'chromium' / 'chrome'), '--ozone-platform=x11',
                      '--user-data-dir=' + str(DATA / 'profile'),
                      '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9222',
                      '--no-first-run', '--no-default-browser-check', '--disable-sync',
                      '--disable-breakpad', '--disable-crash-reporter', '--disable-dev-shm-usage',
                      '--password-store=basic', '--start-maximized',
                      (INSTALL / 'welcome.html').as_uri()], env)
    wait_for(cdp_ready, 'browser')
    start('websockify', ['websockify', '--web=/usr/share/novnc',
                        '127.0.0.1:6080', '127.0.0.1:5900'], env)
    wait_for(lambda: tcp_ready(6080), 'noVNC')
    notify_ready()
    print('Shared browser ready; access credentials are stored outside the repository.', flush=True)
    while not stopping:
        for name, process in children:
            if process.poll() is not None:
                raise RuntimeError(f'{name} exited')
        time.sleep(1)


if __name__ == '__main__':
    for sig in [signal.SIGTERM, signal.SIGINT]:
        signal.signal(sig, stop)
    code = 0
    try:
        main()
    except Exception as error:
        # Only our own component names/stages are safe to report.
        print(str(error) if isinstance(error, RuntimeError) else 'Shared browser startup failed', flush=True)
        code = 1
    finally:
        for _, process in reversed(children):
            if process.poll() is None:
                process.terminate()
        for _, process in reversed(children):
            try:
                process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                process.kill()
        raise SystemExit(code)
