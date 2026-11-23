import { createClient } from '@supabase/supabase-js';
import { buildNoLoginReminderEmail } from './email-templates.mjs';
import {getAppUrl} from './access-email.mjs';

// Agendamento em UTC: toda hora cheia. Executa somente em producao na Netlify.
export const config = { schedule: '0 * * * *' };

const required = [
  'SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','APP_URL',
  'RESEND_API_KEY','RESEND_FROM_EMAIL',
];

function isValidConfig() {
  if (required.some(k => !process.env[k])) return false;
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(process.env.APP_URL)) return false;
  return true;
}

export default async function handler() {
  if (!isValidConfig()) {
    console.error('[lembrete-sem-login] Configuracao obrigatoria ausente ou invalida');
    return Response.json({ok:false,error:'not_configured'},{status:503});
  }
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
  const { data: jobs, error: claimError } = await admin.rpc('clube_login_reminder_claim',{p_max:15});
  if (claimError) {
    console.error('[lembrete-sem-login] Falha ao reservar envios:',String(claimError.code||claimError.message).slice(0,70));
    return Response.json({ok:false,error:'claim_failed'},{status:500});
  }

  const results={selected:jobs?.length||0,sent:0,skipped:0,retry:0};
  for (const job of jobs || []) {
    const id=job.out_user_id,attempt=job.out_attempt;
    async function finish(state, messageId=null, errorCode=null) {
      const {data,error}=await admin.rpc('clube_login_reminder_finish',{
        p_user_id:id,p_attempt:attempt,p_state:state,p_message_id:messageId,p_error:errorCode,
      });
      if(error||data!==true)console.error('[lembrete-sem-login] Falha ao registrar status',String(error?.code||'conflict').slice(0,60));
    }
    try {
      // Segunda verificacao imediatamente antes do email, caso a pessoa tenha
      // entrado desde a reserva no banco. Não usa "visualizou a pagina" como login.
      const {data:auth,error:authError}=await admin.auth.admin.getUserById(id);
      const user=auth?.user;
      if(authError||!user)throw new Error('auth_lookup_failed');
      const email=String(user.email||'').trim().toLowerCase();
      // No fluxo por link, verificar o token do e-mail conta como sign-in no Auth,
      // mas nao equivale a abrir o app. A atividade real sera checada abaixo.
      if(email!==job.out_email || user.last_sign_in_at) {
        await finish('suppressed');results.skipped++;continue;
      }
      const [activity,legacy] = await Promise.all([
        admin.from('app_user_activity').select('user_id').eq('user_id',id).not('first_open_at','is',null).limit(1),
        admin.from('acessos').select('id').eq('user_id',id).limit(1),
      ]);
      if(activity.error||legacy.error)throw new Error('activity_lookup_failed');
      if((activity.data||[]).length||(legacy.data||[]).length) {
        await finish('suppressed');results.skipped++;continue;
      }
      const appUrl=getAppUrl();
      const emailContent=buildNoLoginReminderEmail({name:job.out_name,email,appUrl});
      // A chave evita duplicatas em reexecucoes/respostas interrompidas.
      const response=await fetch('https://api.resend.com/emails',{
        method:'POST',
        headers:{
          Authorization:`Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type':'application/json',
          'Idempotency-Key':`clube-primeiro-acesso-48h-${id}-${attempt}`,
        },
        body:JSON.stringify({
          from:process.env.RESEND_FROM_EMAIL,to:[email],
          subject:emailContent.subject,html:emailContent.html,text:emailContent.text,
        }),
      });
      if(!response.ok)throw new Error(`resend_http_${response.status}`);
      const receipt=await response.json();
      await finish('sent',String(receipt.id||''));results.sent++;
      // Resend tem limite de taxa; evite enviar lotes em paralelo.
      await new Promise(resolve=>setTimeout(resolve,550));
    } catch(e) {
      console.error('[lembrete-sem-login] Erro de processamento:',String(e.message||'unknown').slice(0,60));
      await finish('retry',null,String(e.message||'unknown').slice(0,80));
      results.retry++;
    }
  }
  return Response.json({ok:true,...results});
}
