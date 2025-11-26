import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/sessionClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

const ConnectWhatsApp = () => {
  const [qrCode, setQrCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connected, setConnected] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45);
  const [qrExpired, setQrExpired] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (qrCode && !connected) {
      const interval = setInterval(() => {
        checkStatus();
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [qrCode, connected]);

  // Timer countdown for QR code expiration
  useEffect(() => {
    if (qrCode && !connected && !qrExpired) {
      const countdown = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setQrExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(countdown);
    }
  }, [qrCode, connected, qrExpired]);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      navigate('/auth');
    }
  };

  const createInstance = async () => {
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente para gerar o QR Code.",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-whatsapp-instance', {
        body: {},
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.success) {
        setQrCode(data.qrCode);
        setTimeLeft(45);
        setQrExpired(false);
        toast({
          title: "QR Code gerado!",
          description: "Escaneie o código com seu WhatsApp",
        });
      } else {
        throw new Error(data.error || 'Falha ao gerar QR Code');
      }
    } catch (error: any) {
      console.error('createInstance error:', error);
      const msg = /unauthorized/i.test(error?.message || '') ? 'Sessão inválida. Faça login novamente.' : error.message;
      toast({
        title: "Erro",
        description: msg,
        variant: "destructive",
      });
      if (/unauthorized/i.test(error?.message || '')) {
        navigate('/auth');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (checking) return;
    setChecking(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        throw new Error('Unauthorized');
      }

      const { data, error } = await supabase.functions.invoke('check-instance-status', {
        body: {},
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.success && data.status === 'connected') {
        setConnected(true);
        toast({
          title: "WhatsApp conectado!",
          description: `Número: ${data.phoneNumber}`,
        });
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Status check error:', error);
      if (/unauthorized/i.test(error?.message || '')) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente.",
          variant: "destructive",
        });
        navigate('/auth');
      }
    } finally {
      setChecking(false);
    }
  };

  const handleBackToDashboard = async () => {
    // Se tem QR Code mas não está conectado, deletar a instância
    if (qrCode && !connected) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          await supabase.functions.invoke('delete-whatsapp-instance', {
            body: {},
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
          });
          console.log('Instância deletada ao voltar');
        }
      } catch (error) {
        console.warn('Erro ao deletar instância:', error);
        // Continua navegando mesmo se falhar
      }
    }
    navigate('/dashboard');
  };

  const regenerateQrCode = async () => {
    setQrExpired(false);
    setTimeLeft(45);
    setQrCode('');
    await createInstance();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 p-3 sm:p-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={handleBackToDashboard}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Voltar ao Dashboard</span>
          <span className="sm:hidden">Voltar</span>
        </Button>

        <Card>
            <CardHeader>
              <CardTitle>Conectar WhatsApp</CardTitle>
              <CardDescription>
                {!qrCode
                  ? 'Clique no botão abaixo para gerar o QR Code'
                  : connected
                  ? 'WhatsApp conectado com sucesso!'
                  : 'Escaneie o QR Code com seu WhatsApp'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
              {!qrCode && !connected && (
                <Button
                  onClick={createInstance}
                  disabled={loading}
                  size="lg"
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span className="text-sm sm:text-base">Gerando QR Code...</span>
                    </>
                  ) : (
                    <span className="text-sm sm:text-base">Gerar QR Code</span>
                  )}
                </Button>
              )}

              {qrCode && !connected && (
                <div className="space-y-4 w-full">
                  {!qrExpired ? (
                    <>
                      <div className="bg-white p-3 sm:p-4 rounded-lg shadow-lg">
                        <img
                          src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                          alt="QR Code"
                          className="w-full max-w-xs sm:max-w-sm mx-auto"
                        />
                      </div>
                      <div className="flex items-center justify-center gap-2 text-amber-600">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">Expira em {timeLeft}s</span>
                      </div>
                      <div className="text-center">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                          1. Abra o WhatsApp no seu celular<br />
                          2. Toque em Mais opções &gt; Dispositivos conectados<br />
                          3. Toque em Conectar dispositivo<br />
                          4. Aponte seu celular para esta tela
                        </p>
                        {checking && (
                          <div className="flex items-center justify-center gap-2 text-primary">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Verificando conexão...</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center space-y-4 py-8">
                      <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
                      <p className="text-amber-600 font-medium">QR Code expirado</p>
                      <p className="text-sm text-muted-foreground">
                        O QR Code expirou. Gere um novo para conectar.
                      </p>
                      <Button onClick={regenerateQrCode} disabled={loading} size="lg">
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Gerar Novo QR Code
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {connected && (
                <div className="text-center space-y-4">
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
                  <p className="text-lg font-semibold text-green-600">
                    WhatsApp conectado com sucesso!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Redirecionando para o dashboard...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
};

export default ConnectWhatsApp;