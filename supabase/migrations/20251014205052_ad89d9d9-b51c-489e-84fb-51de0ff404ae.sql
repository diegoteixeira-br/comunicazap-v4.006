-- Add api_key column to whatsapp_instances table
ALTER TABLE public.whatsapp_instances
ADD COLUMN api_key text;