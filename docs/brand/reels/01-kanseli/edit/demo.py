import subprocess, os
W=os.path.dirname(os.path.abspath(__file__)); C=W+'/cap/'
enc=['-r','30','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-color_range','tv']
def run(args): subprocess.run(['ffmpeg','-v','error','-y']+args,check=True)
sil=['-f','lavfi','-t','10','-i','anullsrc=r=48000:cl=stereo']
# n1: zoom into the home card, ripple on «بساز» at 1.6s
d=2.6
run(['-loop','1','-t',str(d),'-i',C+'home.png','-loop','1','-t',str(d),'-i',C+'n1.png','-loop','1','-t',str(d),'-i',C+'ripple.png']+sil+['-filter_complex',
 f"[0]scale=2160:3840,zoompan=z='min(1+0.3*on/60,1.3)':x='540*2-iw/zoom/2+ (iw/2-540*2)*0':y='1020*2-ih/zoom/2':d=1:s=1080x1920:fps=30,trim=duration={d}[z];"
 f"[z][1]overlay=0:0[a];[2]fade=t=in:st=1.5:d=0.1:alpha=1,fade=t=out:st=1.9:d=0.2:alpha=1[r];[a][r]overlay=x=76:y=856:enable='between(t,1.5,2.1)'[v]",
 '-map','[v]','-map','3:a','-t',str(d)]+enc+['-c:a','aac','-ar','48000','-ac','2',W+'/s_n1.mp4'])
# n2: story looks slide (night -> pink -> works), caption
seq=[0,1,2]; dur=1.3
ins=[]; 
for k in seq: ins+=['-loop','1','-t',str(dur+0.35),'-i',C+f'sc{k}.png']
fc=f"[0][1]xfade=transition=slideleft:duration=0.35:offset={dur}[x1];[x1][2]xfade=transition=slideleft:duration=0.35:offset={2*dur}[x2];[x2][3]overlay=0:0[v]"
run(ins+['-loop','1','-t','4','-i',C+'n2.png']+sil+['-filter_complex',fc,'-map','[v]','-map','4:a','-t',str(3*dur+0.35)]+enc+['-c:a','aac','-ar','48000','-ac','2',W+'/s_n2.mp4'])
# n3: guide sheet, voice «لینک کپی شده؛ فقط بچسبون» from the original film, ripple on «برو به اینستاگرام» after it
d=4.05
SRC='/home/user/z2026/docs/brand/reels/01-kanseli/film-v5.mp4'
run(['-loop','1','-t',str(d),'-i',C+'guide.png','-loop','1','-t',str(d),'-i',C+'n3.png','-loop','1','-t',str(d),'-i',C+'ripple.png','-ss','34.9','-t',str(d),'-i',SRC,'-filter_complex',
 "[0][1]overlay=0:0[a];[2]fade=t=in:st=3.2:d=0.1:alpha=1,fade=t=out:st=3.6:d=0.2:alpha=1[r];[a][r]overlay=x=430:y=1326:enable='between(t,3.2,3.8)'[v];[3:a]afade=t=in:d=0.04,afade=t=out:st=3.95:d=0.08,aformat=channel_layouts=stereo[au]",
 '-map','[v]','-map','[au]','-t',str(d)]+enc+['-c:a','aac','-ar','48000','-ac','2',W+'/s_n3.mp4'])
