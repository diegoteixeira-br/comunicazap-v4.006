import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Upload, Send, LogIn, Clock, Shield, Zap, BarChart3, Users, CheckCircle, Crown, Tag, Cake, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import logo from "@/assets/comunicazap-logo.png";
import { Footer } from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";
const Index = () => {
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  useEffect(() => {
    if (user) {
      navigate("/dashboard", {
        replace: true
      });
    }
  }, [user, navigate]);
  const features = [{
    icon: MessageCircle,
    title: "WhatsApp Conectado",
    description: "Conecte seu WhatsApp de forma segura via QR Code e gerencie suas instâncias"
  }, {
    icon: Users,
    title: "Importação Automática",
    description: "Importe contatos diretamente do seu WhatsApp de forma rápida e prática"
  }, {
    icon: Upload,
    title: "Upload de Planilha",
    description: "Envie sua lista de contatos através de arquivos CSV, XLSX ou XLS"
  }, {
    icon: Send,
    title: "Envio Inteligente",
    description: "Delay aleatório de 4 a 5 minutos entre mensagens para simular comportamento humano e evitar bloqueios"
  }, {
    icon: UserPlus,
    title: "Envio para Grupos",
    description: "Envie mensagens para seus grupos do WhatsApp de forma automática e segura"
  }, {
    icon: Tag,
    title: "Segmentação por Tags",
    description: "Organize e filtre seus contatos com sistema de tags personalizadas"
  }, {
    icon: Cake,
    title: "Calendário de Aniversários",
    description: "Gerencie e envie mensagens de aniversário para seus contatos automaticamente"
  }];
  const benefits = [{
    icon: Clock,
    title: "Economia de Tempo",
    description: "Automatize o envio de mensagens e economize horas de trabalho manual"
  }, {
    icon: Shield,
    title: "100% Seguro",
    description: "Conexão criptografada e delay inteligente para proteger sua conta"
  }, {
    icon: Zap,
    title: "Rápido e Eficiente",
    description: "Processe centenas de contatos em minutos com nosso sistema otimizado"
  }, {
    icon: BarChart3,
    title: "Histórico Completo",
    description: "Acompanhe todos os envios realizados com relatórios detalhados"
  }, {
    icon: Users,
    title: "Gestão Avançada",
    description: "Importe, organize, edite e exporte contatos com tags e campos personalizados"
  }, {
    icon: CheckCircle,
    title: "Status em Tempo Real",
    description: "Veja o status de cada mensagem durante o processo de envio"
  }];
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 overflow-x-hidden">
      {/* Header/Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Logo e Nome */}
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <img src={logo} alt="Comunica Zap Logo" className="h-10 w-10 sm:h-12 sm:w-12" />
              <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Comunica Zap
              </span>
            </div>

            {/* Botões de ação */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button onClick={() => navigate("/auth")} variant="default" className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all hover:scale-105">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Entrar</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

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
            Conecte seu WhatsApp, importe seus contatos diretamente e envie mensagens personalizadas automaticamente.
            <span className="text-primary font-semibold">Comece com 7 dias de teste grátis!</span>
          </p>
        </div>

        {/* Features Grid - Linha 1 (4 cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {features.slice(0, 4).map((feature, index) => <Card key={index} className="border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-elevated">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </CardContent>
            </Card>)}
        </div>

        {/* Features Grid - Linha 2 (3 cards centralizados) */}
        <div className="flex flex-wrap justify-center gap-6 mb-16">
          {features.slice(4, 7).map((feature, index) => <Card key={index + 4} className="w-full md:w-[calc(50%-12px)] lg:w-[calc(25%-18px)] border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-elevated">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </CardContent>
            </Card>)}
        </div>

        {/* Benefits Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-4">Por que Escolher Nossa Plataforma?</h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Uma solução completa para suas necessidades de comunicação em massa via WhatsApp
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => <Card key={index} className="border-border/50 hover:border-primary/50 transition-all duration-300">
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
              </Card>)}
          </div>
        </div>

        {/* How it Works */}
        <Card id="how-it-works" className="shadow-elevated mb-16">
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
                    Escaneie o QR Code para conectar sua conta WhatsApp de forma segura. Seu número permanece protegido
                    e você mantém total controle.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
              <div>
                <h3 className="font-semibold mb-1">Importe seus Contatos</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha entre 4 opções: importe contatos do WhatsApp, faça upload de planilha CSV/XLSX, 
                  selecione por tags organizadas ou envie para grupos do WhatsApp.
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
                    Escreva sua mensagem personalizada, revise os contatos validados e inicie o envio automático com
                    delay aleatório de 4 a 5 minutos para simular comportamento humano.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Section */}
        <div id="pricing" className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-4">Plano Único e Completo</h2>
          <p className="text-center text-muted-foreground mb-4 max-w-2xl mx-auto">
            Importação profissional de contatos do WhatsApp com{" "}
            <span className="text-primary font-semibold">7 dias de teste grátis</span>
          </p>
          <div className="max-w-2xl mx-auto mt-8">
            <div className="mb-3">
              <div className="bg-red-500 text-white px-4 py-2 text-xs sm:text-sm font-bold text-center animate-pulse rounded-t-lg">
                ⚠️ PROMOÇÃO POR TEMPO LIMITADO - APROVEITE O PREÇO EXCLUSIVO PARA CELEBRAR NOSSA CHEGADA.
              </div>
            </div>
            <Card className="border-2 border-primary/50 relative shadow-2xl bg-gradient-to-br from-primary/5 to-accent/5">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-3">
                <div className="bg-gradient-to-r from-primary to-accent text-white px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
                  <Clock className="h-4 w-4" />7 DIAS GRÁTIS
                </div>
                <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
                  50% OFF
                </div>
              </div>
              <CardHeader className="pb-4 pt-16">
                <div className="text-center">
                  <div className="flex flex-col items-center gap-1 mb-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-6 w-6 text-primary" />
                      <CardTitle className="text-2xl">Importação do WhatsApp</CardTitle>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span className="text-2xl text-muted-foreground line-through">De R$ 197,00</span>
                  </div>
                  <div className="text-4xl font-bold text-primary mb-2">
                    Por R$ 98,50<span className="text-lg text-muted-foreground">/mês</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Cancele quando quiser, sem complicações</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                  <p className="text-sm text-center font-medium text-blue-900 dark:text-blue-100">
                    🎉 Teste <span className="font-bold">GRÁTIS</span> por 7 dias sem precisar de cartão de crédito
                  </p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Importação automática</strong> de contatos do WhatsApp
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Pesquisa e filtro avançado</strong> de contatos
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Envio inteligente</strong> com delay aleatório (4-5 min) para evitar bloqueios
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Histórico completo</strong> de todas as campanhas
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Templates personalizáveis</strong> de mensagens
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Envio para grupos</strong> do WhatsApp
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Sistema de tags</strong> para segmentação
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Calendário de aniversários</strong> com lembretes
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Importação/Exportação</strong> de contatos via planilha
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Suporte prioritário</strong> via chat na plataforma
                    </span>
                  </li>
                </ul>
                <Button onClick={() => navigate("/auth?mode=signup")} size="lg" className="w-full text-sm sm:text-lg py-3 sm:py-6 px-4 sm:px-6 h-auto bg-gradient-to-r from-primary to-accent hover:opacity-90">
                  <Crown className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span className="leading-tight">Começar Teste Grátis de 7 Dias</span>
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
                  Envie ofertas especiais, lançamentos de produtos e promoções sazonais para sua base de clientes de
                  forma personalizada e eficiente.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Lembretes e Confirmações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Automatize lembretes de consultas, confirmações de pedidos, avisos de pagamento e notificações
                  importantes para seus clientes.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Recuperação de Clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Reative clientes inativos com campanhas personalizadas, ofertas especiais e mensagens de 
                  reconquista para aumentar suas vendas.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Eventos e Convites</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Convide clientes para eventos, webinars, workshops e promoções especiais com mensagens personalizadas
                  e profissionais.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Comunicação em Grupos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Envie mensagens para grupos do WhatsApp de forma organizada, ideal para comunicação com equipes, 
                  comunidades e grupos de clientes.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Aniversariantes do Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Nunca esqueça um aniversário! Visualize calendário de aniversários e envie mensagens personalizadas 
                  automaticamente para seus clientes.
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
                Sua segurança é nossa prioridade. Implementamos as melhores práticas para proteger sua conta e seus
                dados:
              </p>
              <div className="grid md:grid-cols-3 gap-6 text-left">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Delay Inteligente
                  </h3>
                  <p className="text-sm text-muted-foreground">Intervalo de 4 a 5 minutos entre mensagens para envios mais rápidos</p>
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
                  <strong className="text-muted-foreground">⚠️ Aviso Importante:</strong> Use esta ferramenta de forma
                  responsável. O envio excessivo de mensagens ou spam pode violar os Termos de Serviço do WhatsApp e
                  resultar no bloqueio permanente do seu número. Envie mensagens apenas para contatos que autorizaram o
                  recebimento. Recomendamos limitar os envios e respeitar as políticas de uso do WhatsApp para manter
                  sua conta segura.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Final CTA */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para Começar?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Crie sua conta e teste <span className="text-primary font-bold">GRÁTIS por 7 dias</span> nossa plataforma
            completa de disparo via WhatsApp.
          </p>
          <Button onClick={() => navigate("/auth?mode=signup")} size="lg" variant="hero" className="w-full sm:w-auto text-sm sm:text-lg px-6 sm:px-10 py-3 sm:py-6 h-auto bg-gradient-to-r from-primary to-accent">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <span className="leading-tight">Começar Teste Grátis de 7 Dias</span>
          </Button>
        </div>
      </div>
      <Footer />
    </div>;
};
export default Index;