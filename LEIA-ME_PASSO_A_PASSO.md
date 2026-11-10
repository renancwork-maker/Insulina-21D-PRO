# Clube do Segredo — acesso automático após pagamento (Wiapy + Netlify + Supabase)

Este ZIP foi gerado a partir do `APP.zip` enviado. **Ainda exige configuração de contas suas**: não existem chaves Supabase nem token Wiapy no projeto.

## Como a integração funciona

1. Cliente informa o e-mail no checkout Wiapy.
2. A Wiapy envia uma requisição `POST` ao endereço `https://SEU-SITE.netlify.app/api/wiapy-webhook` com um cabeçalho `Authorization` configurado por você.
3. A Netlify Function verifica o token, o `checkout.id` autorizado e `payment.status === "paid"`.
4. A função usa a chave secreta *somente no servidor* para criar a conta do e-mail em Supabase Auth, com a senha inicial configurada em `INITIAL_ACCESS_PASSWORD`, e marca o perfil como `premium`, `active=true`.
5. A pessoa entra no app com e-mail e senha inicial, e o app pede que crie uma senha pessoal. Depois, pode clicar em **Esqueci minha senha** para trocar via e-mail.
6. Estornos/chargebacks do mesmo pagamento revogam o acesso caso não haja outra compra ativa do cliente.

**Segurança:** uma senha inicial **igual para todos** não é recomendada. Qualquer pessoa que souber um e-mail de comprador e a senha compartilhada poderá tentar acessar a conta antes da troca. Para operação real, o mais seguro é criar uma senha aleatória por usuário ou enviar um convite de ativação individual por e-mail. Este ZIP atende ao pedido de senha inicial configurável, mas essa estratégia tem risco residual mesmo com troca no primeiro acesso.

## ETAPA 1 — Criar projeto no Supabase

1. Acesse https://supabase.com/dashboard → **New project**.
2. Nome sugerido: `insulina-21-dias-app`. Selecione sua organização, região e uma senha forte para o banco (NÃO é a senha de acesso de compradores).
3. Quando o projeto estiver pronto, abra **SQL Editor** → **New query**.
4. Abra `01_CONFIGURAR_SUPABASE.sql` (arquivo deste ZIP), cole seu conteúdo e execute **Run**.
5. Em **Table Editor**, devem aparecer `profiles`, `wiapy_transactions`, `progress`, `favorites`, `checkins` e `acessos`.
6. Em **Authentication → Providers → Email**, deixe habilitado login por e-mail/senha. Como o cadastro do comprador ocorrerá apenas no servidor, desative a criação pública de usuários se a sua configuração oferecer essa opção; as contas novas criadas de outra forma ficam inativas pelo SQL.

## ETAPA 2 — Chaves do Supabase

No Supabase, procure **Project Settings → API Keys** ou **Connect**:

- `Project URL`: `https://SEU-PROJETO.supabase.co` (pode ser usado no browser).
- `Publishable key` (`sb_publishable_...`) ou `anon public` legado (pode ser usado no browser).
- `service_role` **secret key** / chave secreta de serviço: somente nas variáveis Netlify, NUNCA no HTML/JS ou no GitHub.

No arquivo **`public/js/config.js`**, preencha apenas os dois primeiros valores:

```js
window.APP_SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
window.APP_SUPABASE_ANON_KEY = "sb_publishable_SUA_CHAVE_PUBLICA";
```

**Sem isso, o aplicativo mostra uma tela de “Configuração pendente” — por segurança, o modo demo foi desativado.**

## ETAPA 3 — Email e URLs no Supabase

1. Abra **Authentication → URL Configuration**.
2. Configure **Site URL** como `https://SEU-SITE.netlify.app` (troque pelo endereço REAL do seu projeto).
3. Adicione `https://SEU-SITE.netlify.app/recuperar` em **Redirect URLs**.
4. Em **Authentication → Providers → Email**, mantenha o login por e-mail/senha ativo.
5. Em **Authentication → SMTP Settings**, conecte um serviço SMTP próprio antes de aceitar clientes reais. O e-mail de recuperação não depende da função Wiapy; é enviado pelo Supabase. O serviço padrão possui limites baixos.

