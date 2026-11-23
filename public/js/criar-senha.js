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
  let verifiedUser=null;

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
        if(!session.user?.id || !session.user?.email)throw new Error('Sem identidade');
        accessToken=session.access_token;
        verifiedUser={id:session.user.id,email:session.user.email};
        tokenHash=null;
      }
      // Confirme a alteracao no Auth antes de declarar sucesso.
      const changed=await postJson('/auth/v1/user','PUT',{
        password,
        data:{must_change_password:false},
      },accessToken);
      if(changed?.id!==verifiedUser.id){
        throw new Error('update_not_confirmed');
      }
      // Teste real de login: se falhar, nao diga ao comprador que a senha funciona.
      const login=await postJson('/auth/v1/token?grant_type=password','POST',{
        email:verifiedUser.email,password,
      });
      if(!login?.access_token || login.user?.id!==verifiedUser.id){
        throw new Error('login_not_confirmed');
      }
      $('password').value='';$('confirm-password').value='';
      form.classList.add('hidden');
      $('success').classList.remove('hidden');
      $('title').textContent='Senha criada!';
      $('intro').textContent='Tudo pronto para começar sua rotina de 21 dias.';
      showMessage('Sua senha pessoal está pronta.',false);
      accessToken=null;
      verifiedUser=null;
    } catch(error){
      if(!accessToken){
        showMessage('Este link expirou, já foi utilizado ou não é válido. Abra o aplicativo e use “Esqueci minha senha” para solicitar outro.');
        form.classList.add('hidden');
      }else{
        if(error?.status===422){
          showMessage('O Supabase não aceitou esta senha. Escolha uma senha diferente, com pelo menos 10 caracteres, e tente novamente.');
        }else if(error?.status===429){
          showMessage('Muitas tentativas seguidas. Aguarde alguns minutos antes de tentar novamente.');
        }else if(error?.message==='login_not_confirmed' || error?.status===400 || error?.status===401 || error?.status===403){
          showMessage('A alteração foi solicitada, mas o login ainda não foi confirmado. Não feche esta tela. Tente novamente ou solicite um novo link. Se persistir, fale com o suporte.');
        }else{
          showMessage('Não foi possível confirmar sua senha neste momento. Verifique sua conexão e tente novamente; se persistir, solicite um novo link.');
        }
      }
    } finally {
      submit.disabled=false;
      submit.textContent='Criar senha e continuar';
    }
  });
})();
