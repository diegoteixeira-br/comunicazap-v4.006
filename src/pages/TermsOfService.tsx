import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
const TermsOfService = () => {
  return <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Início
          </Button>
        </Link>

        <article className="max-w-4xl mx-auto prose prose-slate dark:prose-invert">
          <h1>Termos de Serviço</h1>
          <p className="text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

          <section>
            <h2>1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e usar a plataforma DT Soluções Digital, você concorda com estes Termos de Serviço. Se você não
              concorda com qualquer parte destes termos, não deve usar nossos serviços.
            </p>
          </section>

          <section>
            <h2>2. Descrição do Serviço</h2>
            <p>
              A DT Soluções Digital é uma plataforma de automação de marketing via WhatsApp que permite aos usuários
              gerenciar e executar campanhas de mensagens em massa de forma profissional e eficiente. O serviço inclui:
            </p>
            <ul>
              <li>Importação de contatos do WhatsApp e via planilhas</li>
              <li>Envio de mensagens individuais e para grupos do WhatsApp</li>
              <li>Gestão de contatos com sistema de tags e segmentação</li>
              <li>Calendário de aniversários e lembretes automáticos</li>
              <li>Histórico e relatórios de campanhas</li>
            </ul>
          </section>

          <section>
            <h2>3. Cadastro e Conta do Usuário</h2>
            <p>Para utilizar nossos serviços, você deve:</p>
            <ul>
              <li>Fornecer informações verdadeiras, precisas e completas durante o cadastro</li>
              <li>Manter suas credenciais de acesso seguras e confidenciais</li>
              <li>Notificar-nos imediatamente sobre qualquer uso não autorizado de sua conta</li>
              <li>Ser responsável por todas as atividades realizadas através de sua conta</li>
            </ul>
          </section>

          <section>
            <h2>4. Uso Aceitável</h2>
            <p>Ao usar nossa plataforma, você concorda em:</p>
            <ul>
              <li>Usar o serviço apenas para fins legais e legítimos</li>
              <li>Não enviar spam, mensagens não solicitadas ou conteúdo ofensivo</li>
              <li>Respeitar as leis de proteção de dados (LGPD) e privacidade</li>
              <li>Obter consentimento apropriado dos destinatários antes de enviar mensagens</li>
              <li>Não utilizar o serviço para atividades fraudulentas ou ilegais</li>
              <li>Respeitar os Termos de Serviço do WhatsApp</li>
              <li>Usar o envio para grupos de forma responsável, respeitando os participantes</li>
              <li>Não fazer uso abusivo do sistema de tags para práticas invasivas</li>
            </ul>
          </section>

          <section>
            <h2>5. Proibições</h2>
            <p>É estritamente proibido:</p>
            <ul>
              <li>Violar direitos de propriedade intelectual</li>
              <li>Tentar obter acesso não autorizado aos nossos sistemas</li>
              <li>Interferir no funcionamento da plataforma</li>
              <li>Usar o serviço para disseminar malware ou vírus</li>
              <li>Revender ou redistribuir o acesso à plataforma sem autorização</li>
              <li>Enviar spam massivo para grupos do WhatsApp sem autorização dos administradores</li>
              <li>Utilizar dados de aniversários para práticas invasivas ou não autorizadas</li>
            </ul>
          </section>

          <section>
            <h2>6. Pagamentos e Assinaturas</h2>
            <p>
              Nossa plataforma opera sob modelo de assinatura mensal. Os detalhes sobre pagamentos, cancelamentos e
              reembolsos estão descritos em nossa Política de Reembolso e Cancelamento.
            </p>
          </section>

          <section>
            <h2>7. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo, funcionalidades e características da plataforma DT Soluções Digital são de propriedade
              exclusiva da empresa e estão protegidos por leis de direitos autorais, marcas registradas e outras leis de
              propriedade intelectual.
            </p>
          </section>

          <section>
            <h2>8. Limitação de Responsabilidade</h2>
            <p>A DT Soluções Digital não se responsabiliza por:</p>
            <ul>
              <li>Suspensão de contas do WhatsApp devido ao uso inadequado do serviço</li>
              <li>Problemas decorrentes de falhas na API do WhatsApp</li>
              <li>Danos indiretos, incidentais ou consequenciais do uso da plataforma</li>
              <li>Perda de dados causada por fatores externos ao nosso controle</li>
              <li>Conteúdo ou consequências de mensagens enviadas para grupos do WhatsApp</li>
              <li>Remoção de grupos ou bloqueios por administradores devido ao uso inadequado</li>
              <li>Uso inadequado de informações de aniversários pelos usuários</li>
            </ul>
          </section>

          <section>
            <h2>9. Suspensão e Encerramento</h2>
            <p>Reservamo-nos o direito de suspender ou encerrar sua conta caso:</p>
            <ul>
              <li>Você viole estes Termos de Serviço</li>
              <li>Seu uso da plataforma cause danos a terceiros ou à nossa reputação</li>
              <li>Haja inadimplência no pagamento da assinatura</li>
            </ul>
          </section>

          <section>
            <h2>10. Modificações nos Termos</h2>
            <p>
              Podemos modificar estes Termos de Serviço a qualquer momento. Notificaremos os usuários sobre mudanças
              significativas através do e-mail cadastrado ou através de avisos na plataforma.
            </p>
          </section>

          <section>
            <h2>11. Lei Aplicável</h2>
            <p>
              Estes termos são regidos pelas leis brasileiras. Qualquer disputa será resolvida no foro da comarca de
              Cáceres-MT, Brasil.
            </p>
          </section>

          <section>
            <h2>12. Contato</h2>
            <p>Para questões relacionadas a estes Termos de Serviço, entre em contato:</p>
            <ul>
              <li>E-mail: contato@dtsolucoesdigital.com.br</li>
              
            </ul>
          </section>
        </article>
      </div>
      <Footer />
    </div>;
};
export default TermsOfService;