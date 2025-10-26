import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/sessionClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, History, Phone, Power, Loader2, RefreshCw, Unplug, CreditCard, Crown, Clock, Zap, AlertCircle, Send, XCircle, Eye, EyeOff } from 'lucide-react';
import { ImportContactsModal } from '@/components/ImportContactsModal';
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

interface SubscriptionStatus {
  subscribed: boolean;
  trial_active: boolean;
  trial_days_left: number;
  has_access: boolean;
  status: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [whatsappInstance, setWhatsappInstance] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null } | null>(null);
  const [showEmail, setShowEmail] = useState(() => {
    const saved = localStorage.getItem('showEmail');
    return saved !== null ? saved === 'true' : true;
  });
  const [showPhone, setShowPhone] = useState(() => {
    const saved = localStorage.getItem('showPhone');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    if (user) {
      // Executar todas as buscas em paralelo para melhor performance
      Promise.all([
        fetchUserProfile(),
        fetchWhatsAppInstance(),
        fetchCampaigns(),
        checkSubscription()
      ]);
      
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

  const fetchUserProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user?.id)
      .maybeSingle();
    
    setUserProfile(data);
  };

  const fetchWhatsAppInstance = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error) throw error;
      setWhatsappInstance(data);
    } catch (error) {
      console.error('Error fetching instance:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshInstanceStatus = async () => {
    if (refreshing) return; // Prevenir múltiplas chamadas simultâneas
    
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-instance-status', {
        body: {}
      });

      if (error) throw error;

      if (data?.success) {
        setWhatsappInstance(data.instance);
        toast({
          title: "Status atualizado",
          description: data.status === 'connected' 
            ? `WhatsApp conectado: ${data.phoneNumber}` 
            : 'WhatsApp desconectado',
        });
      } else {
        throw new Error(data?.error || 'Failed to check status');
      }
    } catch (error: any) {
      console.error('Refresh error:', error);
      toast({
        title: "Erro ao atualizar",
        description: error.message || 'Não foi possível atualizar o status',
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('message_campaigns')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
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
    } catch (error) {
      console.error('Error fetching campaigns:', error);
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

  const checkSubscription = async () => {
    setCheckingSubscription(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setSubscriptionStatus(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setSubscriptionStatus(data as SubscriptionStatus);
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      // Fallback seguro: consultar diretamente o status no banco
      try {
        const { data: row } = await supabase
          .from('user_subscriptions')
          .select('status, trial_active, trial_ends_at')
          .eq('user_id', user?.id)
          .maybeSingle();

        if (row) {
          const trialActive = !!row.trial_active && !!row.trial_ends_at && new Date(row.trial_ends_at) > new Date();
          const trialDaysLeft = trialActive
            ? Math.ceil((new Date(row.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          const subscribed = row.status === 'active';
          setSubscriptionStatus({
            subscribed,
            trial_active: trialActive,
            trial_days_left: trialDaysLeft,
            has_access: subscribed || trialActive,
            status: row.status || (trialActive ? 'trial' : 'inactive')
          });
        } else {
          // Sem linha ainda: não bloquear a UI; permitir usuário continuar e tentar novamente depois
          setSubscriptionStatus(null);
        }
      } catch (fallbackError) {
        console.warn('Fallback de assinatura falhou:', fallbackError);
        setSubscriptionStatus(null);
      }
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleManageSubscription = async () => {
    setOpeningPortal(true);
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

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      if (data.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Portal aberto",
          description: "Gerencie sua assinatura na nova aba.",
        });
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      toast({
        title: "Erro",
        description: "Não foi possível abrir o portal de assinaturas.",
        variant: "destructive",
      });
    } finally {
      setOpeningPortal(false);
    }
  };

  const handleStartCheckout = async () => {
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
      }
    } catch (error) {
      console.error('Error opening checkout:', error);
      toast({
        title: "Erro",
        description: "Não foi possível abrir o checkout.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
      // Redireciono forçado para evitar qualquer estado preso
      window.location.replace('/auth');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo com erro, força a navegação para a tela de login
      window.location.replace('/auth');
    }
  };

  const handleNewCampaign = () => {
    navigate('/select-import-method');
  };

  const handleImportContacts = (contacts: { name: string; phone: string }[]) => {
    // Converte para o formato esperado pela página Results
    const clientData = contacts.map(contact => ({
      "Nome do Cliente": contact.name,
      "Telefone do Cliente": contact.phone
    }));
    
    // Armazena os contatos e navega para /results
    sessionStorage.setItem("clientData", JSON.stringify(clientData));
    navigate("/results");
  };

  const maskEmail = (email: string) => {
    if (!email) return '';
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 3) {
      return `${localPart}***@${domain}`;
    }
    return `${localPart.substring(0, 3)}***@${domain}`;
  };

  const maskPhone = (phone: string) => {
    if (!phone) return '';
    if (phone.length <= 6) return '***' + phone.slice(-3);
    return phone.substring(0, 3) + '***' + phone.slice(-4);
  };

  const toggleShowEmail = () => {
    const newValue = !showEmail;
    setShowEmail(newValue);
    localStorage.setItem('showEmail', String(newValue));
  };

  const toggleShowPhone = () => {
    const newValue = !showPhone;
    setShowPhone(newValue);
    localStorage.setItem('showPhone', String(newValue));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-3 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Bem-vindo(a), {userProfile?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-xs sm:text-sm">
                {showEmail ? user?.email : maskEmail(user?.email || '')}
              </p>
              <button
                onClick={toggleShowEmail}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showEmail ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="gap-2 w-full sm:w-auto">
            <Power className="h-4 w-4" />
            <span className="sm:inline">Sair</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* Stats Cards - Topo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Card className="border-primary/20 hover:border-primary/40 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    Total de Campanhas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {stats.total}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-green-500/20 hover:border-green-500/40 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <Send className="h-4 w-4" />
                    Mensagens Enviadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-green-600">
                    {stats.sent}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-red-500/20 hover:border-red-500/40 transition-colors">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    Falhas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-red-600">
                    {stats.failed}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Action Cards - Meio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <Card 
                className="cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5"
                onClick={handleNewCampaign}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <Zap className="h-6 w-6 text-primary" />
                      </div>
                      Nova Campanha
                    </CardTitle>
                  </div>
                  <CardDescription className="text-base mt-3">
                    Importar contatos do WhatsApp e iniciar envio
                  </CardDescription>
                </CardHeader>
              </Card>

              <Link to="/history">
                <Card className="cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5 h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-3 text-2xl">
                        <div className="p-3 rounded-lg bg-accent/10">
                          <History className="h-6 w-6 text-accent" />
                        </div>
                        Histórico
                      </CardTitle>
                    </div>
                    <CardDescription className="text-base mt-3">
                      Visualizar todas as campanhas anteriores
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>

            {/* Configuration Section - Bottom */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* WhatsApp Status */}
              <Card className="border-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Phone className="h-5 w-5" />
                        Status WhatsApp
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <CardDescription>
                          {whatsappInstance?.phone_number 
                            ? (showPhone ? whatsappInstance.phone_number : maskPhone(whatsappInstance.phone_number))
                            : 'Nenhum número conectado'
                          }
                        </CardDescription>
                        {whatsappInstance?.phone_number && (
                          <button
                            onClick={toggleShowPhone}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPhone ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
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
                        <Button variant="ghost" className="w-full text-destructive hover:text-destructive" disabled={disconnecting}>
                          {disconnecting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Desconectando...
                            </>
                          ) : (
                            <>
                              <Unplug className="mr-2 h-4 w-4" />
                              Desconectar
                            </>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso irá desconectar seu WhatsApp. Você precisará escanear o QR Code novamente.
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

              {/* Subscription Status */}
              <Card className={`border-2 ${
                checkingSubscription
                  ? 'border-border'
                  : !subscriptionStatus
                  ? 'border-border'
                  : subscriptionStatus.subscribed 
                  ? 'border-yellow-500/50 bg-gradient-to-br from-yellow-500/5 to-amber-500/5' 
                  : subscriptionStatus.trial_active 
                  ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/5 to-cyan-500/5'
                  : 'border-red-500/50 bg-gradient-to-br from-red-500/5 to-orange-500/5'
              }`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {checkingSubscription ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        Verificando Status
                      </>
                    ) : subscriptionStatus?.subscribed ? (
                      <>
                        <Crown className="h-5 w-5 text-yellow-500" />
                        Assinatura Ativa
                      </>
                    ) : subscriptionStatus?.trial_active ? (
                      <>
                        <Clock className="h-5 w-5 text-blue-500" />
                        Período de Teste Grátis
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        Sem Acesso
                      </>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {checkingSubscription
                      ? 'Carregando informações de assinatura...'
                      : !subscriptionStatus
                      ? 'Não foi possível verificar agora. Tentaremos novamente em instantes.'
                      : subscriptionStatus.subscribed 
                      ? 'Você tem acesso completo à importação do WhatsApp' 
                      : subscriptionStatus.trial_active
                      ? `Restam ${subscriptionStatus.trial_days_left} dia${subscriptionStatus.trial_days_left !== 1 ? 's' : ''} de teste`
                      : 'Seu teste acabou. Assine para continuar usando.'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {checkingSubscription ? (
                    <div className="w-full h-10 bg-muted animate-pulse rounded-md" />
                  ) : subscriptionStatus?.subscribed ? (
                    <Button 
                      variant="outline" 
                      onClick={handleManageSubscription}
                      disabled={openingPortal}
                      className="w-full"
                    >
                      {openingPortal ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Abrindo...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Gerenciar Assinatura
                        </>
                      )}
                    </Button>
                  ) : !subscriptionStatus?.trial_active ? (
                    <Button 
                      onClick={handleStartCheckout}
                      className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                    >
                      <Crown className="mr-2 h-4 w-4" />
                      Assinar Agora - R$ 59,90/mês
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Modal de Importação de Contatos */}
        <ImportContactsModal
          open={showImportModal}
          onOpenChange={setShowImportModal}
          onImport={handleImportContacts}
        />
      </div>
    </div>
  );
};

export default Dashboard;