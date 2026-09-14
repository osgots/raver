function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}
function send(res,status,body){setCors(res);res.status(status);res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));}
const MODEL='gemini-3.1-flash-lite';
const SYSTEM_PROMPT=`You are Raver AI Support, the intelligent customer-service assistant for Raver.
Raver is an institution/student lookup web app. Search and AI support work without login and have no search quota. Guests and normal users never receive protected student phone numbers; only Admin and Developer roles may see phone numbers. Reports and feedback require login. Users can change/recover passwords securely. Admins and Developers can create/manage notices. Admins can moderate normal users. The Developer has highest access, can promote/demote admins, permanently delete non-developer accounts, control maintenance mode, review reports/support/audit data, and is protected from moderation. During maintenance the site, login, notices, languages, account functions and AI support work, but student searches are paused.
Answer the actual question, use conversation history for follow-ups, be concise but useful, give exact UI steps when asked, never reveal secrets/passwords/API keys or protected phone data, and never claim you changed something unless the site confirms it.`;
function cleanHistory(raw){if(!Array.isArray(raw))return[];return raw.slice(-16).map(m=>({role:m?.role==='assistant'?'model':'user',parts:[{text:String(m?.content||'').trim().slice(0,3000)}]})).filter(m=>m.parts[0].text)}
function extractText(d){const p=d?.candidates?.[0]?.content?.parts;return Array.isArray(p)?p.map(x=>x?.text||'').join('').trim():''}
export default async function handler(req,res){
  setCors(res);if(req.method==='OPTIONS')return res.status(204).end();if(req.method!=='POST')return send(res,405,{error:'Method not allowed'});
  try{
    const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)return send(res,503,{error:'Raver AI is not configured'});
    const message=String(req.body?.message||'').trim().slice(0,3000);if(!message)return send(res,400,{error:'Message required'});
    const history=cleanHistory(req.body?.history);const last=history[history.length-1];const contents=last?.role==='user'&&last?.parts?.[0]?.text===message?history:[...history,{role:'user',parts:[{text:message}]}];
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM_PROMPT}]},contents,generationConfig:{temperature:.45,maxOutputTokens:1000}})});
    const d=await r.json().catch(()=>({}));if(!r.ok){console.error('Gemini',r.status,d);return send(res,r.status===429?429:503,{error:r.status===429?'Raver AI free-tier limit reached':'Raver AI is temporarily unavailable',detail:d?.error?.message||`Gemini error ${r.status}`})}
    const answer=extractText(d);if(!answer)return send(res,502,{error:'Gemini returned an empty response'});return send(res,200,{answer,mode:'ai',model:MODEL});
  }catch(e){console.error('Raver AI Support',e);return send(res,503,{error:'Raver AI is temporarily unavailable'});}
}
