(function(){
'use strict';
const style=document.createElement('style');
style.textContent=`
#cs-recovery-backdrop{position:fixed;inset:0;z-index:2147483600;display:none;align-items:center;justify-content:center;background:rgba(3,20,14,.78);padding:18px}
#cs-recovery-dialog{max-width:435px;width:100%;position:relative;background:#fcf8ee;color:#18382c;border:2px solid #d2b469;border-radius:26px;box-shadow:0 24px 60px rgba(0,0,0,.36);padding:30px 24px;text-align:center;font-family:Poppins,system-ui,sans-serif}
#cs-recovery-dialog h2{font-weight:800;font-size:24px;line-height:1.22;margin:12px 0;color:#173e2e}
#cs-recovery-dialog p{font-size:14px;line-height:1.55;margin:12px 0;color:#385446}
#cs-recovery-dialog .cs-email{font-size:14px;font-weight:700;padding:11px 8px;background:#ede6d3;border-radius:10px;overflow-wrap:anywhere}
#cs-recovery-dialog .cs-important{font-size:15px;font-weight:800;color:#a16812}
#cs-recovery-dialog button{margin-top:12px;border:0;border-radius:13px;background:#184634;color:#fff;font-size:15px;font-weight:700;padding:13px 25px;width:100%;cursor:pointer}
`;document.head.appendChild(style);
const backdrop=document.createElement('div');backdrop.id='cs-recovery-backdrop';backdrop.setAttribute('role','presentation');
backdrop.innerHTML='<section id="cs-recovery-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cs-recovery-title" aria-describedby="cs-recovery-desc" tabindex="-1"><div style="font-size:42px">✉️</div><h2 id="cs-recovery-title">Confira sua caixa de SPAM!</h2><p id="cs-recovery-desc">Se seu e-mail estiver cadastrado, o link de redefinição será enviado. <strong>Procure também em Spam / Lixo eletrônico</strong>, pois a mensagem pode chegar lá.</p><p class="cs-important">Procure pelo remetente:</p><div class="cs-email">Clube do Segredo<br>acesso@digitalco.site</div><p>Se não encontrar, confira também sua caixa de entrada e aguarde alguns minutos.</p><button type="button" id="cs-recovery-ok">Entendi, vou verificar</button></section>';
document.body.appendChild(backdrop);
const close=()=>{backdrop.style.display='none';};
backdrop.querySelector('#cs-recovery-ok').addEventListener('click',close);
backdrop.addEventListener('click',e=>{if(e.target===backdrop)close();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&backdrop.style.display==='flex')close();});
window.addEventListener('clube:password-reset-requested',()=>{backdrop.style.display='flex';backdrop.querySelector('#cs-recovery-dialog').focus();});
})();
