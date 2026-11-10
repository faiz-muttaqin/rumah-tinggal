#!/usr/bin/env python3
"""Install the shared-browser service; credentials and profile stay off-repo."""
import argparse
import grp
import hashlib
import json
import os
from pathlib import Path
import pwd
import secrets
import shutil
import string
import subprocess

SOURCE = Path(__file__).resolve().parent
INSTALL = Path('/opt/rumah-shared-browser')
DATA = Path('/var/lib/rumah-shared-browser')
CONFIG = Path('/etc/rumah-shared-browser')
UNIT = Path('/etc/systemd/system/rumah-shared-browser.service')


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('chromium_dir', type=Path, help='Full Chromium directory, not headless shell')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Run setup as root.')
    active = subprocess.run(['systemctl', 'is-active', '--quiet', 'rumah-shared-browser.service']).returncode == 0
    if active:
        raise SystemExit('Stop the existing shared-browser session before updating its installation.')
    browser = args.chromium_dir.resolve(strict=True)
    if not (browser / 'chrome').is_file():
        raise SystemExit('Full Chromium executable not found.')
    for program in ['Xvfb', 'xauth', 'x11vnc', 'websockify', 'openbox', 'openssl', 'apparmor_parser', 'dbus-run-session']:
        if not shutil.which(program):
            raise SystemExit(f'Missing dependency: {program}')
    try:
        account = pwd.getpwnam('rumah-browser')
    except KeyError:
        run(['useradd', '--system', '--user-group', '--home-dir', str(DATA),
             '--create-home', '--shell', '/usr/sbin/nologin', 'rumah-browser'])
        account = pwd.getpwnam('rumah-browser')
    DATA.mkdir(exist_ok=True)
    DATA.chmod(0o700)
    os.chown(DATA, account.pw_uid, account.pw_gid)
    INSTALL.mkdir(mode=0o755, exist_ok=True)
    installed_browser = INSTALL / 'chromium'
    digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    if not (installed_browser / 'chrome').exists() or digest(installed_browser / 'chrome') != digest(browser / 'chrome'):
        stage = INSTALL / 'chromium.new'
        if stage.exists():
            shutil.rmtree(stage)
        shutil.copytree(browser, stage, symlinks=False)
        for path in [stage, *stage.rglob('*')]:
            executable = path.stat().st_mode & 0o111
            path.chmod(0o755 if path.is_dir() or executable else 0o644)
        if installed_browser.exists():
            shutil.rmtree(installed_browser)
        stage.rename(installed_browser)
    for name in ['session.py', 'welcome.html']:
        shutil.copy2(SOURCE / name, INSTALL / name)
        (INSTALL / name).chmod(0o644)
    profile = Path('/etc/apparmor.d/rumah-shared-chromium')
    shutil.copy2(SOURCE / 'apparmor.profile', profile)
    profile.chmod(0o644)
    run(['apparmor_parser', '-r', str(profile)])
    CONFIG.mkdir(mode=0o750, exist_ok=True)
    os.chown(CONFIG, 0, grp.getgrnam('www-data').gr_gid)
    CONFIG.chmod(0o750)
    access = CONFIG / 'access.txt'
    vnc_file = DATA / 'vnc.passwd'
    htpasswd = CONFIG / 'htpasswd'
    if not access.exists():
        alphabet = string.ascii_letters + string.digits
        vnc_password = ''.join(secrets.choice(alphabet) for _ in range(8))
        http_password = ''.join(secrets.choice(alphabet) for _ in range(28))
        # Values go via stdin, never argv, terminal output, logs or source files.
        run(['x11vnc', '-storepasswd', str(vnc_file)],
            input=f'{vnc_password}\n{vnc_password}\ny\n', text=True,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        if not vnc_file.is_file() or vnc_file.stat().st_size != 8:
            raise SystemExit('VNC credential file was not created.')
        encoded = run(['openssl', 'passwd', '-apr1', '-stdin'], input=http_password + '\n',
                      text=True, capture_output=True).stdout.strip()
        htpasswd.write_text('browser:' + encoded + '\n')
        access.write_text('HTTP_USER=browser\nHTTP_PASSWORD=' + http_password + '\nVNC_PASSWORD=' + vnc_password + '\n')
    if not vnc_file.exists() or not htpasswd.exists():
        raise SystemExit('Existing credential files are incomplete; repair without exposing their values.')
    access.chmod(0o600)
    os.chown(access, 0, 0)
    vnc_file.chmod(0o600)
    os.chown(vnc_file, account.pw_uid, account.pw_gid)
    htpasswd.chmod(0o640)
    os.chown(htpasswd, 0, grp.getgrnam('www-data').gr_gid)
    for example in SOURCE.glob('nginx-*.conf.example'):
        shutil.copy2(example, CONFIG / example.name)
        (CONFIG / example.name).chmod(0o644)
    shutil.copy2(SOURCE / 'rumah-shared-browser.service', UNIT)
    UNIT.chmod(0o644)
    run(['systemd-analyze', 'verify', str(UNIT)])
    run(['systemctl', 'daemon-reload'])
    print(json.dumps({'installed': str(INSTALL), 'profile': str(DATA / 'profile'),
                      'credentialsFile': str(access), 'http': '127.0.0.1:6080',
                      'vnc': '127.0.0.1:5900', 'cdp': '127.0.0.1:9222',
                      'service': UNIT.name, 'publicProxyChanged': False, 'started': False}))


if __name__ == '__main__':
    main()
