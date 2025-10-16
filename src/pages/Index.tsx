import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Upload, Send, LogIn, Clock, Shield, Zap, BarChart3, Users, CheckCircle, Crown, X } from "lucide-react";
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

  const benefits = [
    {
      icon: Clock,
      title: "Economia de Tempo",
      description: "Automatize o envio de mensagens e economize horas de trabalho manual"
    },
    {
      icon: Shield,
      title: "100% Seguro",
      description: "Conexão criptografada e delay inteligente para proteger sua conta"
    },
    {
      icon: Zap,
      title: "Rápido e Eficiente",
      description: "Processe centenas de contatos em minutos com nosso sistema otimizado"
    },
    {
      icon: BarChart3,
      title: "Histórico Completo",
      description: "Acompanhe todos os envios realizados com relatórios detalhados"
    },
    {
      icon: Users,
      title: "Gestão de Contatos",
      description: "Importe e organize seus contatos de forma simples e prática"
    },
    {
      icon: CheckCircle,
      title: "Status em Tempo Real",
      description: "Veja o status de cada mensagem durante o processo de envio"
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
            Comece grátis com upload de planilhas ou assine o premium para importar contatos direto do WhatsApp.
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

        {/* Benefits Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-4">Por que Escolher Nossa Plataforma?</h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Uma solução completa para suas necessidades de comunicação em massa via WhatsApp
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index} className="border-border/50 hover:border-primary/50 transition-all duration-300">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* How it Works */}
        <Card className="shadow-elevated mb-16">
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
                    Escaneie o QR Code para conectar sua conta WhatsApp de forma segura. Seu número permanece protegido e você mantém total controle.
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
                    Faça upload do arquivo com "Nome do Cliente" e "Telefone do Cliente" nos formatos .xlsx, .xls ou .csv. O sistema valida automaticamente os dados.
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
                    Escreva sua mensagem personalizada, revise os contatos validados e inicie o envio automático com delay inteligente de 3 segundos.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-8 text-center">
              <Button onClick={() => navigate("/auth")} size="lg">
                Começar Agora
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Plans */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-4">Escolha Seu Plano</h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Comece grátis com upload de planilhas ou desbloqueie recursos premium
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Plano Gratuito */}
            <Card className="border-2 border-border/50 hover:border-primary/50 transition-all">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Plano Gratuito</CardTitle>
                <div className="text-3xl font-bold text-primary mt-4">R$ 0</div>
                <p className="text-muted-foreground text-sm">Para sempre</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Upload de planilhas CSV, XLSX, XLS</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Envio de mensagens personalizadas</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Histórico completo de campanhas</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Delay inteligente de segurança</span>
                  </li>
                  <li className="flex items-start gap-3 opacity-50">
                    <X className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Importação do WhatsApp</span>
                  </li>
                </ul>
                <Button className="w-full" variant="outline" onClick={() => navigate("/auth")}>
                  Começar Grátis
                </Button>
              </CardContent>
            </Card>

            {/* Plano Premium */}
            <Card className="border-2 border-primary relative hover:shadow-xl transition-all">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                  <Crown className="h-4 w-4" />
                  Mais Popular
                </div>
              </div>
              <CardHeader className="text-center pb-4 pt-8">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Plano Premium</CardTitle>
                <div className="text-3xl font-bold text-primary mt-4">R$ 59,90</div>
                <p className="text-muted-foreground text-sm">por mês</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">Tudo do Plano Gratuito</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Importação direta do WhatsApp</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Sincronização automática de contatos</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Pesquisa e filtro avançado</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Seleção inteligente de contatos</span>
                  </li>
                </ul>
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  Assinar Premium
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-4">Casos de Uso</h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Ideal para diversos cenários de comunicação profissional
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Marketing e Promoções</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Envie ofertas especiais, lançamentos de produtos e promoções sazonais para sua base de clientes de forma personalizada e eficiente.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Lembretes e Confirmações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Automatize lembretes de consultas, confirmações de pedidos, avisos de pagamento e notificações importantes para seus clientes.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Atendimento ao Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Envie atualizações de status, respostas a dúvidas frequentes e mensagens de boas-vindas para novos clientes de forma organizada.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Eventos e Convites</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Convide clientes para eventos, webinars, workshops e promoções especiais com mensagens personalizadas e profissionais.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Security Section */}
        <Card className="shadow-elevated bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 mb-16">
          <CardContent className="pt-8">
            <div className="text-center max-w-3xl mx-auto">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">Segurança e Confiabilidade</h2>
              <p className="text-muted-foreground mb-6">
                Sua segurança é nossa prioridade. Implementamos as melhores práticas para proteger sua conta e seus dados:
              </p>
              <div className="grid md:grid-cols-3 gap-6 text-left">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Delay Inteligente
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Intervalo de 3 segundos entre mensagens para evitar bloqueios
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Conexão Criptografada
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Todas as comunicações são protegidas com criptografia de ponta
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Controle Total
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Você mantém o controle da sua conta WhatsApp a todo momento
                  </p>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-border/50">
                <p className="text-xs text-muted-foreground/80 leading-relaxed">
                  <strong className="text-muted-foreground">⚠️ Aviso Importante:</strong> Use esta ferramenta de forma responsável. 
                  O envio excessivo de mensagens ou spam pode violar os Termos de Serviço do WhatsApp e resultar no bloqueio 
                  permanente do seu número. Envie mensagens apenas para contatos que autorizaram o recebimento. 
                  Recomendamos limitar os envios e respeitar as políticas de uso do WhatsApp para manter sua conta segura.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Final CTA */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para Começar?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Crie sua conta gratuitamente e comece a enviar mensagens profissionais via WhatsApp hoje mesmo.
          </p>
          <Button onClick={() => navigate("/auth")} size="lg" variant="hero" className="text-lg px-10 py-6 h-auto">
            <LogIn className="h-5 w-5 mr-2" />
            Criar Conta Grátis
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
