-- Adicionar coluna scheduled_at na tabela message_campaigns
ALTER TABLE public.message_campaigns 
ADD COLUMN scheduled_at timestamp with time zone DEFAULT NULL;

-- Atualizar constraint de status para incluir 'scheduled'
ALTER TABLE public.message_campaigns 
DROP CONSTRAINT IF EXISTS message_campaigns_status_check;

ALTER TABLE public.message_campaigns 
ADD CONSTRAINT message_campaigns_status_check 
CHECK (status = ANY (ARRAY['pending', 'in_progress', 'completed', 'failed', 'paused', 'cancelled', 'scheduled']));