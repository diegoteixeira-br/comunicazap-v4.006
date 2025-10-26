import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Save } from "lucide-react";

interface AIAgentSettingsProps {
  userId: string;
}

export const AIAgentSettings = ({ userId }: AIAgentSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiAgentActive, setAiAgentActive] = useState(false);
  const [aiAgentInstructions, setAiAgentInstructions] = useState("");

  useEffect(() => {
    fetchSettings();
  }, [userId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('ai_agent_active, ai_agent_instructions')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setAiAgentActive(data.ai_agent_active || false);
        setAiAgentInstructions(data.ai_agent_instructions || "");
      }
    } catch (error: any) {
      console.error('Error fetching AI agent settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAgent = async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ ai_agent_active: checked })
        .eq('user_id', userId);

      if (error) throw error;

      setAiAgentActive(checked);
      toast({
        title: checked ? "Agente IA Ativado" : "Agente IA Desativado",
        description: checked 
          ? "O agente começará a responder mensagens automaticamente" 
          : "O agente parou de responder mensagens"
      });
    } catch (error: any) {
      console.error('Error toggling AI agent:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do agente",
        variant: "destructive"
      });
    }
  };

  const handleSaveInstructions = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ ai_agent_instructions: aiAgentInstructions })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Instruções Salvas",
        description: "As instruções do agente foram atualizadas com sucesso"
      });
    } catch (error: any) {
      console.error('Error saving AI agent instructions:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as instruções",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle>Agente de Atendimento com IA</CardTitle>
        </div>
        <CardDescription>
          Configure o agente automático para responder mensagens recebidas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="ai-agent-toggle">Ativar Agente IA</Label>
            <p className="text-sm text-muted-foreground">
              O agente responderá automaticamente às mensagens recebidas
            </p>
          </div>
          <Switch
            id="ai-agent-toggle"
            checked={aiAgentActive}
            onCheckedChange={handleToggleAgent}
          />
        </div>

        {/* Instructions */}
        <div className="space-y-2">
          <Label htmlFor="ai-instructions">Instruções para o Agente</Label>
          <Textarea
            id="ai-instructions"
            placeholder="Digite as instruções para o agente IA. Por exemplo: 'Você é um assistente virtual da empresa XYZ. Seja educado e profissional ao responder perguntas sobre nossos produtos e serviços...'"
            value={aiAgentInstructions}
            onChange={(e) => setAiAgentInstructions(e.target.value)}
            className="min-h-[150px]"
            disabled={!aiAgentActive}
          />
          <p className="text-xs text-muted-foreground">
            Estas instruções definem como o agente IA se comportará nas conversas
          </p>
        </div>

        <Button 
          onClick={handleSaveInstructions}
          disabled={saving || !aiAgentActive}
          className="w-full"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Instruções"}
        </Button>

        {/* Info Box */}
        <div className="bg-accent/50 border border-accent p-4 rounded-lg">
          <p className="text-sm">
            <strong>Importante:</strong> O agente IA usará estas instruções como contexto 
            para responder às mensagens. Certifique-se de fornecer instruções claras e 
            específicas sobre como o agente deve se comportar.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
