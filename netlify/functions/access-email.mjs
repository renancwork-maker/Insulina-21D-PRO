export function getAppUrl(){
 const url=new URL(process.env.APP_URL||'');
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('invalid_app_url');
 return url.origin;
}
export async function sendResendEmail({to,emailMessage,idempotencyKey}){
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
 if(!key||!from)throw Error('resend_not_configured');
 const headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
 if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers,body:JSON.stringify({from,to:[to],subject:emailMessage.subject,html:emailMessage.html,text:emailMessage.text})});
 if(!response.ok)throw Error(`resend_http_${response.status}`);
 const data=await response.json();return String(data.id||'');
}
