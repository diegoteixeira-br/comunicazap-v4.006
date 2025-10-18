import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, CheckCircle, AlertCircle, ArrowLeft, Info, ChevronDown, ChevronUp, Save, Trash2, Smartphone, ImagePlus, X, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ClientData } from "./Upload";
import { 
  MessageTemplate, 
  getAllTemplates, 
  saveCustomTemplate, 
  deleteCustomTemplate,
  getCategoryIcon,
  getCategoryLabel
} from "@/data/messageTemplates";
import { supabase } from "@/integrations/supabase/sessionClient";
import { useAuth } from "@/hooks/useAuth";

const Results = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [sendingStatus, setSendingStatus] = useState<{ [key: string]: "idle" | "sending" | "success" | "error" }>({});
  const [customMessage, setCustomMessage] = useState("");
  const [whatsappInstance, setWhatsappInstance] = useState<any>(null);
  const [loadingInstance, setLoadingInstance] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Campaign tracking
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignProgress, setCampaignProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [isSending, setIsSending] = useState(false);
  const [messageLogs, setMessageLogs] = useState<any[]>([]);
  
  // Template states
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState<MessageTemplate["category"]>("personalizado");
  const [selectedClients, setSelectedClients] = useState<Set<number>>(new Set());
  const [showBestPractices, setShowBestPractices] = useState(false);
  const [agreedToBestPractices, setAgreedToBestPractices] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      toast.error("Autenticação necessária");
      navigate("/auth");
      return;
    }

    const storedData = sessionStorage.getItem("clientData");
    if (!storedData) {
      toast.error("Nenhum dado encontrado", {
        description: "Por favor, faça o upload de uma planilha primeiro"
      });
      navigate("/upload");
      return;
    }

    try {
      const parsedData = JSON.parse(storedData);
      setClients(parsedData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
      navigate("/upload");
    }
  }, [navigate, user, authLoading]);

  useEffect(() => {
    if (!user) return;

    const fetchWhatsAppInstance = async () => {
      try {
        const { data, error } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        if (!data || data.status !== 'connected') {
          toast.error("WhatsApp não conectado", {
            description: "Por favor, conecte seu WhatsApp primeiro"
          });
          navigate("/connect-whatsapp");
          return;
        }

        // Se conectado mas sem número, força atualização do status para buscar no Evolution API
        if (!data.phone_number) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            await supabase.functions.invoke('check-instance-status', {
              body: {},
              headers: {
                Authorization: `Bearer ${sessionData.session.access_token}`,
              },
            });
            // Rebuscar instância após a atualização
            const { data: refreshed } = await supabase
              .from('whatsapp_instances')
              .select('*')
              .eq('user_id', user.id)
              .single();
            setWhatsappInstance(refreshed || data);
          } else {
            setWhatsappInstance(data);
          }
        } else {
          setWhatsappInstance(data);
        }
      } catch (error) {
        console.error("Erro ao buscar instância:", error);
        toast.error("Erro ao verificar WhatsApp");
        navigate("/connect-whatsapp");
      } finally {
        setLoadingInstance(false);
      }
    };

    fetchWhatsAppInstance();
  }, [user, navigate]);

  useEffect(() => {
    setTemplates(getAllTemplates());
    
    // Verificar se o usuário já aceitou as boas práticas
    const hasAgreed = localStorage.getItem("agreedToBestPractices");
    setAgreedToBestPractices(hasAgreed === "true");
  }, []);

  // Polling e Realtime monitoring da campanha ativa
  useEffect(() => {
    if (!activeCampaignId) return;

    console.log('📡 Iniciando monitoramento da campanha:', activeCampaignId);

    let pollingInterval: NodeJS.Timeout;

    // Função para atualizar status dos clientes baseado nos logs
    const updateClientStatus = (logs: any[]) => {
      const statusMap: { [key: string]: "idle" | "sending" | "success" | "error" } = {};
      
      logs.forEach((log) => {
        const phone = log.client_phone;
        if (log.status === 'sent') {
          statusMap[phone] = 'success';
        } else if (log.status === 'failed') {
          statusMap[phone] = 'error';
        } else if (log.status === 'pending') {
          statusMap[phone] = 'sending';
        }
      });

      setSendingStatus(statusMap);
    };

    // Função para buscar dados da campanha
    const fetchCampaignData = async () => {
      try {
        // Buscar campanha
        const { data: campaign } = await supabase
          .from('message_campaigns')
          .select('*')
          .eq('id', activeCampaignId)
          .single();

        if (campaign) {
          console.log('📊 Campanha atualizada (polling):', {
            sent: campaign.sent_count,
            failed: campaign.failed_count,
            total: campaign.total_contacts,
            status: campaign.status
          });

          setCampaignProgress({
            sent: campaign.sent_count || 0,
            failed: campaign.failed_count || 0,
            total: campaign.total_contacts || 0
          });

          // Buscar logs
          const { data: logs } = await supabase
            .from('message_logs')
            .select('*')
            .eq('campaign_id', activeCampaignId)
            .order('created_at', { ascending: true });

          if (logs) {
            setMessageLogs(logs);
            updateClientStatus(logs);
          }

          // Se campanha completada, liberar navegação
          if (campaign.status === 'completed') {
            console.log('✅ Campanha completada!');
            setIsSending(false);
            clearInterval(pollingInterval);
            
            toast.success("Envio concluído!", {
              description: `${campaign.sent_count} enviadas, ${campaign.failed_count} falharam`
            });
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados da campanha:', error);
      }
    };

    // Fetch inicial
    fetchCampaignData();

    // Polling a cada 2 segundos
    pollingInterval = setInterval(fetchCampaignData, 2000);

    // Subscribe para atualizações em tempo real (backup do polling)
    const logsChannel = supabase
      .channel('message-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_logs',
          filter: `campaign_id=eq.${activeCampaignId}`
        },
        (payload) => {
          console.log('📨 Log atualizado (realtime):', payload);
          fetchCampaignData(); // Refetch para garantir consistência
        }
      )
      .subscribe();

    const campaignChannel = supabase
      .channel('campaign-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_campaigns',
          filter: `id=eq.${activeCampaignId}`
        },
        (payload) => {
          console.log('📊 Campanha atualizada (realtime):', payload);
          fetchCampaignData(); // Refetch para garantir consistência
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollingInterval);
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(campaignChannel);
    };
  }, [activeCampaignId, navigate]);

  // Bloquear navegação durante envio
  useEffect(() => {
    if (!isSending) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isSending]);

  const replaceVariables = (template: string, client: ClientData): string => {
    return template
      .replace(/{nome}/g, client["Nome do Cliente"])
      .replace(/{telefone}/g, client["Telefone do Cliente"]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error("Arquivo inválido", {
        description: "Por favor, selecione apenas imagens"
      });
      return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande", {
        description: "Tamanho máximo: 5MB"
      });
      return;
    }

    setImageFile(file);
    
    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    toast.success("Imagem adicionada!");
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    toast.info("Imagem removida");
  };

  const handleSend = async (client: ClientData, index: number, campaignId?: string) => {
    const phone = client["Telefone do Cliente"];
    setSendingStatus(prev => ({ ...prev, [phone]: "sending" }));

    try {
      const processedMessage = customMessage ? replaceVariables(customMessage, client) : "";
      
      if (!processedMessage.trim() && !imageFile) {
        toast.error("Conteúdo vazio", {
          description: "Por favor, adicione uma mensagem ou imagem antes de enviar"
        });
        setSendingStatus(prev => ({ ...prev, [phone]: "error" }));
        return false;
      }

      if (!whatsappInstance) {
        toast.error("WhatsApp não conectado");
        setSendingStatus(prev => ({ ...prev, [phone]: "error" }));
        return false;
      }

      const clientData = {
        "Nome do Cliente": client["Nome do Cliente"],
        "Telefone do Cliente": client["Telefone do Cliente"],
      };

      // Converter imagem para base64 se existir
      let imageBase64 = null;
      if (imageFile) {
        const reader = new FileReader();
        imageBase64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
      }

      console.log("🚀 Enviando via edge function:", clientData);

      const { data, error } = await supabase.functions.invoke('send-messages', {
        body: {
          clients: [clientData],
          message: processedMessage,
          image: imageBase64,
          campaignName: campaignId || `Envio individual - ${new Date().toLocaleString('pt-BR')}`
        }
      });

      if (error) throw error;

      if (data?.success) {
        setSendingStatus(prev => ({ ...prev, [phone]: "success" }));
        toast.success("Mensagem enviada!", {
          description: `Enviado para ${client["Nome do Cliente"]}`
        });
        console.log("✅ Sucesso:", data);
        return true;
      } else {
        throw new Error(data?.error || 'Falha ao enviar');
      }
    } catch (error: any) {
      console.error("❌ Erro ao enviar:", error);
      setSendingStatus(prev => ({ ...prev, [phone]: "error" }));
      toast.error("Erro ao enviar", {
        description: error.message || `Não foi possível enviar para ${client["Nome do Cliente"]}`
      });
      return false;
    }
  };

  const handleSendAll = async () => {
    // Verificar se o usuário aceitou as boas práticas
    if (!agreedToBestPractices) {
      setShowBestPractices(true);
      return;
    }

    if (!customMessage.trim() && !imageFile) {
      toast.error("Adicione conteúdo antes de enviar", {
        description: "Digite uma mensagem ou adicione uma imagem"
      });
      return;
    }

    if (!whatsappInstance) {
      toast.error("WhatsApp não conectado");
      navigate("/connect-whatsapp");
      return;
    }

    const campaignName = `Envio em massa - ${new Date().toLocaleString('pt-BR')}`;

    setIsSending(true);
    setCampaignProgress({ sent: 0, failed: 0, total: clients.length });
    setMessageLogs([]);
    setSendingStatus({}); // Resetar status

    toast.info("Iniciando envio...", {
      description: "Processando todos os clientes"
    });

    try {
      const clientsData = clients.map(client => ({
        "Nome do Cliente": client["Nome do Cliente"],
        "Telefone do Cliente": client["Telefone do Cliente"]
      }));

      // Converter imagem para base64 se existir
      let imageBase64 = null;
      if (imageFile) {
        const reader = new FileReader();
        imageBase64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
      }

      console.log("🚀 Enviando em massa:", { total: clientsData.length, campaignName });

      const { data, error } = await supabase.functions.invoke('send-messages', {
        body: {
          clients: clientsData,
          message: customMessage,
          image: imageBase64,
          campaignName
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Ativar monitoramento em tempo real
        setActiveCampaignId(data.campaign);
        
        toast.info("Enviando mensagens...", {
          description: "Acompanhe o progresso abaixo"
        });
      } else {
        throw new Error(data?.error || 'Falha no envio em massa');
      }
    } catch (error: any) {
      console.error("❌ Erro no envio em massa:", error);
      setIsSending(false);
      toast.error("Erro ao enviar mensagens", {
        description: error.message || "Tente novamente"
      });
    }
  };

  const getStatusBadge = (status: "idle" | "sending" | "success" | "error") => {
    switch (status) {
      case "sending":
        return <Badge variant="secondary">Enviando...</Badge>;
      case "success":
        return <Badge className="bg-success text-success-foreground">Enviado</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return null;
    }
  };

  const handleUseTemplate = (template: MessageTemplate) => {
    setCustomMessage(template.message);
    setSelectedTemplateId(template.id);
    toast.success(`Template "${template.title}" carregado!`);
    setShowTemplates(false);
  };

  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) {
      toast.error("Digite um nome para o template");
      return;
    }

    if (newTemplateName.trim().length < 3) {
      toast.error("Nome deve ter pelo menos 3 caracteres");
      return;
    }

    if (!customMessage.trim()) {
      toast.error("A mensagem não pode estar vazia");
      return;
    }

    if (customMessage.trim().length < 10) {
      toast.error("Mensagem deve ter pelo menos 10 caracteres");
      return;
    }

    try {
      const newTemplate: MessageTemplate = {
        id: `custom-${Date.now()}`,
        title: newTemplateName.trim(),
        message: customMessage,
        category: newTemplateCategory,
        isCustom: true,
        createdAt: new Date().toISOString(),
      };

      saveCustomTemplate(newTemplate);
      setTemplates(getAllTemplates());
      setShowSaveDialog(false);
      setNewTemplateName("");
      setNewTemplateCategory("personalizado");

      toast.success("✅ Template salvo com sucesso!");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Limite")) {
        toast.error("Limite atingido", {
          description: "Você atingiu o limite de 50 templates personalizados"
        });
      } else {
        toast.error("Erro ao salvar template");
      }
    }
  };

  const handleDeleteTemplate = (templateId: string, templateTitle: string) => {
    if (confirm(`Tem certeza que deseja excluir o template "${templateTitle}"?`)) {
      try {
        deleteCustomTemplate(templateId);
        setTemplates(getAllTemplates());
        toast.success("Template excluído");
      } catch (error) {
        toast.error("Erro ao excluir template");
      }
    }
  };

  const handleClearMessage = () => {
    setCustomMessage("");
    setSelectedTemplateId(null);
    toast.info("Mensagem limpa");
  };

  const getFilteredTemplates = (category: string) => {
    if (category === "todos") return templates;
    return templates.filter(t => t.category === category);
  };

  const handleSelectAll = () => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clients.map((_, index) => index)));
    }
  };

  const handleSelectClient = (index: number) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedClients(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedClients.size === 0) {
      toast.error("Nenhum cliente selecionado");
      return;
    }

    if (confirm(`Tem certeza que deseja excluir ${selectedClients.size} cliente(s) selecionado(s)?`)) {
      const deletedPhones = clients
        .filter((_, index) => selectedClients.has(index))
        .map(c => c["Telefone do Cliente"]);
      
      const newClients = clients.filter((_, index) => !selectedClients.has(index));
      setClients(newClients);
      
      // Atualizar sessionStorage
      sessionStorage.setItem("clientData", JSON.stringify(newClients));
      
      // Limpar seleção e status de envio dos clientes excluídos
      setSelectedClients(new Set());
      const newStatus = { ...sendingStatus };
      deletedPhones.forEach(phone => {
        delete newStatus[phone];
      });
      setSendingStatus(newStatus);
      
      toast.success(`${selectedClients.size} cliente(s) excluído(s)`);
    }
  };

  const handleAcceptBestPractices = () => {
    localStorage.setItem("agreedToBestPractices", "true");
    setAgreedToBestPractices(true);
    setShowBestPractices(false);
    
    // Após aceitar, enviar as mensagens
    handleSendAll();
  };

  const successCount = Object.values(sendingStatus).filter(s => s === "success").length;
  const errorCount = Object.values(sendingStatus).filter(s => s === "error").length;

  if (authLoading || loadingInstance) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Best Practices Alert Dialog */}
      <AlertDialog open={showBestPractices} onOpenChange={setShowBestPractices}>
        <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-2xl">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
              Boas Práticas: Proteja seu Número WhatsApp
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-4 pt-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                  ⚠️ O WhatsApp odeia spam e bane números que não seguem suas regras.
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                  Nosso sistema é uma ferramenta poderosa, mas o uso responsável depende de você.
                </p>
              </div>

              <div className="space-y-4">
                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold text-lg mb-2">1. Aqueça seu Número (Regra de Ouro)</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Nunca conecte um número novo e envie centenas de mensagens. O WhatsApp vai te identificar como um robô e te banir.
                  </p>
                  <p className="text-sm">
                    <strong>Como fazer:</strong> Nos primeiros dias, envie poucas mensagens (30-50 por dia) e tente conversar com quem responder. Aumente o volume gradualmente.
                  </p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold text-lg mb-2">2. Envie Apenas para Quem te Conhece</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    O WhatsApp monitora quantas pessoas te bloqueiam ou denunciam.
                  </p>
                  <p className="text-sm">
                    <strong>NÃO FAÇA:</strong> Comprar listas de contatos ou enviar para quem nunca falou com você.
                  </p>
                  <p className="text-sm mt-1">
                    <strong>FAÇA:</strong> Enviar para clientes, leads que se cadastraram ou pessoas que já conversaram com seu número.
                  </p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold text-lg mb-2">3. Use a Personalização (e Vá Além!)</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    O nosso sistema permite usar {"{nome}"} para personalizar. Isso é ótimo! Mas se você enviar o mesmo texto 200 vezes, o WhatsApp ainda pode te bloquear.
                  </p>
                  <p className="text-sm">
                    <strong>Dica Pro:</strong> Tente variar sua mensagem. Crie 2 ou 3 textos diferentes e alterne entre eles durante a campanha.
                  </p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold text-lg mb-2">4. Dê Sempre uma Opção de Saída (Obrigatório!)</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    A melhor forma de evitar ser "Bloqueado" ou "Denunciado" é oferecer uma saída fácil para o usuário.
                  </p>
                  <p className="text-sm">
                    <strong>Exemplo:</strong> Sempre termine sua mensagem com: <em>"Para não receber mais nossas novidades, basta responder SIM ou NÃO."</em>
                  </p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold text-lg mb-2">5. Respeite o Delay (Seja Humano)</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Nosso sistema envia as mensagens com um intervalo de segurança. Não tente apressar o processo.
                  </p>
                  <p className="text-sm">
                    Nenhum humano consegue enviar 100 mensagens em 1 minuto. O delay é seu amigo e protege seu número.
                  </p>
                </div>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-4">
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                  ⚠️ Lembre-se: O ComunicaZap é uma ferramenta de comunicação, não de spam. O banimento do seu número é de sua inteira responsabilidade.
                </p>
              </div>

              <div className="flex items-start space-x-2 mt-6 p-4 bg-muted rounded-lg">
                <Checkbox 
                  id="agree-terms" 
                  checked={agreedToBestPractices}
                  onCheckedChange={(checked) => setAgreedToBestPractices(checked as boolean)}
                />
                <label
                  htmlFor="agree-terms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Li e concordo em seguir as boas práticas para proteger meu número WhatsApp
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowBestPractices(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAcceptBestPractices}
              disabled={!agreedToBestPractices}
            >
              Concordo e Continuar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => {
              if (isSending) {
                toast.error("Aguarde o envio concluir", {
                  description: "Não é possível sair durante o envio"
                });
                return;
              }
              navigate("/dashboard");
            }}
            className="mb-4"
            disabled={isSending}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <div>
            <h1 className="text-4xl font-bold mb-2">Clientes Carregados</h1>
            <p className="text-muted-foreground">
              {clients.length} cliente(s) encontrado(s)
            </p>
          </div>
          
          {whatsappInstance && (
            <Card className="mb-6 bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">WhatsApp Conectado</p>
                    <p className="text-sm text-muted-foreground">
                      {whatsappInstance.phone_number || 'Número não disponível'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Templates Section */}
        <Card className="mb-6 shadow-elevated">
          <CardHeader className="cursor-pointer" onClick={() => setShowTemplates(!showTemplates)}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  📚 Meus Templates
                </CardTitle>
                <CardDescription>
                  Use templates prontos ou crie seus próprios
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon">
                {showTemplates ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            </div>
          </CardHeader>
          
          {showTemplates && (
            <CardContent>
              <Tabs defaultValue="todos" className="w-full">
                <TabsList className="w-full justify-start flex-wrap h-auto">
                  <TabsTrigger value="todos">Todos ({templates.length})</TabsTrigger>
                  <TabsTrigger value="opt-in">✅ Opt-in</TabsTrigger>
                  <TabsTrigger value="saudacao">👋 Saudação</TabsTrigger>
                  <TabsTrigger value="lembrete">📅 Lembrete</TabsTrigger>
                  <TabsTrigger value="promocao">🎁 Promoção</TabsTrigger>
                  <TabsTrigger value="agradecimento">💚 Agradecimento</TabsTrigger>
                  <TabsTrigger value="personalizado">✏️ Personalizados</TabsTrigger>
                </TabsList>

                {["todos", "opt-in", "saudacao", "lembrete", "promocao", "agradecimento", "personalizado"].map(category => (
                  <TabsContent key={category} value={category} className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {getFilteredTemplates(category).length > 0 ? (
                        getFilteredTemplates(category).map(template => (
                          <Card key={template.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <span className="text-2xl">{getCategoryIcon(template.category)}</span>
                                  <CardTitle className="text-base line-clamp-1">{template.title}</CardTitle>
                                </div>
                                {template.isCustom && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 flex-shrink-0"
                                    onClick={() => handleDeleteTemplate(template.id, template.title)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {template.message}
                              </p>
                              <Button
                                onClick={() => handleUseTemplate(template)}
                                className="w-full"
                                variant="secondary"
                                size="sm"
                              >
                                Usar Template
                              </Button>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="col-span-full text-center py-8 text-muted-foreground">
                          Nenhum template nesta categoria
                        </div>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          )}
        </Card>

        {/* Message Editor Section */}
        <Card className="mb-6 shadow-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Mensagem Personalizada
            </CardTitle>
            <CardDescription>
              Digite a mensagem que será enviada para cada cliente. Use os códigos para personalizar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Textarea
                placeholder="Olá {nome}, tudo bem?"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value.slice(0, 1000))}
                className="min-h-[120px] resize-none"
              />
              <div className="flex justify-end mt-1">
                <span className="text-xs text-muted-foreground">
                  {customMessage.length}/1000
                </span>
              </div>
            </div>

            {/* Image Upload Section */}
            <div className="space-y-2">
              <Label htmlFor="image-upload" className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                Adicionar Imagem (Opcional)
              </Label>
              {!imagePreview ? (
                <div className="relative">
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Formatos aceitos: JPG, PNG, WEBP. Tamanho máximo: 5MB
                  </p>
                </div>
              ) : (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-w-xs max-h-48 rounded-md border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setShowSaveDialog(true)}
                variant="outline"
                disabled={!customMessage.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar como Template
              </Button>
              <Button
                onClick={handleClearMessage}
                variant="outline"
                disabled={!customMessage.trim()}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            </div>

            {customMessage && clients.length > 0 && (
              <Card className="bg-muted/30 border-primary/20">
                <CardContent className="pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">📋 Preview com primeiro cliente:</p>
                  <p className="text-sm">
                    {customMessage
                      .replace(/{nome}/g, clients[0]["Nome do Cliente"])
                      .replace(/{telefone}/g, clients[0]["Telefone do Cliente"])}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="bg-muted/50 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium">Códigos disponíveis:</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="secondary"
                        className="cursor-pointer hover:bg-secondary/80"
                        onClick={() => setCustomMessage(prev => prev + "{nome}")}
                      >
                        {"{nome}"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Clique nos códigos para adicionar à mensagem
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress Tracking */}
            {isSending && (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    Enviando Mensagens
                  </CardTitle>
                  <CardDescription>
                    Por favor, aguarde. Não feche esta página.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progresso</span>
                      <span className="font-medium">
                        {campaignProgress.sent + campaignProgress.failed} / {campaignProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-300 rounded-full"
                        style={{ 
                          width: `${campaignProgress.total > 0 ? ((campaignProgress.sent + campaignProgress.failed) / campaignProgress.total) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Enviadas: {campaignProgress.sent}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span>Falharam: {campaignProgress.failed}</span>
                    </div>
                  </div>

                  {/* Real-time Logs */}
                  {messageLogs.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1 bg-muted/30 rounded-md p-3">
                      {messageLogs.slice(-10).reverse().map((log) => (
                        <div key={log.id} className="flex items-center gap-2 text-xs">
                          {log.status === 'sent' && (
                            <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                          )}
                          {log.status === 'failed' && (
                            <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                          )}
                          {log.status === 'pending' && (
                            <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          )}
                          <span className="truncate">
                            {log.client_name} - {log.client_phone}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleSendAll}
                size="lg"
                variant="hero"
                disabled={isSending || Object.values(sendingStatus).some(s => s === "sending")}
              >
                <Send className="h-5 w-5 mr-2" />
                Enviar para Todos
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Template Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Salvar Template</DialogTitle>
              <DialogDescription>
                Crie um template para reutilizar esta mensagem no futuro
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Nome do Template</Label>
                <Input
                  id="template-name"
                  placeholder="Ex: Minha Mensagem de Opt-in"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value.slice(0, 50))}
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  {newTemplateName.length}/50 caracteres
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-category">Categoria</Label>
                <Select value={newTemplateCategory} onValueChange={(value) => setNewTemplateCategory(value as MessageTemplate["category"])}>
                  <SelectTrigger id="template-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opt-in">✅ Opt-in</SelectItem>
                    <SelectItem value="saudacao">👋 Saudação</SelectItem>
                    <SelectItem value="lembrete">📅 Lembrete</SelectItem>
                    <SelectItem value="promocao">🎁 Promoção</SelectItem>
                    <SelectItem value="agradecimento">💚 Agradecimento</SelectItem>
                    <SelectItem value="personalizado">✏️ Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Preview da mensagem:</Label>
                <div className="p-3 rounded-md bg-muted text-sm max-h-32 overflow-y-auto">
                  {customMessage || "Nenhuma mensagem para visualizar"}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveTemplate}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {(successCount > 0 || errorCount > 0) && (
          <div className="mb-6 flex gap-4">
            {successCount > 0 && (
              <Card className="flex-1 border-success/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-success" />
                    <div>
                      <p className="text-2xl font-bold">{successCount}</p>
                      <p className="text-sm text-muted-foreground">Enviados com sucesso</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {errorCount > 0 && (
              <Card className="flex-1 border-destructive/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <div>
                      <p className="text-2xl font-bold">{errorCount}</p>
                      <p className="text-sm text-muted-foreground">Com erro</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Card className="shadow-elevated">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lista de Clientes</CardTitle>
                <CardDescription>
                  Selecione clientes para excluir ou clique em "Enviar" para disparar mensagens
                </CardDescription>
              </div>
              {selectedClients.size > 0 && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteSelected}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir Selecionados ({selectedClients.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedClients.size === clients.length && clients.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Nome do Cliente</TableHead>
                    <TableHead>Telefone do Cliente</TableHead>
                    <TableHead className="w-[150px]">Status</TableHead>
                    <TableHead className="w-[120px] text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Checkbox
                          checked={selectedClients.has(index)}
                          onCheckedChange={() => handleSelectClient(index)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {client["Nome do Cliente"]}
                      </TableCell>
                      <TableCell>{client["Telefone do Cliente"]}</TableCell>
                       <TableCell>
                         {getStatusBadge(sendingStatus[client["Telefone do Cliente"]] || "idle")}
                       </TableCell>
                       <TableCell className="text-right">
                         <Button
                           size="sm"
                           onClick={() => handleSend(client, index)}
                           disabled={
                             isSending ||
                             sendingStatus[client["Telefone do Cliente"]] === "sending" ||
                             sendingStatus[client["Telefone do Cliente"]] === "success"
                           }
                         >
                           {sendingStatus[client["Telefone do Cliente"]] === "success" ? (
                             <>
                               <CheckCircle className="h-4 w-4 mr-1" />
                               Enviado
                             </>
                           ) : (
                             <>
                               <Send className="h-4 w-4 mr-1" />
                               Enviar
                             </>
                           )}
                         </Button>
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Results;
