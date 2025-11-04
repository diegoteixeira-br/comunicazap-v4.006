import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/sessionClient';
import { useAuth } from './useAuth';

interface SubscriptionStatus {
  subscribed: boolean;
  trial_active: boolean;
  trial_days_left: number;
  has_access: boolean;
  status: string;
  loading: boolean;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    trial_active: false,
    trial_days_left: 0,
    has_access: false,
    status: 'inactive',
    loading: true,
  });

  useEffect(() => {
    if (!user) {
      setSubscriptionStatus({
        subscribed: false,
        trial_active: false,
        trial_days_left: 0,
        has_access: false,
        status: 'inactive',
        loading: false,
      });
      return;
    }

    const checkSubscription = async () => {
      try {
        // Força refresh do token antes de verificar
        const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
        
        if (sessionError || !session) {
          console.warn('Sessão inválida, usando fallback direto do banco');
          throw new Error('Sessão inválida');
        }

        const { data, error } = await supabase.functions.invoke('check-subscription', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) throw error;

        setSubscriptionStatus({
          subscribed: data.subscribed || false,
          trial_active: data.trial_active || false,
          trial_days_left: data.trial_days_left || 0,
          has_access: data.has_access || false,
          status: data.status || 'inactive',
          loading: false,
        });
      } catch (error) {
        console.error('Erro ao verificar assinatura via função:', error);
        // Fallback: consultar diretamente o banco
        try {
          const { data: row } = await supabase
            .from('user_subscriptions')
            .select('status, trial_active, trial_ends_at, current_period_end')
            .eq('user_id', user.id)
            .maybeSingle();

          if (row) {
            const trialActive = !!row.trial_active && !!row.trial_ends_at && new Date(row.trial_ends_at) > new Date();
            const trialDaysLeft = trialActive
              ? Math.ceil((new Date(row.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            const subscribed = row.status === 'active' && !!row.current_period_end && new Date(row.current_period_end) > new Date();
            
            setSubscriptionStatus({
              subscribed,
              trial_active: trialActive,
              trial_days_left: trialDaysLeft,
              has_access: subscribed || trialActive,
              status: row.status || (trialActive ? 'trial' : 'inactive'),
              loading: false,
            });
          } else {
            setSubscriptionStatus(prev => ({ ...prev, loading: false }));
          }
        } catch (fallbackError) {
          console.warn('Fallback de assinatura falhou:', fallbackError);
          setSubscriptionStatus(prev => ({ ...prev, loading: false }));
        }
      }
    };

    checkSubscription();

    // Revalidar a cada 60 segundos
    const interval = setInterval(checkSubscription, 60000);

    return () => clearInterval(interval);
  }, [user]);

  return subscriptionStatus;
};
