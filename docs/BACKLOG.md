# Backlog — Integración Lobster Cash + Multi-plataforma

> **Proyecto:** `crossmint-checkout` MCP Server
> **Fecha:** 2026-06-22
> **Estado:** Planificación

---

## Objetivo

Extender el MCP server de Crossmint Checkout para:
1. Integrar **Lobster Cash** como método de pago alternativo (tarjetas virtuales + wallet crypto)
2. Soportar **checkouts multi-plataforma** que requieren login/registro antes del pago
3. Mantener el basket como centro de decisión pre-checkout neutral

---

## Arquitectura objetivo

```
┌──────────────────────────────────────────────────────┐
│                    MCP Server                         │
│                                                       │
│  ┌──────────┐  ┌───────────┐  ┌───────────────────┐  │
│  │  Basket   │  │ Crossmint │  │  Lobster Cash     │  │
│  │  Tools    │  │ Checkout  │  │  Tools (nuevo)    │  │
│  │ (existe)  │  │ (existe)  │  │                   │  │
│  └────┬─────┘  └─────┬─────┘  └────────┬──────────┘  │
│       │              │                  │              │
│  ┌────┴──────────────┴──────────────────┴──────────┐  │
│  │              Basket Store (JSON)                  │  │
│  │  + Session Store (nuevo)                         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Basket Viewer (HTTP)                  │  │
│  │  + Session badges, payment method indicators      │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## Épica 1: Modelo de checkout extendido (schema + store)

### Historia 1.1 — Extender `CheckoutSchema` con metadatos de plataforma

**Archivo:** `src/basket/schema.ts`

Añadir al tipo `CheckoutSchema`:

```typescript
export const PlatformSessionSchema = z.object({
  domain: z.string().describe("Merchant domain requiring login (namecheap.com, united.com)"),
  status: z.enum(["none", "needs_account", "needs_login", "logged_in"]).default("none"),
  method: z.enum(["username_password", "oauth_google", "oauth_github", "sso", "magic_link", "api_key", "none"]).default("none"),
  email: z.string().email().optional(),
  notes: z.string().optional(),
  lastVerified: z.string().optional(),
}).passthrough();

export const CheckoutSchema = z.object({
  provider: z.enum([
    "crossmint",        // API directa de Crossmint (Amazon/Shopify)
    "lobstercash_card", // Tarjeta virtual Lobster Cash + browser
    "lobstercash_crypto", // Wallet crypto + x402
    "merchant",         // Checkout nativo del merchant
    "manual",           // El humano hace el checkout
    "unknown"
  ]).optional(),
  locator: z.string().optional(),
  supported: z.boolean().optional(),
  readiness: z.enum([
    "missing_locator",
    "needs_validation",
    "needs_session",     // NUEVO: requiere login/registro primero
    "needs_approval",    // NUEVO: esperando aprobación humana (card request)
    "ready",
    "blocked",
    "unknown"
  ]).optional(),
  orderId: z.string().optional(),
  lastCheckedAt: z.string().optional(),

  // NUEVOS CAMPOS
  requiresAuth: z.boolean().default(false).describe("Does this purchase require login/registration?"),
  sessionDomain: z.string().optional().describe("Domain that needs a session (for session store lookup)"),
  authType: z.enum(["login", "register", "guest", "unknown"]).default("unknown"),
  guestCheckoutAvailable: z.boolean().optional(),
  notes: z.string().optional(),
}).passthrough();
```

**Criterios de aceptación:**
- [ ] `requiresAuth: true` activa readiness `needs_session`
- [ ] `sessionDomain` permite lookup en el nuevo `SessionStore`
- [ ] Compatible hacia atrás: los items existentes sin estos campos siguen funcionando
- [ ] Tests de parseo con Zod

### Historia 1.2 — Nuevo `PlatformCheckoutInfo` en `ProductSnapshot`

Añadir metadatos de checkout detectables en el producto:

```typescript
// Extensión de ProductSnapshotSchema (campo opcional nuevo)
platformCheckout: z.object({
  guestCheckout: z.boolean().optional(),
  authRequired: z.boolean().optional(),
  supportedPaymentMethods: z.array(z.enum([
    "credit_card", "debit_card", "paypal", "apple_pay", 
    "google_pay", "crypto", "bank_transfer"
  ])).optional(),
  checkoutUrl: z.string().url().optional(),
  cartPersistence: z.enum(["session", "account", "url", "none"]).optional(),
}).optional(),
```

**Criterios de aceptación:**
- [ ] Campo opcional en `ProductSnapshotSchema`
- [ ] El tool `basket-detect-checkout` rellena esto automáticamente

### Historia 1.3 — `SessionStore` para persistir sesiones por dominio

**Archivo:** `src/sessions/store.ts` (nuevo)

```typescript
export class SessionStore {
  private filePath: string; // ~/.crossmint-agent-basket/sessions.json
  
