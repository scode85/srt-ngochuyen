/* Web Worker for official sherpa-onnx WASM TTS runtime. */
let tts=null;
self.Module={
 locateFile:(path,dir)=>dir+path,
 setStatus:status=>self.postMessage({type:'status',status}),
 onRuntimeInitialized:()=>{
  try{
   tts=createOfflineTts(self.Module);
   if(!tts||!tts.sampleRate)throw Error('Không thể mở model');
   self.postMessage({type:'ready',sampleRate:tts.sampleRate});
  }catch(err){self.postMessage({type:'error',message:'Khởi tạo AI thất bại: '+String(err.message||err)})}
 }
};
importScripts('./sherpa-onnx-wasm-main-tts.js');
importScripts('./sherpa-onnx-tts.js');
self.onmessage=e=>{
 const {type,id,text,speed}=e.data;
 if(type!=='synthesize')return;
 try{
  if(!tts)throw Error('Model chưa sẵn sàng');
  const audio=tts.generate({text,sid:0,speed:speed||1});
  const samples=audio.samples,sampleRate=tts.sampleRate;
  if(!samples||!samples.length)throw Error('Model trả về âm thanh rỗng');
  self.postMessage({type:'audio',id,samples,sampleRate},[samples.buffer]);
 }catch(err){self.postMessage({type:'audio-error',id,message:String(err.message||err)})}
};