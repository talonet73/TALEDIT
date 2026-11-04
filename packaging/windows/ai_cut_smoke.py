"""Real audio-only and video AI Cut regression, including the reported 169.6s/0.7s case."""
import json
from pathlib import Path
import subprocess
import time
import urllib.parse
import urllib.request

def request(route,body=None,file=None):
    headers={'Content-Type':'application/json'}
    data=json.dumps(body).encode() if body is not None else None
    if file:
        data=file.read_bytes();headers={'Content-Type':'application/octet-stream','x-filename':urllib.parse.quote(file.name)}
    with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:3000'+route,data=data,headers=headers),timeout=180) as response:
        return json.load(response)

def verify_ai_cut(ffmpeg,folder):
    folder=Path(folder)
    for media_type,duration,pause_end in [('audio',169.6,167.6),('video',4,3)]:
        source=folder/('Audio qualità.wav' if media_type=='audio' else 'Video con pause.mp4')
        audio=f'aevalsrc=if(between(t\\,1\\,{pause_end})\\,0\\,0.1*sin(2*PI*440*t)):s=48000:d={duration}'
        args=[str(ffmpeg),'-v','error','-y']
        if media_type=='video':args+=['-f','lavfi','-i','color=c=red:s=160x90:r=25:d=4']
        args+=['-f','lavfi','-i',audio]
        if media_type=='video':args+=['-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-shortest']
        subprocess.run(args+[str(source)],check=True,timeout=60)
        asset=request('/api/upload-media',file=source)['asset']
        clip={'id':media_type,'name':asset['name'],'type':media_type,'trackId':media_type,'mediaUrl':asset['fileUrl'],'startTime':0,'duration':duration,'offset':0,'transparency':100,'volumeDb':0,'fadeIn':0,'fadeOut':0}
        started=request('/api/smart-cut',{'mode':'automatic','margin':.7,'clips':[clip],'durationSec':duration,'language':'Italian'})
        deadline=time.time()+90
        while True:
            job=request('/api/captions/'+started['jobId'])
            assert job['status']!='error',job.get('error')
            if job['status']=='complete':break
            assert time.time()<deadline,'AI Cut timeout'
            time.sleep(.1)
        assert len(job['candidates'])==1,job
        cut=job['candidates'][0];tolerance=.02 if media_type=='audio' else .1
        assert abs(cut['start']-1.35)<tolerance,cut
        assert abs(cut['end']-(pause_end-.35))<tolerance,cut
        assert cut['selected'],cut
    print('::notice::Real AI Cut: 169.6-second WAV and video, 0.7-second retained pause: PASS',flush=True)
