import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Upload, Send, CheckCircle2, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const features = [
    {
      icon: MessageCircle,
      title: "WhatsApp Conectado",
      description: "Conecte seu WhatsApp de forma segura via QR Code e gerencie suas instâncias"
    },
    {
      icon: Upload,
      title: "Upload de Planilha",
      description: "Envie planilhas .xlsx, .xls ou .csv com nome e telefone dos clientes"
    },
    {
      icon: Send,
      title: "Envio Inteligente",
      description: "Mensagens enviadas com delay de 3 segundos entre cada contato para segurança"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Hero Section */}
      <div className="container max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <MessageCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Disparo em Massa via WhatsApp
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Conecte seu WhatsApp, faça upload da sua planilha de contatos e envie mensagens personalizadas automaticamente. 
            Sistema profissional com controle de envio e histórico completo.
          </p>
          <Button
            size="lg"
            variant="hero"
            onClick={() => navigate("/auth")}
            className="text-lg px-8 py-6 h-auto"
          >
            <LogIn className="h-5 w-5 mr-2" />
            Entrar / Cadastrar
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-elevated">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How it Works */}
        <Card className="shadow-elevated">
          <CardContent className="pt-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Como Funciona</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Conecte seu WhatsApp</h3>
                  <p className="text-sm text-muted-foreground">
                    Escaneie o QR Code para conectar sua conta WhatsApp de forma segura
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Prepare e Envie sua Planilha</h3>
                  <p className="text-sm text-muted-foreground">
                    Faça upload do arquivo com "Nome do Cliente" e "Telefone do Cliente" (.xlsx, .xls ou .csv)
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Personalize e Dispare</h3>
                  <p className="text-sm text-muted-foreground">
                    Escreva sua mensagem, revise os contatos e inicie o envio automático
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-8 text-center">
              <Button onClick={() => navigate("/auth")} size="lg">
                Entrar / Cadastrar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