  async load(): Promise<Record<string, PlatformSession>>
  async save(sessions: Record<string, PlatformSession>): Promise<void>
  async getSession(domain: string): Promise<PlatformSession | null>
  async setSession(domain: string, session: PlatformSession): Promise<void>
  async deleteSession(domain: string): Promise<boolean>
  async listSessions(): Promise<Record<string, PlatformSession>>
}
```

**Criterios de aceptación:**
- [ ] Persistencia JSON atómica (tmp + rename, igual que BasketStore)
- [ ] Clave primaria: dominio normalizado (ej: `namecheap.com`)
- [ ] No almacena contraseñas ni secretos — solo metadatos de estado
- [ ] Directorio `~/.crossmint-agent-basket/` se crea automáticamente
- [ ] Compatible con el .gitignore existente

---

## Épica 2: Tools de sesión y detección de plataforma

### Historia 2.1 — `basket-detect-checkout-requirements`

Analiza un item del basket y determina qué necesita para el checkout.

```
Tool: basket-detect-checkout-requirements
Input:  { itemId: string }
Output: {
  item: compactItem,
  checkoutRequirements: {
    provider: "crossmint" | "lobstercash_card" | "lobstercash_crypto" | "manual",
    authRequired: boolean,
    authType: "login" | "register" | "guest" | "unknown",
    guestCheckoutAvailable: boolean | null,
    sessionStatus: "none" | "logged_in" | "needs_login" | "needs_account",
    knownSession: PlatformSession | null,
    supportedPaymentMethods: string[],
    recommendation: string  // "Use create-order", "Use lobstercash cards request", etc.
  }
}
```

**Lógica de detección:**

| Locator/Source | Provider | Auth |
|----------------|----------|------|
| `amazon:*` | `crossmint` | No |
| `shopify:*` | `crossmint` | No |
| URL genérica + merchant conocido | `lobstercash_card` | Según dominio |
| URL con `/checkout` o `/cart` | `lobstercash_card` | Según dominio |
| API endpoint x402 | `lobstercash_crypto` | No |
| Sin locator claro | `manual` | Desconocido |

**Criterios de aceptación:**
- [ ] Detecta correctamente el provider según el locator/URL
- [ ] Consulta el `SessionStore` para ver si hay sesión activa en ese dominio
- [ ] Actualiza `checkout.provider`, `checkout.requiresAuth`, `checkout.readiness` en el item
- [ ] Si no puede determinar, devuelve `unknown` y pide al agente que investigue

### Historia 2.2 — `basket-set-session`

Registra el estado de sesión para un dominio.

```
Tool: basket-set-session
Input: {
  domain: string,           // "namecheap.com"
  status: "none" | "needs_account" | "needs_login" | "logged_in",
  method?: "username_password" | "oauth_google" | ...,
  email?: string,
  notes?: string
}
Output: { session: PlatformSession, allSessions: Record<string, PlatformSession> }
```

**Criterios de aceptación:**
- [ ] Valida dominio (formato básico)
- [ ] Persiste en SessionStore
- [ ] Si `status: "logged_in"`, actualiza `checkout.readiness` de items con ese `sessionDomain`

### Historia 2.3 — `basket-list-sessions`

Lista todas las sesiones conocidas.

```
Tool: basket-list-sessions
Input: {}
Output: { sessions: Record<string, PlatformSession> }
```

**Criterios de aceptación:**
- [ ] Devuelve todas las sesiones del SessionStore
- [ ] Útil para que el agente sepa qué plataformas ya tienen sesión activa

### Historia 2.4 — Actualizar `basket-upsert-product` con detección automática

Al añadir un producto, si tiene URL, intentar detectar requisitos automáticamente.

**Criterios de aceptación:**
- [ ] Si `product.identifiers.sourceUrl` está presente, ejecutar lógica de detección
- [ ] Rellenar `checkout.provider` y `checkout.requiresAuth` automáticamente
- [ ] No bloquear si falla la detección — usar `unknown`

---

## Épica 3: Integración Lobster Cash CLI

### Historia 3.1 — Módulo `src/lobster.ts`

Wrapper tipado para comandos del CLI `lobstercash`.

```typescript
// src/lobster.ts
import { execSync } from "node:child_process";