O webhook cria contas usando `email_confirm: true` para que a compra aprovada possa liberar o acesso. Como a confirmação do comprador é feita pelo webhook, a qualidade do e-mail recebido da Wiapy é essencial.

## ETAPA 4 — Publicar este projeto na Netlify com funções

**ATENÇÃO: NÃO basta arrastar o ZIP para Netlify Drop.** Esse modo manual publica os arquivos estáticos, mas **não publica as Netlify Functions do código-fonte**. Para o webhook funcionar, use um repositório Git (GitHub, GitLab etc.) conectado à Netlify ou a Netlify CLI configurada.

Caminho mais simples:
1. Extraia este ZIP.
2. Coloque o conteúdo da pasta `Clube_do_Segredo_Wiapy_Supabase_Netlify` em um **novo repositório GitHub privado**, sem colocar senhas ou chaves secretas nos arquivos.
3. Abra https://app.netlify.com e selecione **Add new project → Import an existing project**.
4. Escolha o repositório e configure:
   - **Base directory:** vazio
   - **Build command:** vazio (o Netlify instala as dependências do `package.json`)
   - **Publish directory:** `public` (já definido no `netlify.toml`)
   - **Functions directory:** `netlify/functions` (já definido no `netlify.toml`)
5. Faça o primeiro deploy. Quando terminar, copie sua URL `.netlify.app`.
6. Atualize o endereço no Supabase (**Etapa 3**) para sua URL definitiva.

## ETAPA 5 — Variáveis de ambiente no painel Netlify

No projeto publicado, abra **Project configuration → Environment variables** e adicione:

| Nome | Valor | Onde obter |
| --- | --- | --- |
| `SUPABASE_URL` | `https://SEU-PROJETO.supabase.co` | Supabase → API/Connect |
| `SUPABASE_SERVICE_ROLE_KEY` | Sua chave secreta `service_role` (ou chave secreta apropriada com acesso admin) | Supabase → API Keys |
| `WIAPY_WEBHOOK_TOKEN` | Crie um token aleatório longo, por exemplo 48+ caracteres | Você cria; igual na Wiapy |
| `WIAPY_ALLOWED_CHECKOUT_IDS` | O ID **real** do checkout da Wiapy, não a parte final do link público | Campo `checkout.id` no webhook ou no painel |
| `INITIAL_ACCESS_PASSWORD` | `insulina123@` | Senha inicial solicitada; variável de servidor |
| `WIAPY_EXPECTED_AMOUNT_CENTS` | `6700` (opcional, apenas se todas as compras desse checkout custarem R$ 67 sem cupom) | Preço em centavos |

Se houver vários checkouts que devem liberar o mesmo app, em `WIAPY_ALLOWED_CHECKOUT_IDS` informe os IDs separados por vírgula.

**Nunca** coloque `SUPABASE_SERVICE_ROLE_KEY` no `public/js/config.js`, no GitHub ou em mensagens públicas. Garanta que as variáveis fiquem disponíveis para **Functions**, salve e faça **novo deploy**.

## ETAPA 6 — Criar o webhook na Wiapy

1. Entre na sua conta de produtor da Wiapy.
2. Vá para **Integrações → Webhook** (conforme a documentação oficial).
3. Selecione o checkout/produto que entrega o acesso.
4. **URL de destino**: `https://SEU-SITE.netlify.app/api/wiapy-webhook`.
5. **Token de autenticação**: o mesmo valor de `WIAPY_WEBHOOK_TOKEN`, sem adicionar `Bearer` (Wiapy envia o valor bruto no `Authorization`).
6. Ative os eventos **Pagamento Aprovado** e, se disponíveis, **Pagamento Estornado** / **Chargeback**. Salve.
7. A função exige `payment.status = "paid"` e um `checkout.id` permitido. Outros eventos não criam usuário.

