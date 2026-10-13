export const RATE=48000;
export function parseSrt(input){const blocks=input.replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split(/\n\s*\n/);const cues=[];for(const block of blocks){const lines=block.trim().split('\n');const i=lines.findIndex(s=>s.includes('-->'));if(i<0)continue;const m=lines[i].match(/(\d+):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d+):(\d{2}):(\d{2})[,.](\d{3})/);if(!m)throw Error('Mốc thời gian không hợp lệ: '+lines[i]);const t=(a,b,c,d)=>(+a*3600+ +b*60+ +c)*1000+ +d;const start=t(...m.slice(1,5)),end=t(...m.slice(5,9));if(end<=start)throw Error('Mốc kết thúc phải sau bắt đầu: '+lines[i]);const text=lines.slice(i+1).join(' ').replace(/<[^>]+>/g,'').trim();if(text)cues.push({index:cues.length+1,start,end,text})}if(!cues.length)throw Error('Không tìm thấy phụ đề SRT hợp lệ');cues.sort((a,b)=>a.start-b.start);return cues}
export function resample(samples,src){if(src===RATE)return samples;const n=Math.round(samples.length*RATE/src),out=new Float32Array(n);for(let i=0;i<n;i++){const p=i*src/RATE,j=Math.floor(p),f=p-j;out[i]=(samples[j]||0)*(1-f)+(samples[Math.min(j+1,samples.length-1)]||0)*f}return out}
// Chế độ bảo toàn giọng: tuyệt đối không đổi tốc độ mẫu để ép âm thanh vào khung.
// Nếu câu ngắn hơn mốc SRT, thêm khoảng lặng. Nếu dài hơn, giữ trọn câu.
export function fitDuration(samples,n){
 if(n<=0)return samples;
 if(samples.length>=n)return samples;
 const out=new Float32Array(n);
 out.set(samples);
 return out;
}
// Nới bộ đệm khi một câu vượt quá mốc kết thúc để không bị cắt mất từ.
export function mix(output,segment,startMs){
 const start=Math.round(startMs*RATE/1000);
 const needed=start+segment.length;
 if(needed>output.length){const next=new Float32Array(needed);next.set(output);output=next}
 for(let i=0;i<segment.length;i++)output[start+i]+=segment[i];
 return output;
}
export function wavBlob(samples){const b=new ArrayBuffer(44+samples.length*2),v=new DataView(b);const write=(p,s)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i))};write(0,'RIFF');v.setUint32(4,36+samples.length*2,true);write(8,'WAVE');write(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,RATE,true);v.setUint32(28,RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++){const x=Math.max(-1,Math.min(1,samples[i]));v.setInt16(44+i*2,x<0?Math.round(x*32768):Math.round(x*32767),true)}return new Blob([b],{type:'audio/wav'})}