export interface LobsterStatus {
  walletConfigured: boolean;
  walletAddress?: string;
  balances?: { token: string; amount: string }[];
  cards?: { id: string; phase: string; mandates: any[] }[];
  hasBrowserAutomation: boolean;
}

export class LobsterCash {
  static isInstalled(): boolean;
  static status(): LobsterStatus;
  static cardsRequest(amount: number, description: string): { approvalUrl: string };
  static cardsList(): { cards: any[] };
  static cardsReveal(cardId: string, merchantName: string, merchantUrl: string, merchantCountry: string): { cardNumber: string; expiry: string; cvc: string };
  static cryptoBalance(): { balances: any[] };
  static cryptoSend(to: string, amount: number, token?: string): { txId: string };
  static cryptoRequest(amount: number, description: string): { approvalUrl: string };
  static x402Fetch(url: string, options?: { method?: string; body?: string; headers?: string[] }): { body: string };
}
```

**Criterios de aceptación:**
- [ ] Todos los métodos devuelven objetos tipados, no strings crudos
- [ ] Manejo de errores: timeout, CLI no instalado, wallet no configurada (exit code 2)
- [ ] `isInstalled()` verifica que `lobstercash` está en PATH
- [ ] No llama al CLI si no está instalado → error descriptivo
- [ ] Timeout configurable por comando (default 30s, `cardsRequest` 60s)

### Historia 3.2 — `lobstercash-status` (MCP tool)

```
Tool: lobstercash-status
Input: {}
Output: LobsterStatus
```

Wrapper de `lobstercash status`. El agente lo usa para decidir si Lobster Cash está disponible.

**Criterios de aceptación:**
- [ ] Si CLI no instalado → `{ available: false, error: "lobstercash CLI not found. Install: npm install -g @crossmint/lobster-cli" }`
- [ ] Si wallet no configurada → `{ walletConfigured: false, nextStep: "Run lobstercash setup or use cards request which bundles setup" }`
- [ ] Si todo OK → devuelve balances, cards, browser status

### Historia 3.3 — `lobstercash-cards-request` (MCP tool)

```
Tool: lobstercash-cards-request
Input: {
  amount: number,
  description: string,
  itemId?: string  // Vincula al basket item
}
Output: {
  approvalUrl: string,
  cardId?: string,
  message: string
}
```

**Criterios de aceptación:**
- [ ] Redondea el amount hacia arriba al $5 más cercano
- [ ] Si `itemId` presente, actualiza `checkout.readiness = "needs_approval"` en el item
- [ ] Devuelve la approvalUrl para que el agente la muestre al humano
- [ ] No hace poll — el humano confirma manualmente

### Historia 3.4 — `lobstercash-cards-reveal` (MCP tool)

```
Tool: lobstercash-cards-reveal
Input: {
  cardId: string,
  merchantName: string,
  merchantUrl: string,
  merchantCountry: string  // ISO 2-letter
}
Output: {
  cardNumber: string,    // ⚠️ Enmascarado en logs: ****1234
  expiryMonth: number,
  expiryYear: number,
  cvc: string
}
```

**Criterios de aceptación:**
- [ ] ⚠️ **SEGURIDAD**: El output del MCP nunca debe loguear el número completo ni el CVC
- [ ] El agente debe usar estos datos solo en el formulario de checkout del merchant
- [ ] Documentar en el tool description: "These credentials are single-use and merchant-locked"

### Historia 3.5 — `lobstercash-crypto-balance` y `lobstercash-crypto-send`

```
Tool: lobstercash-crypto-balance
Input: {}
Output: { balances: { token: string, amount: string }[] }