A documentação oficial descreve `payment.id`, `payment.status`, `customer.email` e `checkout.id`:
https://help.wiapy.com/pt-br/article/webhook-jtggmu/

**Importante:** o ID do checkout para a variável `WIAPY_ALLOWED_CHECKOUT_IDS` é o valor no JSON `checkout.id` (por exemplo `66e...`), **não** o slug `v9cVKwDK5_GC` da URL de compra. Não suponha que sejam o mesmo.

## ETAPA 7 — Entregar o link de acesso ao comprador

Configure o produto na Wiapy para enviar, depois do pagamento aprovado, o link real da sua área:

`https://SEU-SITE.netlify.app/`

Oriente a pessoa a informar o mesmo e-mail utilizado na compra e a senha provisória `insulina123@`. No primeiro acesso ela será orientada a definir uma senha pessoal. Se preferir não distribuir a senha comum, oriente a entrar em **Esqueci minha senha** e utilizar o link individual enviado pelo Supabase.

**O webhook não envia e-mail sozinho**; ele cria ou atualiza a conta. Envio de credenciais por e-mail/WhatsApp deve ser configurado separadamente na Wiapy ou outro serviço. Para recuperar senha, configure SMTP no Supabase.

## ETAPA 8 — Testar antes de vender

1. Abra seu site Netlify e confirme que aparece o formulário **E-mail utilizado na compra** e **Sua senha**.
2. Faça uma compra de teste de verdade no checkout correto com um e-mail de teste que você controla, ou use um ambiente de testes oficial da Wiapy, se houver.
3. No **Supabase → Authentication → Users**, verifique se a pessoa apareceu.
4. No **Table Editor → profiles**, confirme `active = true`, `plan = premium`.
5. No **Table Editor → wiapy_transactions**, veja a transação aprovada.
6. No app, faça login com o e-mail da compra e `insulina123@` e crie uma senha pessoal.
7. Saia e entre novamente com a senha pessoal.
8. Clique em **Esqueci minha senha** para conferir o recebimento e a recuperação por e-mail.
9. Em **Netlify → Logs → Functions**, veja erros de execução, sem compartilhar tokens ou chaves.
10. Valide que pagamentos pendentes/recusados não criam acesso. Para testar estorno, use somente cenário autorizado e verifique se o perfil foi desativado quando não existir outra compra paga.

## Diagnóstico rápido

| Sintoma | Verifique |
| --- | --- |
| “Configuração pendente” | `public/js/config.js` não foi preenchido, ou as chaves não são públicas válidas. |
| Tela abre mas não entra | E-mail do checkout, senha, linha em `profiles` e `active = true`. |
| `404` em `/api/wiapy-webhook` | Deploy feito com Netlify Drop; precisa publicar Functions via Git/CLI. |
| `401 not_authorized` no webhook | `Authorization` da Wiapy diferente do `WIAPY_WEBHOOK_TOKEN`. |
| `503 not_configured` | Uma variável obrigatória da Netlify está ausente, ou não está no escopo Functions. |
| `200 ignored: other_checkout` | `WIAPY_ALLOWED_CHECKOUT_IDS` não coincide com `checkout.id`. |
| `500 processing_failed` | Consulte os logs da Netlify; confirme SQL, service_role e autenticação Supabase. |
| “Esqueci minha senha” não chega | URL Redirect ou SMTP no Supabase. |

## Observações importantes

- Este ZIP **não inclui contas reais, banco Supabase ou uma conexão Wiapy já autorizada**; são recursos que precisam ser configurados nos seus painéis.
- O teste local de **login e compra reais** não é possível sem seus dados e eventos de pagamento. O endpoint e código foram preparados, mas a integração de produção deve ser testada.
- Os arquivos estáticos React do aplicativo continuam publicamente acessíveis como arquivos de frontend, mesmo que as páginas mostrem login. Se conteúdo premium altamente confidencial for adicionado, entregue esse conteúdo por API autenticada ou links assinados, não como assets públicos.
- Não envie dados pessoais de compradores nem segredos para suporte público.
