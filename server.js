// ThreadPilot AI backend. Node.js 20+; no npm dependencies.
const http = require('node:http');
const fs = require('node:fs');
const pathModule = require('node:path');
const { URL } = require('node:url');
const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite
 Copy';
const MAX_BODY = 12 * 1024 * 1024;
let rules = '';
const APP_FILE = pathModule.join(__dirname, 'index.html');
function reply(res, code, obj) { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':process.env.ALLOWED_ORIGIN || '*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}); res.end(JSON.stringify(obj)); }
async function body(req) { let chunks=[],size=0; for await(const c of req){size+=c.length;if(size>MAX_BODY)throw Error('Upload too large (12 MB maximum)');chunks.push(c)}return Buffer.concat(chunks); }
function multipart(buffer, contentType){const match=/boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType||'');if(!match)throw Error('Missing multipart boundary');const boundary=Buffer.from('--'+(match[1]||match[2]));let result={};let pos=0;while((pos=buffer.indexOf(boundary,pos))!==-1){pos+=boundary.length;let end=buffer.indexOf(boundary,pos);if(end<0)break;let chunk=buffer.subarray(pos,end);if(chunk.subarray(0,2).toString()==='\r\n')chunk=chunk.subarray(2);let split=chunk.indexOf(Buffer.from('\r\n\r\n'));if(split<0)continue;let header=chunk.subarray(0,split).toString();let field=/name="([^"]+)"/.exec(header)?.[1];if(!field)continue;let data=chunk.subarray(split+4);if(data.subarray(-2).toString()==='\r\n')data=data.subarray(0,-2);result[field]={data,filename:/filename="([^"]+)"/.exec(header)?.[1],mime:/Content-Type:\s*([^\r\n]+)/i.exec(header)?.[1]};}return result;}
async function ask(messages, json=false){
  if(!KEY)throw Error('GEMINI_API_KEY is not configured on Render');
  const contents=[];let system='';
  for(const m of messages){
    if(m.role==='system'){system += m.content+'\n';continue;}
    const parts=typeof m.content==='string'?[{text:m.content}]:m.content.map(p=>p.type==='text'?{text:p.text}:{inline_data:{mime_type:p.image_url.url.match(/^data:([^;]+);/)[1],data:p.image_url.url.split(',')[1]}});
    contents.push({role:m.role==='assistant'?'model':'user',parts});
  }
  const payload={contents,generationConfig:{maxOutputTokens:2048,...(json?{responseMimeType:'application/json'}:{})},...(system?{systemInstruction:{parts:[{text:system}]}}:{})};
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(MODEL)+':generateContent',{method:'POST',headers:{'x-goog-api-key':KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const j=await r.json();
  if(!r.ok){const msg=j.error?.message||'Gemini request failed';if(r.status===429)throw Error('Gemini free-tier limit reached. Wait and try again; do not enable paid billing.');throw Error(msg);}
  const result=(j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
  if(!result)throw Error('Gemini returned no text. Please try again.');
  return result;
}
const getSystem=()=> 'You are ThreadPilot, a careful assistant for the mobile puzzle game Knit Out. Never claim certainty about rules or a board you cannot verify. Give concrete instructions only when visible evidence supports them. Rules supplied by the user: '+(rules||'(none yet)');
http.createServer(async(req,res)=>{if(req.method==='OPTIONS')return reply(res,200,{});let path=new URL(req.url,'http://localhost').pathname;if(req.method==='GET' && (path==='/' || path==='/index.html')){try{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(fs.readFileSync(APP_FILE))}catch(e){return reply(res,500,{error:'Missing index.html next to server file'})}}if(path==='/health')return reply(res,KEY?200:503,{status:KEY?'online':'missing_api_key',message:KEY?'Gemini server ready (free-tier usage subject to quota)':'Set GEMINI_API_KEY in Render Environment'});if(req.method!=='POST')return reply(res,404,{error:'Not found'});try{let raw=await body(req),type=req.headers['content-type']||'',data=type.includes('multipart/form-data')?multipart(raw,type):JSON.parse(raw.toString()||'{}');if(path==='/chat'){let history=Array.isArray(data.history)?data.history.slice(-12).filter(x=>['user','assistant'].includes(x.role)&&typeof x.content==='string').map(x=>({role:x.role,content:x.content.slice(0,4000)})):[];let answer=await ask([{role:'system',content:getSystem()},...history,{role:'user',content:String(data.message||'').slice(0,4000)}]);return reply(res,200,{reply:answer});}if(path==='/train'){let note=data.rules?.data?.toString('utf8')||'';if(!note.trim())throw Error('Enter written rules to add to AI knowledge. Video uploads are not analyzed by this backend.');rules=note.slice(0,16000);return reply(res,200,{message:'Rules saved for this server session. Video is not processed.'});}if(path==='/solve'){let img=data.image;if(!img?.data?.length)throw Error('Missing game image');let mime=img.mime||'image/png';if(!/^image\/(png|jpeg|webp)$/.test(mime))throw Error('Unsupported image format');let prompt='Inspect this Knit Out puzzle screenshot carefully. Return JSON with fields boardRecognized (boolean), moves (array of short natural-language move descriptions), explanation (string). If the game rules, legal moves, or solution are uncertain, return an empty moves array and explain what is missing. Do not fabricate a guaranteed solution. User rules: '+(rules||'not provided');let output=await ask([{role:'system',content:'You analyze puzzle screenshots. Output valid JSON only. Be cautious: if not certain of the rules, do not invent a move sequence.'},{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:`data:${mime};base64,${img.data.toString('base64')}`}}]}],true);let parsed=JSON.parse(output);return reply(res,200,{boardRecognized:parsed.boardRecognized===true,moves:Array.isArray(parsed.moves)?parsed.moves:[],explanation:String(parsed.explanation||'')});}if(path==='/play'||path==='/stop')return reply(res,501,{error:'Automatic control is not installed. ThreadPilot will not click or tap your game without a supported control bridge.'});return reply(res,404,{error:'Unknown endpoint'});}catch(e){reply(res,400,{error:e.message||'Request failed'});}}).listen(PORT,()=>console.log(`ThreadPilot AI backend listening on http://localhost:${PORT} (open this URL in your browser)`));
