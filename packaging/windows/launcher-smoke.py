"""Fast lifecycle check before compressing the large offline Windows installer."""
import os
from pathlib import Path
import subprocess
import sys
import time
import traceback
import urllib.request
import json
import tempfile
from ai_cut_smoke import verify_ai_cut

def main():
    root=Path(sys.argv[1]).resolve()
    env={**os.environ,'TALEDIT_NO_BROWSER':'1'}
    first=subprocess.Popen([str(root/'TALEDIT.exe')],env=env)
    try:
        deadline=time.time()+90
        while True:
            try:
                with urllib.request.urlopen('http://127.0.0.1:3000/api/health',timeout=3) as response:
                    health=json.load(response);assert health['ffmpeg'] and health['ffprobe']
                break
            except Exception:
                if first.poll() is not None or time.time()>deadline:raise RuntimeError('Launcher did not become ready')
                time.sleep(.25)
        # Multiple calls must promptly reuse the existing supervisor and exit.
        for attempt in range(3):
            subprocess.run([str(root/'TALEDIT.exe')],env=env,check=True,timeout=15)
        print('::notice::Windows EXE first launch and three duplicate launches: PASS',flush=True)
        with tempfile.TemporaryDirectory(prefix='taledit AI Cut ') as folder:
            verify_ai_cut(root/'tools/ffmpeg.exe',folder)
    finally:
        subprocess.run([str(root/'CHIUDI-TALEDIT.exe')],env=env,check=True,timeout=20)
        first.wait(timeout=20)
    assert first.returncode==0,first.returncode
    print('::notice::Windows EXE supervisor shutdown: PASS',flush=True)
    with tempfile.TemporaryDirectory(prefix='taledit native desktop ') as folder:
        result=Path(folder)/'desktop.json'
        native_env={**os.environ,'TALEDIT_DESKTOP_SMOKE':'1','TALEDIT_DESKTOP_SMOKE_RESULT':str(result)}
        native_env.pop('TALEDIT_NO_BROWSER',None)
        subprocess.run([str(root/'TALEDIT.exe')],env=native_env,check=True,timeout=90)
        ui=json.loads(result.read_text(encoding='utf-8'))
        assert ui.get('logo') is True and 'error' not in ui,ui
        print('::notice::Installed EXE opens complete native desktop with TALedit logo and stops on close: PASS',flush=True)


if __name__=='__main__':
    try:main()
    except Exception as error:
        detail=''.join(traceback.format_exception(error))
        log=Path(os.environ.get('LOCALAPPDATA',''))/'TALEDIT/data/avvio.log'
        if log.is_file():detail+='\nSERVER LOG:\n'+log.read_text(encoding='utf-8',errors='replace')[-12000:]
        print('::error::'+detail.replace('%','%25').replace('\r','%0D').replace('\n','%0A'),flush=True)
        raise
