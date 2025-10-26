-- Feature 1: Criar tabela de contatos
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, phone_number)
);

-- Habilitar RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para contacts
CREATE POLICY "Users can view own contacts"
ON public.contacts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts"
ON public.contacts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
ON public.contacts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts"
ON public.contacts
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_contacts_user_phone ON public.contacts(user_id, phone_number);
CREATE INDEX idx_contacts_user_status ON public.contacts(user_id, status);
CREATE INDEX idx_contacts_tags ON public.contacts USING GIN(tags);

-- Adicionar coluna target_tags em message_campaigns
ALTER TABLE public.message_campaigns
ADD COLUMN target_tags TEXT[] DEFAULT '{}';

-- Feature 2: Adicionar colunas para agente IA em whatsapp_instances
ALTER TABLE public.whatsapp_instances
ADD COLUMN ai_agent_active BOOLEAN DEFAULT false,
ADD COLUMN ai_agent_instructions TEXT;

-- Comentários para documentação
COMMENT ON TABLE public.contacts IS 'Gerenciamento de contatos com tags e status de opt-out';
COMMENT ON COLUMN public.contacts.status IS 'Status do contato: active ou unsubscribed';
COMMENT ON COLUMN public.contacts.tags IS 'Tags para segmentação de campanhas';
COMMENT ON COLUMN public.message_campaigns.target_tags IS 'Tags usadas para filtrar destinatários da campanha';
COMMENT ON COLUMN public.whatsapp_instances.ai_agent_active IS 'Se o agente de IA está ativo para responder mensagens';
COMMENT ON COLUMN public.whatsapp_instances.ai_agent_instructions IS 'Instruções/prompt para o agente de IA';