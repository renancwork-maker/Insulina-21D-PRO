(() => {
  'use strict';
  const form = document.getElementById('recovery-form');
  const button = document.getElementById('send-button');
  const errorBox = document.getElementById('error');
  const emailInput = document.getElementById('email');
  const formView = document.getElementById('form-view');
  const successView = document.getElementById('success-view');
  const errorMessage = message => { errorBox.textContent = message; errorBox.classList.remove('hidden'); };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    errorBox.classList.add('hidden');
    button.disabled = true;
    button.textContent = 'Enviando...';
    try {
      const response = await fetch('/api/solicitar-senha', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: emailInput.value.trim().toLowerCase()})
      });
      if (!response.ok) throw new Error('unavailable');
      formView.classList.add('hidden');
      successView.classList.remove('hidden');
      document.title = 'Confira seu spam | Clube do Segredo';
    } catch {
      errorMessage('Não foi possível solicitar seu link agora. Tente novamente em alguns instantes ou fale com nosso suporte.');
    } finally {
      button.disabled = false;
      button.textContent = 'Enviar link para criar minha senha';
    }
  });
  document.getElementById('retry').addEventListener('click', () => {
    successView.classList.add('hidden');
    formView.classList.remove('hidden');
    emailInput.focus();
  });
})();