Tool: lobstercash-crypto-send
Input: { to: string, amount: number, token?: string }
Output: { txId: string, status: string }
```

**Criterios de aceptación:**
- [ ] Verifica que el wallet está configurado antes de enviar
- [ ] Si no hay fondos suficientes, sugiere `lobstercash crypto request`
- [ ] Timeout extendido para `send` (120s) porque espera confirmación on-chain

---

## Épica 4: Flujo de checkout multi-plataforma

### Historia 4.1 — Extender `create-order` con `paymentMethod`

El tool existente `create-order` acepta un nuevo parámetro:

```
Tool: create-order (extendido)
Input: {
  lineItems: [...],
  paymentMethod?: "crossmint" | "lobstercash_card" | "lobstercash_crypto"
    // default: "crossmint"
}
```

**Ruteo según paymentMethod:**

| paymentMethod | Acción |
|---------------|--------|
| `crossmint` | Comportamiento actual (API Crossmint) |
| `lobstercash_card` | Delega a `lobstercash-cards-request` → `cards-reveal` — el agente maneja el browser |
| `lobstercash_crypto` | Delega a `lobstercash crypto send` o `crypto x402 fetch` |

**Criterios de aceptación:**
- [ ] `paymentMethod` por defecto `crossmint` para mantener compatibilidad
- [ ] Si `lobstercash_*` y CLI no instalado → error claro con instrucciones de instalación
- [ ] El tool devuelve instrucciones para el agente sobre próximos pasos (URL de aprobación, credenciales, etc.)

### Historia 4.2 — `basket-checkout` (nuevo tool unificado)

Tool de alto nivel que orquesta el checkout según el provider detectado:

```
Tool: basket-checkout
Input: {
  itemIds?: string[],  // Default: approved + ready_for_checkout
  paymentMethod?: "crossmint" | "lobstercash_card" | "lobstercash_crypto" | "auto",
    // "auto" = usa el provider detectado en cada item
}
Output: {
  results: {
    itemId: string,
    provider: string,
    status: "approved" | "needs_approval" | "needs_session" | "ordered" | "failed",
    details: any
  }[]
}
```

**Flujo para `auto`:**

```
Para cada item:
  1. Leer checkout.provider
  2. Si provider = "crossmint":
     → create-order con lineItems del basket-export
  3. Si provider = "lobstercash_card" && checkout.requiresAuth:
     → Verificar SessionStore
     → Si no hay sesión → readiness = "needs_session", pedir al humano
     → Si hay sesión → cards-request → approval URL
  4. Si provider = "lobstercash_crypto":
     → crypto-balance → si fondos insuficientes → crypto-request
     → crypto-send o x402-fetch
```

**Criterios de aceptación:**
- [ ] Procesa items en lote, pero no en paralelo (evitar race conditions en wallet)
- [ ] Si un item necesita aprobación humana, pausa y notifica — no bloquea los demás
- [ ] Marca items como `ordered` solo tras confirmación exitosa

### Historia 4.3 — Actualizar estados del basket para reflejar progreso real

Nuevos estados o transiciones:

```
candidate → shortlisted → approved → ready_for_checkout
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
            needs_approval        needs_session          ordered
           (card pending)      (login required)      (checkout done)
                    │                    │
                    ▼                    ▼
            ready_for_checkout    ready_for_checkout
