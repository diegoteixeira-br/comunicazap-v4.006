-- Corrige a função para evitar erros de duplicate key durante signup
CREATE OR REPLACE FUNCTION public.create_trial_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Inserir trial apenas se não existir registro para este usuário
  INSERT INTO public.user_subscriptions (
    user_id,
    status,
    trial_active,
    trial_ends_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    'trial',
    true,
    NOW() + INTERVAL '7 days',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;