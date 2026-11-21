(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  // O token nunca deve permanecer no historico, logs de analytics ou referrers.
  let tokenHash=params.get('token_hash');
  history.replaceState(null,'',location.pathname);
  const $=id=>document.getElementById(id);
  const feedback=$('feedback');
  const form=$('password-form');
  const submit=$('submit');
  let accessToken=null;

  const showMessage=(message,isError=true)=>{
    feedback.textContent=message;
    feedback.className='status '+(isError?'error':'success');
  };
  const disableForm=(message)=>{
    form.classList.add('hidden');
    $('intro').textContent=message;
  };
  const url=String(window.APP_SUPABASE_URL||'').replace(/\/+$/,'');
  const key=String(window.APP_SUPABASE_ANON_KEY||'');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!/^(sb_publishable_|eyJ)/.test(key)){
    tokenHash=null;
    disableForm('O acesso está temporariamente indisponível. Entre em contato com o suporte.');
    return;
  }
  if(!tokenHash||tokenHash.length<12||tokenHash.length>2048){
    disableForm('Este link não é válido. Abra o aplicativo e toque em “Esqueci minha senha” para receber um novo e-mail.');
    return;
  }

  async function postJson(endpoint,method,payload,token){
    const headers={apikey:key,'Content-Type':'application/json'};
    headers.Authorization=`Bearer ${token||key}`;
    const response=await fetch(url+endpoint,{
      method,headers,body:JSON.stringify(payload),cache:'no-store',referrerPolicy:'no-referrer',
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error('Falha na validação');
      error.status=response.status;
      error.detail=String(body.msg||body.error_description||body.message||'');
      throw error;
    }
    return body;
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const password=$('password').value;
    if(password.length<10){showMessage('Sua senha deve ter pelo menos 10 caracteres.');return;}
    if(password!==$('confirm-password').value){showMessage('As senhas digitadas não são iguais.');return;}
    submit.disabled=true;
    submit.textContent='Salvando sua senha…';
    feedback.className='status hidden';
    try {
      if(!accessToken){
        const session=await postJson('/auth/v1/verify','POST',{
          token_hash:tokenHash,type:'recovery',
        });
        if(!session?.access_token)throw new Error('Sem sessao');
        accessToken=session.access_token;
        tokenHash=null;
      }
      await postJson('/auth/v1/user','PUT',{
        password,
        data:{must_change_password:false},
      },accessToken);
      $('password').value='';$('confirm-password').value='';
      form.classList.add('hidden');
      $('success').classList.remove('hidden');
      $('title').textContent='Senha criada!';
      $('intro').textContent='Tudo pronto para começar sua rotina de 21 dias.';
      showMessage('Sua senha pessoal está pronta.',false);
      accessToken=null;
    } catch(error){
      if(!accessToken){
        showMessage('Este link expirou, já foi utilizado ou não é válido. Abra o aplicativo e use “Esqueci minha senha” para solicitar outro.');
        form.classList.add('hidden');
      }else{
        showMessage('Não foi possível salvar a senha. Verifique se ela atende às regras de segurança e tente novamente.');
      }
    } finally {
      submit.disabled=false;
      submit.textContent='Criar senha e continuar';
    }
  });
})();