```

**Criterios de aceptación:**
- [ ] `needs_approval` se setea al llamar `cards-request` (esperando que el humano apruebe)
- [ ] `needs_session` se setea cuando `requiresAuth: true` y no hay sesión
- [ ] El viewer muestra badges visuales para estos estados

---

## Épica 5: Basket Viewer extendido

### Historia 5.1 — Badges de plataforma y método de pago en el viewer

**Archivo:** `src/basket/viewer-html.ts`

El HTML del viewer muestra para cada item:

| Indicador | Condición | Badge |
|-----------|-----------|-------|
| Provider | `checkout.provider` | 🟢 Crossmint / 🦞 Lobster Card / ₿ Lobster Crypto |
| Auth | `checkout.requiresAuth` | 🔐 Login required / ✅ Guest checkout |
| Session | `checkout.readiness` | 🟢 Ready / 🟡 Needs approval / 🔴 Needs login |
| Guest OK | `guestCheckoutAvailable` | 🟢 Guest available / — |

**Criterios de aceptación:**
- [ ] Badges visibles en la vista de lista del viewer
- [ ] Tooltips explican qué significa cada badge
- [ ] Colores semánticos (verde = listo, amarillo = acción necesaria, rojo = bloqueado)

### Historia 5.2 — Sección de sesiones activas en el viewer

Nueva ruta en el viewer HTTP:

```
GET /api/sessions → { sessions: Record<string, PlatformSession> }
```

El viewer muestra una tabla de sesiones conocidas:

| Domain | Status | Method | Email | Last Verified |
|--------|--------|--------|-------|---------------|
| namecheap.com | ✅ logged_in | oauth_google | user@gmail.com | 2026-06-22 |

**Criterios de aceptación:**
- [ ] Nueva ruta API
- [ ] UI en el viewer HTML
- [ ] Botón "Forget session" (DELETE /api/sessions/:domain)

### Historia 5.3 — Indicador Lobster Cash en el viewer

El viewer detecta si `lobstercash` está instalado y muestra:

- 🟢 Lobster Cash available — wallet: `0x...`, balance: $X USDC
- 🟡 Lobster Cash installed but wallet not configured
- 🔴 Lobster Cash not installed — `npm install -g @crossmint/lobster-cli`

**Criterios de aceptación:**
- [ ] Llama a `lobstercash status` al cargar el viewer
- [ ] Cachea el resultado (5 min TTL) para no spamear el CLI
- [ ] Muestra en la cabecera del viewer

---

## Épica 6: Configuración y setup

### Historia 6.1 — `.env` extendido

Nuevas variables de entorno:

```bash
# Lobster Cash
LOBSTERCASH_ENABLED=true          # false para deshabilitar integración
LOBSTERCASH_SERVER_URL=https://www.lobster.cash  # default
LOBSTERCASH_TIMEOUT=30000         # timeout para comandos CLI (ms)
LOBSTERCASH_BROWSER_MODE=auto     # auto | byo | disabled
```

**Criterios de aceptación:**
- [ ] Si `LOBSTERCASH_ENABLED=false`, todas las tools de lobster devuelven "disabled"
- [ ] `BROWSER_MODE` informa al agente si puede usar `purchase explore/run` o no

### Historia 6.2 — Script `npm run setup-lobster`

```bash
npm run setup-lobster
```

Que ejecuta:
1. Verifica que `lobstercash` está instalado
2. Si no: `npm install -g @crossmint/lobster-cli`
3. `lobstercash agents register --name "MCP Checkout Agent"`
4. `lobstercash setup`
5. Muestra la URL de aprobación

**Criterios de aceptación:**
- [ ] Script en `scripts/setup-lobster.js` o `scripts/setup-lobster.sh`
- [ ] Documentado en README

---

## Épica 7: Documentación y tests

### Historia 7.1 — README actualizado

Secciones nuevas:
- "Lobster Cash Integration" — qué es, cómo instalarlo, qué aporta
- "Multi-Platform Checkout" — cómo maneja logins, sesiones, guest checkout
- "Payment Methods" — tabla comparativa crossmint vs lobstercash_card vs lobstercash_crypto
- "Environment Variables" — actualizado con las nuevas vars

### Historia 7.2 — Tests unitarios

- [ ] `CheckoutSchema` parsea items con y sin campos nuevos
- [ ] `SessionStore` CRUD
- [ ] `LobsterCash` métodos mockeados (sin llamar al CLI real)
- [ ] `basket-detect-checkout-requirements` con diferentes tipos de URL
- [ ] `basket-checkout` ruteo según provider

### Historia 7.3 — Tests de integración

- [ ] Flujo completo: basket → detect → session → cards-request → reveal (mock)
- [ ] Flujo con login: basket → detect → set-session → checkout
- [ ] Viewer HTTP API con los nuevos endpoints

---

## Orden de implementación recomendado

```
Fase 1 (Fundación):      1.1 → 1.2 → 1.3       (Schema + SessionStore)
Fase 2 (Tools sesión):   2.1 → 2.2 → 2.3 → 2.4 (Detección y gestión de sesiones)
Fase 3 (Lobster):        3.1 → 3.2 → 3.3 → 3.4 (Integración CLI)
Fase 4 (Checkout):       4.1 → 4.2 → 4.3       (Flujo unificado)
Fase 5 (Viewer):         5.1 → 5.2 → 5.3       (UI extendida)
Fase 6 (Config):         6.1 → 6.2             (Setup y .env)
Fase 7 (Docs):           7.1 → 7.2 → 7.3       (Documentación y tests)
```

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| `lobstercash` CLI no instalado | Alto — tools no funcionan | `isInstalled()` check + mensaje claro + script de setup |
| Credenciales de tarjeta en logs | Crítico — seguridad | Enmascarar en output del MCP, nunca loguear CVC |
| Sesiones expiran sin que el agente lo sepa | Medio — checkout falla | `lastVerified` timestamp, re-verificar antes de checkout |
| Browser automation no disponible | Medio — no se puede completar checkout | `browser-enabled` flag, fallback a BYO browser o manual |
| Rate limiting en Lobster API | Bajo — comandos fallan | Timeouts generosos, no paralelizar writes |
| Cambios en el CLI de lobstercash | Medio — breaking changes | Version check en startup, documentar versión mínima |
