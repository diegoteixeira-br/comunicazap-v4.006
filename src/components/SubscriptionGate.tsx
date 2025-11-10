import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/sessionClient';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export const SubscriptionGate = ({ children }: SubscriptionGateProps) => {
  const subscription = useSubscription();
  const navigate = useNavigate();
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [minDelayElapsed, setMinDelayElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinDelayElapsed(true), 700);
    return () => clearTimeout(timer);
  }, []);

  // Acesso otimista: se o cache indicar acesso (mesmo sem verificação completa), permite
  const allowFromCache = !subscription.verified && subscription.has_access;

  // Se a verificação terminar e perder acesso, redireciona
  useEffect(() => {
    if (subscription.verified && !subscription.has_access && !subscription.loading) {
      // Usuário perdeu acesso após verificação
    }
  }, [subscription.verified, subscription.has_access, subscription.loading]);

  const handleStartCheckout = async () => {
    setStartingCheckout(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      if (data.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Checkout aberto",
          description: "Complete o pagamento na nova aba para ativar seu acesso.",
        });
      }
    } catch (error) {
      console.error('Error opening checkout:', error);
      toast({
        title: "Erro",
        description: "Não foi possível abrir o checkout.",
        variant: "destructive",
      });
    } finally {
      setStartingCheckout(false);
    }
  };

  // Se tiver acesso via cache, renderiza direto (verificação em background)
  if (allowFromCache) {
    return <>{children}</>;
  }

  // Mostra loader enquanto verifica OU enquanto delay mínimo não passou
  if (subscription.loading || !subscription.verified || !minDelayElapsed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando sua assinatura...</p>
        </div>
      </div>
    );
  }

  if (!subscription.has_access) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-500/5 via-background to-orange-500/5 p-4">
        <Card className="max-w-md w-full border-2 border-red-500/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl">Acesso Bloqueado</CardTitle>
            <CardDescription className="text-base mt-2">
              {subscription.status === 'trial' && !subscription.trial_active
                ? 'Seu período de teste gratuito expirou.'
                : 'Você precisa de uma assinatura ativa para acessar esta funcionalidade.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
              <p className="mb-2">Com a assinatura você terá:</p>
              <ul className="space-y-1 ml-4">
                <li>✓ Importação ilimitada do WhatsApp</li>
                <li>✓ Envio de campanhas sem limites</li>
                <li>✓ Suporte prioritário</li>
                <li>✓ Novas funcionalidades</li>
              </ul>
            </div>
            
            <Button 
              onClick={handleStartCheckout}
              disabled={startingCheckout}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
              size="lg"
            >
              {startingCheckout ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Abrindo...
                </>
              ) : (
                <>
                  <Crown className="mr-2 h-5 w-5" />
                  Assinar Agora
                </>
              )}
            </Button>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/dashboard')}
            >
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
