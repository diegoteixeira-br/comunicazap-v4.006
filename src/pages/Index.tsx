import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Upload, Send, CheckCircle2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Upload,
      title: "Faça Upload",
      description: "Envie sua planilha com os dados dos clientes em formato .xlsx ou .csv"
    },
    {
      icon: CheckCircle2,
      title: "Validação Automática",
      description: "O sistema valida automaticamente os dados da sua planilha"
    },
    {
      icon: Send,
      title: "Disparo Rápido",
      description: "Envie mensagens para todos os clientes com apenas um clique"
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
            Disparo de WhatsApp
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Envie mensagens via WhatsApp de forma rápida e eficiente. 
            Basta fazer upload da sua planilha e deixar o sistema trabalhar por você.
          </p>
          <Button
            size="lg"
            variant="hero"
            onClick={() => navigate("/upload")}
            className="text-lg px-8 py-6 h-auto"
          >
            <Upload className="h-5 w-5 mr-2" />
            Começar Agora
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
                  <h3 className="font-semibold mb-1">Prepare sua Planilha</h3>
                  <p className="text-sm text-muted-foreground">
                    Crie uma planilha com as colunas "Nome do Cliente" e "Telefone do Cliente"
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Faça o Upload</h3>
                  <p className="text-sm text-muted-foreground">
                    Envie sua planilha no formato .xlsx, .xls ou .csv
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Revise e Envie</h3>
                  <p className="text-sm text-muted-foreground">
                    Confira os dados e clique para enviar as mensagens
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-8 text-center">
              <Button onClick={() => navigate("/upload")} size="lg">
                Começar Agora
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
