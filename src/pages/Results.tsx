import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, CheckCircle, AlertCircle, ArrowLeft, Info, ChevronDown, ChevronUp, Save, Trash2, Smartphone, ImagePlus, X } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const Results = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [sendingStatus, setSendingStatus] = useState<{ [key: number]: "idle" | "sending" | "success" | "error" }>({});
  const [customMessage, setCustomMessage] = useState("");
  const [whatsappInstance, setWhatsappInstance] = useState<any>(null);
  const [loadingInstance, setLoadingInstance] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Template states
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState<MessageTemplate["category"]>("personalizado");

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
  }, []);

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
    setSendingStatus(prev => ({ ...prev, [index]: "sending" }));

    try {
      const processedMessage = customMessage ? replaceVariables(customMessage, client) : "";
      
      if (!processedMessage.trim() && !imageFile) {
        toast.error("Conteúdo vazio", {
          description: "Por favor, adicione uma mensagem ou imagem antes de enviar"
        });
        setSendingStatus(prev => ({ ...prev, [index]: "error" }));
        return false;
      }

      if (!whatsappInstance) {
        toast.error("WhatsApp não conectado");
        setSendingStatus(prev => ({ ...prev, [index]: "error" }));
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
        setSendingStatus(prev => ({ ...prev, [index]: "success" }));
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
      setSendingStatus(prev => ({ ...prev, [index]: "error" }));
      toast.error("Erro ao enviar", {
        description: error.message || `Não foi possível enviar para ${client["Nome do Cliente"]}`
      });
      return false;
    }
  };

  const handleSendAll = async () => {
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

    toast.info("Enviando mensagens...", {
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
        // Atualizar status de todos
        const newStatus: any = {};
        clients.forEach((_, i) => {
          newStatus[i] = "success";
        });
        setSendingStatus(newStatus);

        toast.success("Envio concluído!", {
          description: `${data.successCount} mensagens enviadas com sucesso`
        });

        // Redirecionar para histórico após 2 segundos
        setTimeout(() => {
          navigate("/history");
        }, 2000);
      } else {
        throw new Error(data?.error || 'Falha no envio em massa');
      }
    } catch (error: any) {
      console.error("❌ Erro no envio em massa:", error);
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
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-4xl font-bold mb-2">Clientes Carregados</h1>
          <p className="text-muted-foreground mb-6">
            {clients.length} cliente(s) encontrado(s)
          </p>
          
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

            <div className="flex justify-end">
              <Button
                onClick={handleSendAll}
                size="lg"
                variant="hero"
                disabled={Object.values(sendingStatus).some(s => s === "sending")}
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
            <CardTitle>Lista de Clientes</CardTitle>
            <CardDescription>
              Clique em "Enviar" para disparar a mensagem para cada cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
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
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {client["Nome do Cliente"]}
                      </TableCell>
                      <TableCell>{client["Telefone do Cliente"]}</TableCell>
                      <TableCell>
                        {getStatusBadge(sendingStatus[index] || "idle")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSend(client, index)}
                          disabled={
                            sendingStatus[index] === "sending" ||
                            sendingStatus[index] === "success"
                          }
                        >
                          {sendingStatus[index] === "success" ? (
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
