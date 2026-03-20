# 🚀 Deploy SóMotor — Guia Completo

Login: **usuário:** `prucci` | **senha:** `123456789`

---

## Passo 1 — Banco de dados (Neon) · ~5 min

1. Acesse **[neon.tech](https://neon.tech)** → crie conta → **Create Project**
2. Nome: `somotor` → clique em **Create Project**
3. Na tela seguinte, copie a **Connection String** (começa com `postgres://...`)
   - Guarde essa string, você vai usar no Passo 3

---

## Passo 2 — Subir código no GitHub · ~3 min

```bash
# Na pasta raiz do projeto (onde está este README)
git init
git add .
git commit -m "deploy inicial somotor"

# Crie um repositório no github.com (pode ser privado)
# Depois conecte e faça push:
git remote add origin https://github.com/SEU_USUARIO/somotor.git
git push -u origin main
```

---

## Passo 3 — Backend (Render) · ~5 min

1. Acesse **[render.com](https://render.com)** → crie conta → **New > Web Service**
2. Conecte seu repositório GitHub `somotor`
3. Configure:
   | Campo | Valor |
   |---|---|
   | **Root Directory** | `backend` |
   | **Build Command** | `npm install` |
   | **Start Command** | `node server.js` |
   | **Instance Type** | Free |

4. Em **Environment Variables**, adicione:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | *(cole a connection string do Neon)* |
   | `JWT_SECRET` | *(qualquer string longa, ex: `somotor@2026#segredo`)* |
   | `NODE_ENV` | `production` |
   | `FRONTEND_URL` | *(deixe em branco por agora, preencha depois do Passo 4)* |

5. Clique **Deploy Web Service**
6. Aguarde o deploy (~2 min) e copie a URL gerada:
   `https://somotor-backend.onrender.com`

> ⚠️ No plano gratuito o Render "dorme" após 15 min sem uso.
> O primeiro acesso após inatividade pode demorar ~30s para acordar.

---

## Passo 4 — Frontend (Vercel) · ~3 min

1. Acesse **[vercel.com](https://vercel.com)** → crie conta → **Add New > Project**
2. Importe o repositório `somotor` do GitHub
3. Configure:
   | Campo | Valor |
   |---|---|
   | **Root Directory** | `frontend` |
   | **Framework Preset** | Vite |

4. Em **Environment Variables**, adicione:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://somotor-backend.onrender.com` *(URL do Render)* |

5. Clique **Deploy**
6. Copie a URL gerada: `https://somotor.vercel.app`

---

## Passo 5 — Conectar frontend ↔ backend · ~1 min

1. Volte ao **Render** → seu serviço → **Environment**
2. Adicione/atualize:
   | Key | Value |
   |---|---|
   | `FRONTEND_URL` | `https://somotor.vercel.app` *(URL da Vercel)* |
3. Clique **Save Changes** → o Render vai redeployar automaticamente

---

## ✅ Pronto!

Acesse sua URL da Vercel e faça login:
- **Usuário:** `prucci`
- **Senha:** `123456789`

O banco cria todas as tabelas automaticamente no primeiro boot.

---

## Dicas

- **Ver logs do backend:** Render → seu serviço → aba **Logs**
- **Redeploy manual:** Render → **Manual Deploy > Deploy latest commit**
- **Variáveis de ambiente:** nunca commite o arquivo `.env` no Git
- **Domínio customizado:** Vercel permite adicionar domínio próprio gratuitamente

---

## Estrutura do projeto

```
somotor/
├── backend/          → API Node.js + Express (deploy no Render)
│   ├── server.js
│   ├── db.js
│   ├── routes/
│   └── .env.example  → copie para .env em ambiente local
├── frontend/         → React + Vite (deploy na Vercel)
│   ├── src/
│   └── vercel.json
└── render.yaml       → configuração do Render (opcional)
```
