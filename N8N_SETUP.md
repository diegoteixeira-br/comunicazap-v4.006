# Configuração do n8n para Integração com Evolution API

## ✅ Sistema Otimizado com Storage

O sistema agora **salva automaticamente** as imagens/vídeos no Supabase Storage e envia apenas a URL pública para o n8n. Isso resolve problemas de tamanho de payload e melhora a performance!

**Benefícios:**
- ✨ Sem limites de tamanho no webhook
- ⚡ Envios mais rápidos  
- 💾 Arquivos armazenados de forma organizada
- 🔒 URLs públicas seguras

---

## 📢 Suporte a Grupos do WhatsApp

O sistema agora suporta envio de mensagens para grupos do WhatsApp! 

**Como funciona:**
- Os grupos são buscados diretamente da sua conta WhatsApp conectada
- O ID do grupo termina com `@g.us` (ex: `120363123456789@g.us`)
- A Evolution API aceita IDs de grupo da mesma forma que números de contato
- **Nenhuma mudança é necessária no workflow do n8n** - os grupos funcionam automaticamente!

**Para o n8n:**
- Quando é um grupo, o campo `number` conterá o ID completo do grupo (ex: `120363123456789@g.us`)
- A Evolution API detecta automaticamente se é um grupo ou contato individual
- Use exatamente as mesmas configurações de HTTP Request descritas abaixo

---

## Formato do Payload Enviado pelo Sistema

O sistema envia o seguinte JSON para o webhook do n8n:

**Apenas Texto:**
```json
{
  "instanceName": "user-82af4c91-1760496491812",
  "api_key": "EDA20E00-0647-4F30-B239-0D9B5C7FC193",
  "number": "556599999999",
  "text": "Olá João, sua mensagem aqui"
}
```

**Com Imagem ou Vídeo (NOVO FORMATO):**
```json
{
  "instanceName": "user-82af4c91-1760496491812",
  "api_key": "EDA20E00-0647-4F30-B239-0D9B5C7FC193",
  "number": "556599999999",
  "text": "Olá João, sua mensagem aqui",
  "mediaUrl": "https://pxzvpnshhulrsjbeqqhn.supabase.co/storage/v1/object/public/campaign-media/...",
  "mediaType": "image/png"
}
```

**IMPORTANTE:** 
- ✅ **Novo:** Agora o sistema envia a **URL pública** do arquivo em vez de base64!
- O sistema suporta variações de mensagem! O campo `text` já vem personalizado.
- O sistema suporta imagens e vídeos até 50MB
- Quando há mídia, o campo `mediaUrl` contém a URL pública do arquivo no Supabase Storage
- O campo `mediaType` contém o tipo MIME correto (ex: `image/png`, `image/jpeg`, `video/mp4`)
- Para envios com mídia, você precisa usar o endpoint `/message/sendMedia/` ao invés de `/message/sendText/`

## Configuração do HTTP Request no n8n

### ⚠️ RECOMENDADO: Use um Nó IF para separar Texto e Mídia

O ideal é criar um workflow com um nó IF que verifica se há mídia:

1. **Webhook** (recebe o payload)
2. **IF** (verifica se `{{ $json.body.mediaUrl }}` existe)
   - Se SIM → vai para "HTTP Request - Enviar Mídia"
   - Se NÃO → vai para "HTTP Request - Enviar Texto"

### Configuração: HTTP Request - Enviar TEXTO (quando não há imagem)

#### 1. Método
- **POST**

#### 2. URL
```
http://evolution:8080/message/sendText/{{ $json.body.instanceName }}
```

#### 3. Authentication
- **None** (usaremos header customizado)

#### 4. Headers
| Name | Value |
|------|-------|
| apikey | `{{ $json.body.api_key }}` |

#### 5. Body (JSON)
```json
{
  "number": "{{ $json.body.number }}",
  "text": "{{ $json.body.text }}"
}
```

#### 6. Options
- Body Content Type: **application/json**

---

### Configuração: HTTP Request - Enviar MÍDIA (quando há imagem/vídeo)

#### 1. Método
- **POST**

#### 2. URL
```
http://evolution:8080/message/sendMedia/{{ $json.body.instanceName }}
```

#### 3. Authentication
- **None** (usaremos header customizado)

#### 4. Headers
| Name | Value |
|------|-------|
| apikey | `{{ $json.body.api_key }}` |

