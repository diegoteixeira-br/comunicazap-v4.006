
# Sistema de Indicação (Referral) - Plano de Implementação

## Resumo da Abordagem
Implementar o sistema de indicação como uma "camada extra" que opera de forma assíncrona, sem modificar os fluxos críticos de pagamento existentes.

## Arquitetura Atual Identificada

```text
+------------------+     +--------------------+     +------------------+
|   Auth.tsx       |---->| create-checkout    |---->| Stripe Checkout  |
|   (Cadastro)     |     | (Edge Function)    |     | (Externo)        |
+------------------+     +--------------------+     +------------------+
                                                           |
                                                           v
+------------------+     +--------------------+     +------------------+
|   Dashboard      |<----| check-subscription |<----| Stripe API       |
|   (Frontend)     |     | (Edge Function)    |     | (Polling)        |
+------------------+     +--------------------+     +------------------+
```

- **Tabelas críticas existentes:** `profiles`, `user_subscriptions`
- **Fluxo de pagamento:** `create-checkout` -> Stripe -> `check-subscription` (polling)
- **Sem webhook atual:** A sincronização ocorre via polling no `check-subscription`

---

## 1. Banco de Dados (Aditivo)

### 1.1 Nova tabela: `referrals`
Tabela isolada para gerenciar todas as indicações:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Chave primária |
| referrer_user_id | uuid | Quem indicou |
| referred_user_id | uuid | Quem foi indicado |
| referral_code | text | Código usado |
| status | text | pending, completed, rewarded |
| created_at | timestamp | Data da indicação |
| completed_at | timestamp | Data do primeiro pagamento |
| referrer_bonus_applied | boolean | Se o bonus foi dado ao indicador |
| referred_bonus_applied | boolean | Se o bonus foi dado ao indicado |

### 1.2 Novo campo na tabela `profiles`
Adicionar campo para armazenar o código de indicação único do usuário:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| referral_code | text (UNIQUE) | Código único de indicação |
| referred_by_code | text | Código de quem indicou este usuário |

### 1.3 Políticas RLS
- Usuários podem ver apenas suas próprias indicações
- Função `apply_referral_bonus` com `SECURITY DEFINER` para adicionar dias

---

## 2. Fluxo de Cadastro (Frontend)

### 2.1 Captura do código via URL
Modificar `Auth.tsx` para:

```text
URL: /auth?mode=signup&ref=ABC123
                         ^^^^^^^^
                         Capturado e salvo
```

**Alterações mínimas:**
1. Ler `searchParams.get('ref')` da URL
2. Armazenar em `localStorage` temporariamente
3. Após cadastro bem-sucedido, salvar no campo `referred_by_code` do perfil

**Importante:** Nenhuma alteração no fluxo de pagamento.

---

## 3. Automação Pós-Pagamento (Stripe Webhook)

### 3.1 Nova Edge Function: `stripe-webhook`
Função isolada que escuta apenas o evento `invoice.payment_succeeded`:

```text
Stripe -----> stripe-webhook -----> Verifica referral -----> Aplica bonus
              (Nova função)         (Consulta DB)            (Se elegível)
```

**Lógica da função:**
1. Validar assinatura do webhook (STRIPE_WEBHOOK_SECRET)
2. Extrair `customer_email` do evento
3. Buscar usuário no banco pelo email
4. Verificar se tem `referred_by_code` no perfil
5. Verificar se é o primeiro pagamento (status era 'trial' ou 'inactive')
6. SE elegível:
   - Adicionar +30 dias ao `current_period_end` do indicado
   - Adicionar +30 dias ao `current_period_end` do indicador
   - Marcar referral como `rewarded`

### 3.2 Segurança
- Verificação de assinatura Stripe obrigatória
- Idempotência via campo `rewarded` (evita bonus duplicado)
- Logs detalhados para auditoria

---

## 4. Interface - Página "Indique e Ganhe"

### 4.1 Nova rota: `/referral`
Página simples com:

```text
+------------------------------------------+
|  Indique e Ganhe                         |
+------------------------------------------+
|  Seu código: [ABC123] [Copiar]           |
|                                          |
|  Link de indicação:                      |
|  [https://...?ref=ABC123] [Copiar]       |
|                                          |
|  Como funciona:                          |
|  1. Compartilhe seu link                 |
|  2. Amigo se cadastra e assina           |
|  3. Vocês dois ganham +30 dias grátis!   |
|                                          |
|  Suas indicações:                        |
|  +--------+----------+--------+          |
|  | Nome   | Status   | Data   |          |
|  +--------+----------+--------+          |
|  | João   | Pendente | 01/02  |          |
|  | Maria  | Recompensado | 28/01 |       |
|  +--------+----------+--------+          |
+------------------------------------------+
```

### 4.2 Geração do código único
- Gerado automaticamente no primeiro acesso à página
- Formato: 6 caracteres alfanuméricos (ex: `ABC123`)
- Salvo no campo `referral_code` do perfil

---

## Resumo Técnico

### Arquivos a criar:
1. `supabase/functions/stripe-webhook/index.ts` - Webhook do Stripe
2. `src/pages/Referral.tsx` - Página de indicações

### Arquivos a modificar (minimamente):
1. `src/pages/Auth.tsx` - Capturar `?ref=` da URL
2. `src/App.tsx` - Adicionar rota `/referral`

### Arquivos NÃO modificados:
- `supabase/functions/create-checkout/index.ts`
- `supabase/functions/check-subscription/index.ts`
- `supabase/functions/customer-portal/index.ts`
- Qualquer lógica de pagamento existente

### Migrações SQL necessárias:
1. Adicionar campos `referral_code` e `referred_by_code` em `profiles`
2. Criar tabela `referrals`
3. Criar função `generate_referral_code()`
4. Criar função `apply_referral_bonus()`
5. Políticas RLS para `referrals`

### Secrets necessários:
- `STRIPE_WEBHOOK_SECRET` - Para validar eventos do Stripe

---

## Fluxo Completo

```text
1. Usuário A compartilha: app.com/auth?mode=signup&ref=ABC123

2. Usuário B clica no link:
   - Auth.tsx captura ref=ABC123
   - Salva em localStorage

3. Usuário B se cadastra:
   - referred_by_code = ABC123 salvo no perfil
   - Referral criado com status 'pending'

4. Usuário B paga normalmente (fluxo existente não alterado)

5. Stripe dispara invoice.payment_succeeded:
   - stripe-webhook recebe evento
   - Verifica elegibilidade
   - Aplica +30 dias para A e B
   - Marca referral como 'rewarded'

6. Usuário A vê na página /referral:
   - "Maria - Recompensado - +30 dias"
```

---

## Considerações de Segurança

1. **Webhook validado:** Assinatura Stripe verificada antes de processar
2. **Idempotência:** Bonus aplicado apenas uma vez por referral
3. **RLS:** Usuários veem apenas suas próprias indicações
4. **Sem modificação crítica:** Checkout e subscription checking intocados
