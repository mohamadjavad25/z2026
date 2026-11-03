import subprocess, sys, os
SRC='/home/user/z2026/docs/brand/reels/01-kanseli/film-v5.mp4'
W=os.path.dirname(os.path.abspath(__file__)); C=W+'/cap/'  # segment cuts and overlays; fonts: copy public/fonts/vazirmatn-*.woff2 into cap/ before running the .mjs files
CROP={'close':'crop=650:1155:410:275,scale=1080:1920:flags=lanczos,unsharp=5:5:0.6,','wide':'crop=804:1430:138:0,scale=1080:1920:flags=lanczos,unsharp=5:5:0.4,'}
def seg(name, a, b, kind, cap=None, logo=None, freeze=None, notif=None, mute=False):
    out=f'{W}/s_{name}.mp4'; d=b-a
    ain=['-ss',str(a),'-t',str(d),'-i',SRC]
    if kind=='freeze':
        vin=['-ss',str(freeze),'-i',SRC]
        vf='[1:v]trim=end_frame=1,loop=loop=-1:size=1,trim=duration=%.3f,setpts=N/30/TB[v]'%d
        cmd=['ffmpeg','-v','error','-y']+ain+vin+['-filter_complex',vf,'-map','[v]','-map','0:a']
    else:
        chain='[0:v]scale=in_range=pc:out_range=tv,format=yuv420p,'
        if logo: chain+=CROP[logo]
        if kind=='demo': chain+='crop=900:1600:90:300,scale=1080:1920,'
        chain+='setsar=1[b]'
        if cap:
            extra=['-i',C+cap+'.png']; fc=chain+';[1:v]format=rgba[c1];[b][c1]overlay=0:0:format=auto'
            if notif: extra+=['-i',C+notif+'.png']; fc+='[o];[2:v]format=rgba[c2];[o][c2]overlay=0:0:format=auto'
            fc+='[v]'; cmd=['ffmpeg','-v','error','-y']+ain+extra+['-filter_complex',fc,'-map','[v]','-map','0:a']
        else:
            cmd=['ffmpeg','-v','error','-y']+ain+['-filter_complex',chain.replace('[b]','[v]'),'-map','[v]','-map','0:a']
    cmd+=['-af',('volume=0,' if mute else '')+'afade=t=in:d=0.04,afade=t=out:st=%.3f:d=0.06'%(d-0.06),'-r','30','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-ac','2',out]
    subprocess.run(cmd,check=True); return out
S={}
S['hook']=seg('hook',0.40,3.20,'live','hook','close',notif='nHook')
S['chair']=seg('chair',3.30,6.45,'live','chair','wide')
S['char']=seg('char',6.85,9.70,'plain')
S['d1']=seg('d1',25.40,27.95,'demo','d1')
S['d2']=seg('d2',28.70,31.45,'demo','d2')
S['d3']=seg('d3',34.90,38.95,'demo','d3')
S['pay']=seg('pay',42.15,45.00,'live','pay','close',notif='nPay',mute=True)
S['cta']=seg('cta',45.45,53.10,'freeze',freeze=52.8)
S['end']=seg('end',53.20,55.40,'plain')
def join(name, parts):
    lst=f'{W}/{name}.txt'; open(lst,'w').write(''.join(f"file '{S[p]}'\n" for p in parts))
    subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',lst,'-c','copy','-movflags','+faststart',f'{W}/{name}.mp4'],check=True)
join('v1-ghesse-25s',['hook','chair','char','d1','d2','d3','pay','cta'])
join('v2-aval-natije',['pay','hook','char','d1','d2','d3','cta'])
join('v3-kootah-15s',['hook','char','d2','pay','end'])
S['charN']=seg('charN',6.85,9.70,'live','cardChar',mute=True)
S['endN']=seg('endN',49.50,52.50,'live','cardEnd',mute=True)
join('v4-base',['hook','chair','charN','d1','d2','d3','pay','endN'])