#### 5. Body (JSON)

**NOVO FORMATO - Agora usa URL direta do arquivo:**

```json
{
  "number": "{{ $json.body.number }}",
  "mediatype": "image",
  "mimetype": "{{ $json.body.mediaType }}",
  "media": "{{ $json.body.mediaUrl }}",
  "caption": "{{ $json.body.text }}"
}
```

**Explicação:**
- `mediatype`: Pode ser `"image"` ou `"video"` (use `"image"` que funciona para ambos)
- `mimetype`: O tipo MIME correto do arquivo (ex: `image/png`, `image/jpeg`, `video/mp4`)
- `media`: Agora recebe diretamente a **URL pública** do arquivo
- `caption`: O texto da mensagem
- ✅ **Vantagem:** Sem problemas de tamanho de payload e tipo MIME correto!

#### 6. Options
- Body Content Type: **application/json**

---

### Configuração Alternativa (SE não quiser usar IF)

Se você não quiser usar o nó IF, configure apenas um HTTP Request que sempre usa `/sendMedia/`:

```json
{
  "number": "{{ $json.body.number }}",
  "mediatype": "{{ $json.body.mediaUrl ? 'image' : undefined }}",
  "mimetype": "{{ $json.body.mediaType }}",
  "media": "{{ $json.body.mediaUrl ? $json.body.mediaUrl : undefined }}",
  "caption": "{{ $json.body.text }}"
}
```

**ATENÇÃO:** Esta configuração pode não funcionar bem quando não há mídia. Por isso, recomendamos usar o nó IF.

## Sistema de Variações de Mensagem

### Como Funciona:

1. O usuário cria até 3 variações diferentes da mesma mensagem no frontend
2. O sistema alterna automaticamente entre as variações:
   - Cliente 1 → Variação 1
   - Cliente 2 → Variação 2
   - Cliente 3 → Variação 3
   - Cliente 4 → Variação 1 (volta ao início)
   - E assim por diante...
3. O campo `text` já chega no n8n com a variação correta e personalizada

### Por que usar variações?

- **Anti-Banimento:** Evita que o WhatsApp detecte envio da mesma mensagem repetidas vezes
- **Parece mais humano:** Cada cliente recebe uma mensagem ligeiramente diferente
- **Automático:** O sistema gerencia tudo, você só configura uma vez no n8n

## Sistema de Bloqueio (Opt-Out)

O sistema agora possui proteção contra banimento através de lista de bloqueio. Veja o arquivo `OPT_OUT_SETUP.md` para configurar o webhook que processa quando clientes pedem para sair.

## Verificação

Após configurar, teste com o seguinte payload de exemplo:

```json
{
  "instanceName": "user-test-123",
  "api_key": "sua-api-key-aqui",
  "number": "5565999999999",
  "text": "Mensagem de teste"
}
```

## Troubleshooting

### Erro ao fazer upload de mídia

**Problema:** Falha ao salvar arquivo no Supabase Storage

**Solução:** 
1. Verifique se o bucket "campaign-media" existe no Supabase
2. Confirme que o bucket está configurado como público
3. Verifique os logs da edge function para mais detalhes

### Erro 400 "Bad Request - instance requires property 'text'"

Isso acontece quando o formato do body JSON não está correto. Verifique:

1. O formato do body está **exatamente** como especificado acima
2. Os campos `number` e `text` estão no nível correto do JSON
3. Não há campos extras ou faltando

### Erro 401 "Unauthorized"

Isso acontece quando a apikey não está correta:

1. Verifique se o header `apikey` está configurado
2. Verifique se está usando `{{ $json.body.api_key }}` corretamente
3. Confirme que a api_key no banco de dados está correta

### Teste Manual da Evolution API

Você pode testar diretamente com curl:

```bash
curl -X POST \
  http://evolution:8080/message/sendText/user-82af4c91-1760496491812 \
  -H 'apikey: EDA20E00-0647-4F30-B239-0D9B5C7FC193' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5565999999999",
    "text": "Teste de mensagem"
  }'
```

## Formato Alternativo (se o primeiro não funcionar)

Caso a Evolution API exija um formato diferente, tente:

```json
{
  "number": "{{ $json.body.number }}",
  "options": {
    "delay": 1200,
    "presence": "composing"
  },
  "textMessage": {
    "text": "{{ $json.body.text }}"
  }
}
```
