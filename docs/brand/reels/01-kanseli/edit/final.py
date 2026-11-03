"""Final cut of the «کنسلی» reel: picture from film-v6-draft.mp4, all old voice dropped,
new voices from voice/out/<line>.wav, small sounds on top, loudness -14 LUFS, true peak under -1 dB.
A segment whose line is longer than its slot is lengthened by holding its last frame (voice never sped up).
Usage: python3 final.py [out.mp4]"""
import subprocess, json, os, sys, re
W = os.path.dirname(os.path.abspath(__file__)); R = os.path.dirname(W)
SRC = R + '/film-v6-draft.mp4'; OUT = sys.argv[1] if len(sys.argv) > 1 else R + '/film-v7-final.mp4'
V = W + '/voice/out/'; TMP = W + '/tmp_final/'; os.makedirs(TMP, exist_ok=True)
SEGS = [('hook', 0), ('chair', 2.80), ('charN', 5.97), ('n1', 8.87), ('n2', 11.47), ('n3', 15.72), ('pay', 19.77), ('endN', 22.67)]
END = 25.6667
LEAD = {'hook': 0.55, 'pay': 0.45}   # voice start inside its segment (after the sad / happy sound); others 0.2
TAIL = 0.35                          # room after a line before the next segment
SFX = [('sad', 'hook', 0.10), ('tap', 'n1', 1.50), ('whoosh', 'n2', 1.25), ('whoosh', 'n2', 2.55), ('tap', 'n3', 3.20), ('happy', 'pay', 0.20)]
lines = json.load(open(W + '/voice/lines.json'))
by_seg = {l['seg']: k for k, l in lines.items()}
def dur(f): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))
def ff(*a): subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)
# trim leading/trailing silence of each voice so timing is exact
voice = {}
for k in lines:
    src = V + k + '.wav'; dst = TMP + k + '.wav'
    ff('-i', src, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,highpass=f=80', '-ac', '1', '-ar', '48000', dst)
    voice[k] = dur(dst)
plan, t = [], 0.0
for i, (name, a) in enumerate(SEGS):
    b = SEGS[i + 1][1] if i + 1 < len(SEGS) else END
    slot = b - a; k = by_seg.get(name); lead = LEAD.get(name, 0.2)
    need = lead + voice[k] + TAIL if k else 0
    length = max(slot, round(need + 0.0001, 3))
    plan.append(dict(name=name, a=a, slot=slot, len=length, start=t, lead=lead, line=k)); t += length
total = t
# picture: each segment cut from the draft, held on its last frame when longer
parts = []
for p in plan:
    f = TMP + 'v_' + p['name'] + '.mp4'; hold = p['len'] - p['slot']
    vf = 'setpts=PTS-STARTPTS' + (f',tpad=stop_mode=clone:stop_duration={hold:.3f}' if hold > 0.001 else '')
    ff('-ss', f"{p['a']:.4f}", '-t', f"{p['slot']:.4f}", '-i', SRC, '-an', '-vf', vf, '-t', f"{p['len']:.4f}", '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', f)
    parts.append(f)
open(TMP + 'list.txt', 'w').write(''.join(f"file '{f}'\n" for f in parts))
ff('-f', 'concat', '-safe', '0', '-i', TMP + 'list.txt', '-c', 'copy', TMP + 'video.mp4')
# sound: voices (mono, centred) + small sounds, then loudness
seg_at = {p['name']: p['start'] for p in plan}
ins, fc, mix = [], [], []
for p in plan:
    if not p['line']: continue
    ins += ['-i', TMP + p['line'] + '.wav']; n = len(ins) // 2 - 1; ms = int((p['start'] + p['lead']) * 1000)
    fc.append(f'[{n}]acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,adelay={ms}|{ms},pan=stereo|c0=c0|c1=c0[a{n}]'); mix.append(f'[a{n}]')
for s, seg, off in SFX:
    ins += ['-i', W + f'/sfx_{s}.wav']; n = len(ins) // 2 - 1; ms = int((seg_at[seg] + off) * 1000)
    fc.append(f'[{n}]volume=0.55,adelay={ms}|{ms}[a{n}]'); mix.append(f'[a{n}]')
fc.append(''.join(mix) + f'amix=inputs={len(mix)}:normalize=0,apad,atrim=0:{total:.3f}[m]')
base = ';'.join(fc)
m = subprocess.run(['ffmpeg', '-hide_banner', '-y', *ins, '-filter_complex', base + ';[m]loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json[o]', '-map', '[o]', '-f', 'null', '-'], capture_output=True, text=True).stderr
j = json.loads(re.findall(r'\{[^{}]*\}', m)[-1])
ln = f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true"
ff(*ins, '-filter_complex', base + f';[m]{ln},aresample=48000[o]', '-map', '[o]', '-c:a', 'pcm_s16le', TMP + 'audio.wav')
ff('-i', TMP + 'video.mp4', '-i', TMP + 'audio.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT)
json.dump(dict(total=total, plan=plan, voice=voice), open(TMP + 'plan.json', 'w'), indent=1)
for p in plan: print(f"{p['name']:6} start {p['start']:6.2f} len {p['len']:.2f} (slot {p['slot']:.2f}) line {voice.get(p['line'], 0):.2f}s")
print('total', round(total, 2), '->', OUT)
