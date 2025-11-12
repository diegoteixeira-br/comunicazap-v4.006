import { useState } from 'react';
import { supabase } from '@/integrations/supabase/sessionClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Loader2, Stethoscope } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  stripe_key_configured: boolean;
  stripe_key_suffix: string;
  stripe_key_valid: boolean;
  auth_working: boolean;
  cors_enabled: boolean;
  user_email: string;
  errors: string[];
}

export const CheckoutHealthCheck = () => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<HealthCheckResult | null>(null);

  const runHealthCheck = async () => {
    setChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('checkout-health', {
        headers: session?.access_token 
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro no diagnóstico",
          description: error.message,
        });
        return;
      }

      setResult(data as HealthCheckResult);
      
      if (data.status === 'healthy') {
        toast({
          title: "✅ Sistema saudável",
          description: "Checkout está funcionando corretamente",
        });
      } else {
        toast({
          variant: "destructive",
          title: "⚠️ Problemas detectados",
          description: `${data.errors.length} erro(s) encontrado(s)`,
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao executar diagnóstico",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5" />
          Diagnóstico do Checkout
        </CardTitle>
        <CardDescription>
          Verifica se o sistema de pagamento está funcionando corretamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runHealthCheck} 
          disabled={checking}
          className="w-full"
        >
          {checking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <Stethoscope className="mr-2 h-4 w-4" />
              Executar Diagnóstico
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status Geral:</span>
              <Badge variant={result.status === 'healthy' ? 'default' : 'destructive'}>
                {result.status === 'healthy' ? (
                  <>
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Saudável
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Com Problemas
                  </>
                )}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Chave Stripe Configurada:</span>
                <Badge variant={result.stripe_key_configured ? 'default' : 'destructive'}>
                  {result.stripe_key_configured ? 'Sim' : 'Não'}
                </Badge>
              </div>

              {result.stripe_key_configured && (
                <div className="flex items-center justify-between">
                  <span>Sufixo da Chave:</span>
                  <code className="px-2 py-1 bg-muted rounded text-xs">
                    ...{result.stripe_key_suffix}
                  </code>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span>Chave Stripe Válida:</span>
                <Badge variant={result.stripe_key_valid ? 'default' : 'destructive'}>
                  {result.stripe_key_valid ? 'Sim' : 'Não'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span>Autenticação:</span>
                <Badge variant={result.auth_working ? 'default' : 'secondary'}>
                  {result.auth_working ? 'Funcionando' : 'Sem Auth'}
                </Badge>
              </div>

              {result.user_email && (
                <div className="flex items-center justify-between">
                  <span>Email:</span>
                  <span className="text-xs text-muted-foreground">{result.user_email}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span>CORS:</span>
                <Badge variant={result.cors_enabled ? 'default' : 'destructive'}>
                  {result.cors_enabled ? 'Habilitado' : 'Desabilitado'}
                </Badge>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <span className="text-sm font-medium text-destructive">Erros Detectados:</span>
                <ul className="space-y-1">
                  {result.errors.map((error, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-destructive" />
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-muted-foreground pt-2 border-t">
              Última verificação: {new Date(result.timestamp).toLocaleString('pt-BR')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
