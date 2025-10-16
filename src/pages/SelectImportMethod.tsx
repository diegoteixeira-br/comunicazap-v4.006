import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, MessageSquare, ArrowLeft, Crown } from "lucide-react";
import { ImportContactsModal } from "@/components/ImportContactsModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface ClientData {
  "Nome do Cliente": string;
  "Telefone do Cliente": string;
}

interface Contact {
  name: string;
  phone: string;
}

const SelectImportMethod = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showImportModal, setShowImportModal] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      setCheckingSubscription(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setHasActiveSubscription(false);
        return;
      }

      // Primeiro verifica diretamente no banco de dados
      const { data: subscriptionData, error: dbError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!dbError && subscriptionData) {
        console.log('Assinatura ativa encontrada:', subscriptionData);
        setHasActiveSubscription(true);
        setPollAttempts(99); // Para o polling
        return;
      }

      // Se não encontrou no banco, tenta via Edge Function
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Erro na Edge Function:', error);
        // Não marca como sem assinatura em caso de erro de rede
        return;
      }
      
      if (data?.subscribed) {
        setHasActiveSubscription(true);
        setPollAttempts(99); // Para o polling
      }
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
    } finally {
      setCheckingSubscription(false);
    }
  };

  useEffect(() => {
    if (!hasActiveSubscription && !checkingSubscription && pollAttempts < 12) {
      const id = setTimeout(() => {
        setPollAttempts((p) => p + 1);
        checkSubscription();
      }, 10000);
      return () => clearTimeout(id);
    }
  }, [hasActiveSubscription, checkingSubscription, pollAttempts]);

  const handleCreateCheckout = async () => {
    try {
      setCreatingCheckout(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para assinar.",
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
        setShowPaymentDialog(false);
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a sessão de pagamento.",
        variant: "destructive",
      });
    } finally {
      setCreatingCheckout(false);
    }
  };

  const handleWhatsAppImportClick = () => {
    if (!hasActiveSubscription) {
      setShowPaymentDialog(true);
    } else {
      setShowImportModal(true);
    }
  };

  const handleImportContacts = (contacts: Contact[]) => {
    // Converte Contact[] para ClientData[]
    const clientData: ClientData[] = contacts.map(contact => ({
      "Nome do Cliente": contact.name,
      "Telefone do Cliente": contact.phone
    }));
    
    // Armazena os contatos e navega para /results
    sessionStorage.setItem("clientData", JSON.stringify(clientData));
    navigate("/results");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container max-w-5xl mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Dashboard
            </Button>
          </div>
          <h1 className="text-4xl font-bold mb-4">Nova Campanha</h1>
          <p className="text-muted-foreground text-lg">
            Escolha como você deseja importar seus contatos
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upload de Planilha */}
          <Card 
            className="cursor-pointer hover:shadow-xl transition-all hover:scale-105 border-2 hover:border-primary/50"
            onClick={() => navigate("/upload")}
          >
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Upload de Planilha</CardTitle>
              <CardDescription className="text-base">
                Envie um arquivo CSV, XLSX ou XLS com seus contatos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Formatos aceitos: .csv, .xlsx, .xls</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Colunas: "Nome do Cliente" e "Telefone do Cliente"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Ideal para listas pré-formatadas</span>
                </li>
              </ul>
              <Button className="w-full mt-6" variant="outline">
                Selecionar Arquivo - Grátis
              </Button>
            </CardContent>
          </Card>

          {/* Importar do WhatsApp */}
          <Card 
            className="cursor-pointer hover:shadow-xl transition-all hover:scale-105 border-2 hover:border-primary/50 relative"
            onClick={handleWhatsAppImportClick}
          >
            {!hasActiveSubscription && (
              <div className="absolute top-4 right-4">
                <Crown className="h-6 w-6 text-yellow-500" />
              </div>
            )}
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Importar do WhatsApp</CardTitle>
              <CardDescription className="text-base">
                {hasActiveSubscription 
                  ? "Busque contatos diretamente da sua conta conectada"
                  : "Assine o plano premium para desbloquear"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Sincronização direta com WhatsApp</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Selecione contatos específicos ou aleatórios</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Pesquisa e filtro de contatos</span>
                </li>
              </ul>
              <Button 
                className="w-full mt-6" 
                variant={hasActiveSubscription ? "outline" : "default"}
                disabled={checkingSubscription}
              >
                {checkingSubscription 
                  ? "Verificando..." 
                  : hasActiveSubscription 
                    ? "Buscar Contatos" 
                    : "Assinar - R$ 59,90/mês"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Modal de Importação */}
        <ImportContactsModal
          open={showImportModal}
          onOpenChange={setShowImportModal}
          onImport={handleImportContacts}
        />

        {/* Dialog de Pagamento */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="h-6 w-6 text-yellow-500" />
                Plano Premium
              </DialogTitle>
              <DialogDescription>
                Desbloqueie a importação de contatos do WhatsApp
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-secondary/20 p-4">
                <div className="text-3xl font-bold text-primary mb-2">R$ 59,90/mês</div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Importação ilimitada de contatos do WhatsApp</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Sincronização direta com sua conta</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Pesquisa e filtro avançado de contatos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>Cancelamento a qualquer momento</span>
                  </li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateCheckout}
                disabled={creatingCheckout}
              >
                {creatingCheckout ? "Processando..." : "Assinar Agora"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SelectImportMethod;
