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
  verified: boolean;
}

export const useSubscription = () => {
  const { user } = useAuth();
  
  // Tenta recuperar do cache da sessão
  const getCachedStatus = (): SubscriptionStatus | null => {
    try {
      const cached = sessionStorage.getItem('subscription_status');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Verifica se o cache tem menos de 30 segundos
        if (parsed.timestamp && Date.now() - parsed.timestamp < 30000) {
          return parsed.data;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler cache de assinatura:', e);
    }
    return null;
  };
  
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(() => {
    const cached = getCachedStatus();
    return cached 
      ? { ...cached, loading: true, verified: false }
      : {
          subscribed: false,
          trial_active: false,
          trial_days_left: 0,
          has_access: false,
          status: 'inactive',
          loading: true,
          verified: false,
        };
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
          verified: true,
        });
        return;
      }

    // Função auxiliar para usar fallback do banco
    const useFallback = async () => {
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
          
          const newStatus = {
            subscribed,
            trial_active: trialActive,
            trial_days_left: trialDaysLeft,
            has_access: subscribed || trialActive,
            status: row.status || (trialActive ? 'trial' : 'inactive'),
            loading: false,
            verified: true,
          };
          
          setSubscriptionStatus(newStatus);
          
          // Armazena no cache da sessão
          try {
            sessionStorage.setItem('subscription_status', JSON.stringify({
              data: newStatus,
              timestamp: Date.now()
            }));
          } catch (e) {
            console.warn('Erro ao salvar cache de assinatura:', e);
          }
        } else {
          setSubscriptionStatus(prev => ({ ...prev, loading: false, verified: true }));
        }
      } catch (fallbackError) {
        console.warn('Fallback de assinatura falhou:', fallbackError);
        setSubscriptionStatus(prev => ({ ...prev, loading: false, verified: true }));
      }
    };

    const checkSubscription = async () => {
      try {
        // Usa a sessão atual ao invés de forçar refresh
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          console.log('Sem sessão ativa, usando fallback do banco');
          // Ir direto para o fallback se não há sessão
          useFallback();
          return;
        }

        const { data, error } = await supabase.functions.invoke('check-subscription', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        // Se erro 401 (não autorizado), usar fallback silenciosamente
        if (error && error.message?.includes('401')) {
          console.log('Sessão expirada, usando fallback do banco');
          useFallback();
          return;
        }

        if (error) throw error;

        const newStatus = {
          subscribed: data.subscribed || false,
          trial_active: data.trial_active || false,
          trial_days_left: data.trial_days_left || 0,
          has_access: data.has_access || false,
          status: data.status || 'inactive',
          loading: false,
          verified: true,
        };
        
        setSubscriptionStatus(newStatus);
        
        // Armazena no cache da sessão
        try {
          sessionStorage.setItem('subscription_status', JSON.stringify({
            data: newStatus,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('Erro ao salvar cache de assinatura:', e);
        }
      } catch (error) {
        console.log('Erro ao verificar assinatura, usando fallback');
        useFallback();
      }
    };

    checkSubscription();

    // Revalidar a cada 60 segundos
    const interval = setInterval(checkSubscription, 60000);

    return () => clearInterval(interval);
  }, [user]);

  return subscriptionStatus;
};
