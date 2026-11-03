import fs from 'node:fs';
const BASE='http://localhost:3200'; let cookie='';
const r=await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:'09126660002',password:'reel-pass-123'})}); cookie=r.headers.get('set-cookie').split(';')[0];
const a=await fetch(BASE+'/api/profile',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({data:{avatar:'data:image/jpeg;base64,'+fs.readFileSync(process.argv[2]).toString('base64')}})}); console.log(a.status);
