# Checklist de despliegue público

Este documento lo prepara el agente; **las acciones en los paneles externos las
hace el usuario**. El código y los workflows ya están listos en el repo
(`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `vercel.json`,
`/api/health`); esto es la lista de lo que falta hacer fuera del código, en
este orden.

Dominio de producción: **`lottery.jpavon-tech.com`**. Stripe en **modo test**
en todos los entornos (proyecto de portafolio, nadie paga dinero real).

- [ ] **1. GitHub — repo y push mirroring desde GitLab**
  - [ ] Crear el repo vacío en GitHub: `<owner/repo>` *(pendiente de definir — reemplazar aquí y en el badge del README cuando exista)*.
  - [ ] En GitLab: **Settings → Repository → Mirroring repositories**, agregar la URL del repo de GitHub con un token de GitHub con permiso de escritura (`repo`).
  - [ ] Verificar que un push a GitLab aparece en GitHub y dispara `ci.yml` (pestaña Actions).
  - [ ] Confirmar que GitHub **no** tiene reglas de protección de rama con checks obligatorios en `main` (bloquearían los pushes del mirror).

- [ ] **2. MongoDB Atlas (cluster existente)**
  - [ ] Crear un usuario de base de datos exclusivo con rol `readWrite` **solo** sobre `lottery` y `lottery_preview`.
  - [ ] Network Access → permitir `0.0.0.0/0` (Vercel no tiene IPs fijas en planes estándar; la protección recae en usuario/contraseña robustos).
  - [ ] Construir `MONGODB_URI` (`mongodb+srv://usuario:contraseña@cluster.mongodb.net`) **sin** el nombre de la BD en la ruta; el nombre va aparte en `MONGODB_DB`.
  - [ ] Ejecutar `npm run db:indexes` localmente apuntando a cada BD (`MONGODB_DB=lottery` y luego `MONGODB_DB=lottery_preview`) para crear los índices. **No ejecutar ningún seed contra Atlas.**
  - [ ] Confirmar que el admin se obtiene por `ADMIN_EMAIL` al iniciar sesión (bootstrap automático, sin seed).

- [ ] **3. Vercel**
  - [ ] Crear el proyecto importando el repo de GitHub.
  - [ ] `vercel link` localmente y tomar `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` de `.vercel/project.json`.
  - [ ] Crear un token de Vercel para CI.
  - [ ] Cargar variables de entorno:
    - **Production**: `APP_URL=https://lottery.jpavon-tech.com`, `MONGODB_DB=lottery`
    - **Preview**: `APP_URL=<url de preview>`, `MONGODB_DB=lottery_preview`
    - **Ambos**: `MONGODB_URI`, `JWT_SECRET` (uno distinto por entorno, ≥32 caracteres), `ADMIN_EMAIL`, `STRIPE_SECRET_KEY` (test), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test), `STRIPE_CURRENCY=mxn`, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM=Lottery <no-reply@mail.jpavon-tech.com>`
    - `STRIPE_WEBHOOK_SECRET` se añade en el paso 6.
  - [ ] Confirmar que `vercel.json` (`"git": { "deploymentEnabled": false }`) está en el repo antes del primer import, para que Vercel **no** despliegue solo con el push del mirror.
  - [ ] Cargar `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` como **GitHub Secrets** (los usa `deploy.yml`).
  - [ ] Cargar `STRIPE_SECRET_KEY` (test) como GitHub Secret (lo usa `ci.yml` para el job `e2e`, que crea Checkout Sessions reales aunque simule la confirmación del pago).

- [ ] **4. Dominio (Vercel + Cloudflare)**
  - [ ] En Vercel: añadir el dominio `lottery.jpavon-tech.com` al proyecto.
  - [ ] En Cloudflare DNS: crear el CNAME `lottery` apuntando al destino que indique Vercel, en modo **DNS only (nube gris)** para que Vercel pueda emitir el certificado SSL.
  - [ ] Esperar a que Vercel marque el dominio como válido.

- [ ] **5. Resend (email de producción)**
  - [ ] Crear y verificar el subdominio de envío `mail.jpavon-tech.com` en Resend.
  - [ ] En Cloudflare, añadir los registros SPF, DKIM y MX de retorno que indique Resend, todos en modo **DNS only**.
  - [ ] Remitente final: `Lottery <no-reply@mail.jpavon-tech.com>`.
  - [ ] Guardar `RESEND_API_KEY` en Vercel (Production y Preview) y confirmar `EMAIL_PROVIDER=resend` en ambos.

- [ ] **6. Stripe (modo test)**
  - [ ] Crear el endpoint de webhook `https://lottery.jpavon-tech.com/api/stripe/webhook` con el evento `checkout.session.completed`.
  - [ ] Copiar el `whsec_...` generado a `STRIPE_WEBHOOK_SECRET` en Vercel **Production** (las previews no reciben webhooks de Stripe; está bien, no hace falta configurarlo ahí).
  - [ ] Redesplegar producción tras guardar la variable.

- [ ] **7. Primer despliegue**
  - [ ] Push a `main` en GitLab → mirror a GitHub → `ci.yml` en verde → `deploy.yml` se dispara automáticamente → producción actualizada.
  - [ ] Verificar en la pestaña Actions de GitHub que ambos workflows terminaron en verde.

---

## Verificación en producción (Fase 12)

- [ ] `GET https://lottery.jpavon-tech.com/api/health` responde `{ "status": "ok" }`.
- [ ] Login por magic link real: el correo llega vía Resend a una cuenta real.
- [ ] Compra con la tarjeta de prueba `4242 4242 4242 4242` (fecha futura cualquiera, CVC cualquiera).
- [ ] El webhook aparece como entregado (200) en el panel de Stripe (Developers → Webhooks).
- [ ] El boleto aparece en "Mis boletos".
- [ ] El admin ejecuta el sorteo y el resultado se ve correctamente.
- [ ] Solo cuando **todo** lo anterior pasa: actualizar `README.md` (en GitLab, la fuente) añadiendo **únicamente** la sección "🌐 Despliegue público" indicada en `PROMT.md` — no se modifica el resto del contenido.
