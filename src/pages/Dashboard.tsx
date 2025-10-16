import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Upload, History, Phone, Power, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [whatsappInstance, setWhatsappInstance] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWhatsAppInstance();
      fetchCampaigns();
      
      // Subscribe to realtime changes on whatsapp_instances
      const channel = supabase
        .channel('whatsapp-instance-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'whatsapp_instances',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('WhatsApp instance updated:', payload);
            setWhatsappInstance(payload.new);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchWhatsAppInstance = async () => {
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', user?.id)
      .maybeSingle();
    
    setWhatsappInstance(data);
    setLoading(false);
  };

  const refreshInstanceStatus = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-instance-status', {
        body: {}
      });

      if (error) throw error;

      if (data.success) {
        setWhatsappInstance(data.instance);
        toast({
          title: "Status atualizado",
          description: data.status === 'connected' 
            ? `WhatsApp conectado: ${data.phoneNumber}` 
            : 'WhatsApp desconectado',
        });
      }
    } catch (error: any) {
      console.error('Refresh error:', error);
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from('message_campaigns')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setCampaigns(data);
      const totalSent = data.reduce((acc, c) => acc + c.sent_count, 0);
      const totalFailed = data.reduce((acc, c) => acc + c.failed_count, 0);
      setStats({
        total: data.length,
        sent: totalSent,
        failed: totalFailed,
      });
    }
  };

  const handleDisconnectWhatsApp = async () => {
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-whatsapp-instance', {
        body: {}
      });

      if (error) throw error;

      if (data.success) {
        setWhatsappInstance(null);
        toast({
          title: "WhatsApp desconectado",
          description: "Sua instância foi desconectada com sucesso.",
        });
      }
    } catch (error: any) {
      console.error('Disconnect error:', error);
      toast({
        title: "Erro ao desconectar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Bem-vindo, {user?.email}</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <Power className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <Card className="mb-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      Status WhatsApp
                    </CardTitle>
                    <CardDescription>
                      {whatsappInstance?.phone_number || 'Nenhum número conectado'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={refreshInstanceStatus}
                      disabled={refreshing}
                    >
                      <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                    <Badge variant={whatsappInstance?.status === 'connected' ? 'default' : 'secondary'}>
                      {whatsappInstance?.status === 'connected' ? '✓ Conectado' : '○ Desconectado'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {whatsappInstance?.status !== 'connected' ? (
                  <Link to="/connect-whatsapp">
                    <Button className="w-full">
                      <Phone className="mr-2 h-4 w-4" />
                      Conectar WhatsApp
                    </Button>
                  </Link>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full" disabled={disconnecting}>
                        {disconnecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Desconectando...
                          </>
                        ) : (
                          <>
                            <Unplug className="mr-2 h-4 w-4" />
                            Desconectar WhatsApp
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso irá desconectar seu WhatsApp e remover a instância. Você precisará escanear o QR Code novamente para reconectar.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDisconnectWhatsApp}>
                          Desconectar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Total de Campanhas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Mensagens Enviadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-green-600">{stats.sent}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Falhas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-red-600">{stats.failed}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link to="/select-import">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Nova Campanha
                    </CardTitle>
                    <CardDescription>
                      Escolha entre upload de planilha ou importação do WhatsApp
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link to="/history">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Histórico
                    </CardTitle>
                    <CardDescription>
                      Veja todas as suas campanhas anteriores
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;