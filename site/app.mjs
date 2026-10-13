import {RATE,parseSrt,resample,fitDuration,mix,wavBlob} from './align.mjs';
const $=id=>document.getElementById(id);let worker,ready=false,busy=false,seq=0,pending=new Map(),audioURL=null,reportURL=null;
function status(s){$('status').textContent=s}function lock(v){busy=v;$('load').disabled=v||ready;$('build').disabled=v||!ready}
function inspect(){const cues=parseSrt($('srt').value);$('stats').textContent=cues.length+' câu • '+(Math.max(...cues.map(x=>x.end))/1000).toFixed(3)+' giây';return cues}
$('file').onchange=async e=>{if(e.target.files[0]){$('srt').value=await e.target.files[0].text();try{inspect()}catch(err){status(err.message)}}};$('srt').oninput=()=>{try{inspect()}catch{$('stats').textContent='Chưa có SRT hợp lệ'}};
$('load').onclick=()=>{if(worker)return;lock(true);status('Đang tải WebAssembly và model Ngọc Huyền...');worker=new Worker('./tts-worker.js');worker.onmessage=e=>{const m=e.data;if(m.type==='ready'){ready=true;lock(false);status('Model đã sẵn sàng.')}else if(m.type==='status'){status(m.status)}else if(m.type==='error'){status('Lỗi: '+m.message);lock(false)}else if(m.type==='audio'||m.type==='audio-error'){const p=pending.get(m.id);if(p){pending.delete(m.id);m.type==='audio'?p.resolve(m):p.reject(Error(m.message))}}};worker.onerror=e=>{status('Lỗi WASM: '+e.message);lock(false)}};
function speak(text,speed){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});worker.postMessage({type:'synthesize',id,text,speed})})}
$('build').onclick=async()=>{let cues;try{cues=inspect()}catch(err){status(err.message);return}const end=Math.max(...cues.map(x=>x.end));if(end>15*60000){status('File dài trên 15 phút. Hãy chia thành nhiều phần để tránh hết RAM trên điện thoại.');return}let output=new Float32Array(end*48),warnings=[];lock(true);$('download').hidden=$('report').hidden=true;try{for(let i=0;i<cues.length;i++){const c=cues[i];$('progress').value=Math.round(i/cues.length*100);status('Đang tạo câu '+(i+1)+'/'+cues.length+': '+c.text.slice(0,55));const baseSpeed=Math.max(.6,Math.min(1.6,Number($('speed').value)||1));
const next=cues[i+1];
// Chỉ dùng thời gian đến câu tiếp theo nếu phụ đề không chồng lấn.
const allowedEnd=next&&next.start>c.start?Math.min(c.end,next.start):c.end;
const target=Math.max(1,Math.round((allowedEnd-c.start)*RATE/1000));
const maxSpeed=Math.max(baseSpeed,Math.min(2.2,Number($('maxspeed').value)||1.85));
let speed=baseSpeed;
let a=await speak(c.text,speed);
let pcm=resample(a.samples,a.sampleRate);
let ratio=pcm.length/target;
// Điều chỉnh ngay trong mô hình TTS: KHÔNG resample để tăng tốc,
// vì thay đổi sample rate để ép thời lượng sẽ làm đổi cao độ giọng.
if($('auto').checked){
 for(let attempt=0;attempt<3&&ratio>1.015&&speed<maxSpeed-.015;attempt++){
  const proposed=Math.min(maxSpeed,Math.max(speed+.08,speed*ratio*1.025));
  status('Câu '+(i+1)+'/'+cues.length+' dài hơn thời gian: thử tốc độ '+proposed.toFixed(2)+'×');
  const candidate=await speak(c.text,proposed);
  const candidatePcm=resample(candidate.samples,candidate.sampleRate);
  // Nếu model phản hồi sai hoặc không tạo được câu ngắn hơn, không dùng bản đó.
  if(candidatePcm.length>=pcm.length*.995)break;
  pcm=candidatePcm;
  speed=proposed;
  ratio=pcm.length/target;
 }
}
if(speed>baseSpeed+.01)warnings.push({line:c.index,speed:Number(speed.toFixed(2)),text:c.text,warning:'Đã tăng tốc tạo giọng lên '+speed.toFixed(2)+'× để phù hợp thời gian'});
if(ratio>1.03)warnings.push({line:c.index,ratio:Number(ratio.toFixed(2)),text:c.text,warning:'Dù đã tăng tốc, câu vẫn dài hơn khung SRT: giữ đủ chữ, có thể lấn câu sau'});if(ratio<.7)warnings.push({line:c.index,ratio:Number(ratio.toFixed(2)),text:c.text,warning:'Câu ngắn hơn khung SRT: đã thêm khoảng lặng, không kéo giãn giọng'});if(i&&c.start<cues[i-1].end)warnings.push({line:c.index,warning:'Phụ đề chồng mốc'});output=mix(output,fitDuration(pcm,target),c.start);await new Promise(r=>setTimeout(r,0))}let peak=0;for(let i=0;i<output.length;i++)peak=Math.max(peak,Math.abs(output[i]));if(peak>1)for(let i=0;i<output.length;i++)output[i]/=peak;const wav=wavBlob(output);if(audioURL)URL.revokeObjectURL(audioURL);audioURL=URL.createObjectURL(wav);$('player').src=audioURL;$('download').href=audioURL;$('download').hidden=false;if(reportURL)URL.revokeObjectURL(reportURL);reportURL=URL.createObjectURL(new Blob([JSON.stringify({sampleRate:RATE,cues:cues.length,durationMs:Math.round(output.length*1000/RATE),warnings},null,2)],{type:'application/json'}));$('report').href=reportURL;$('report').hidden=false;$('warnings').replaceChildren(...warnings.map(w=>{const p=document.createElement('p');p.textContent='Câu '+w.line+': '+w.warning;return p}));$('progress').value=100;status('Hoàn tất! Câu dài đã được tăng tốc ngay khi tổng hợp giọng. Không ép co giãn âm thanh gây méo tiếng.')}catch(err){status('Lỗi: '+err.message)}finally{lock(false)}};
