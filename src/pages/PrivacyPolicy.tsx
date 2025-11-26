import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
const PrivacyPolicy = () => {
  return <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Início
          </Button>
        </Link>

        <article className="max-w-4xl mx-auto prose prose-slate dark:prose-invert">
          <h1>Política de Privacidade</h1>
          <p className="text-muted-foreground">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

          <section>
            <h2>1. Introdução</h2>
            <p>
              A DT Soluções Digital valoriza e respeita a privacidade de seus usuários. Esta Política de Privacidade 
              descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais em conformidade 
              com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018).
            </p>
          </section>

          <section>
            <h2>2. Informações que Coletamos</h2>
            <h3>2.1 Informações Fornecidas por Você</h3>
            <ul>
              <li>Nome completo</li>
              <li>E-mail</li>
              <li>Número de telefone</li>
              <li>Informações de pagamento (processadas por terceiros seguros)</li>
              <li>Dados de contatos que você importa para a plataforma (nomes, telefones, tags)</li>
              <li>Datas de aniversário dos contatos</li>
              <li>Dados de grupos do WhatsApp (nome do grupo, quantidade de participantes)</li>
            </ul>

            <h3>2.2 Informações Coletadas Automaticamente</h3>
            <ul>
              <li>Endereço IP</li>
              <li>Tipo de navegador e dispositivo</li>
              <li>Páginas visitadas e tempo de navegação</li>
              <li>Data e hora de acesso</li>
            </ul>
          </section>

          <section>
            <h2>3. Como Usamos suas Informações</h2>
            <p>
              Utilizamos suas informações para:
            </p>
            <ul>
              <li>Fornecer e manter nossos serviços</li>
              <li>Processar pagamentos e gerenciar assinaturas</li>
              <li>Enviar notificações importantes sobre sua conta</li>
              <li>Melhorar e personalizar sua experiência na plataforma</li>
              <li>Prevenir fraudes e garantir a segurança da plataforma</li>
              <li>Cumprir obrigações legais e regulatórias</li>
              <li>Enviar comunicações de marketing (apenas com seu consentimento)</li>
              <li>Fornecer lembretes automáticos de aniversários dos seus contatos</li>
              <li>Organizar e segmentar contatos através do sistema de tags</li>
              <li>Facilitar o envio de mensagens para grupos do WhatsApp</li>
            </ul>
          </section>

          <section>
            <h2>4. Compartilhamento de Informações</h2>
            <p>
              Não vendemos suas informações pessoais. Podemos compartilhar seus dados apenas nas seguintes situações:
            </p>
            <ul>
              <li><strong>Provedores de Serviço:</strong> Empresas que nos ajudam a operar a plataforma 
              (processamento de pagamentos, hospedagem, etc.)</li>
              <li><strong>Requisições Legais:</strong> Quando exigido por lei ou para proteger nossos direitos</li>
              <li><strong>API do WhatsApp:</strong> Para possibilitar o envio de mensagens através da plataforma, 
              incluindo envio para grupos quando autorizado por você</li>
              <li><strong>Dados de Grupos:</strong> Informações de grupos são compartilhadas apenas conforme 
              necessário para funcionalidade de envio, sempre mantendo a privacidade dos participantes</li>
            </ul>
          </section>

          <section>
            <h2>5. Armazenamento e Segurança</h2>
            <p>
              Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações, incluindo:
            </p>
            <ul>
              <li>Criptografia de dados em trânsito e em repouso</li>
              <li>Controles de acesso restritos</li>
              <li>Monitoramento contínuo de segurança</li>
              <li>Backups regulares</li>
            </ul>
            <p>
              Seus dados são armazenados em servidores seguros e mantidos pelo tempo necessário para cumprir 
              os propósitos descritos nesta política ou conforme exigido por lei.
            </p>
          </section>

          <section>
            <h2>6. Seus Direitos (LGPD)</h2>
            <p>
              De acordo com a LGPD, você tem direito a:
            </p>
            <ul>
              <li>Confirmar a existência de tratamento de seus dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Solicitar a portabilidade de seus dados</li>
              <li>Revogar o consentimento para tratamento de dados</li>
              <li>Obter informações sobre compartilhamento de dados</li>
            </ul>
            <p>
              Para exercer esses direitos, entre em contato conosco através do e-mail: contato@dtsolucoesdigital.com.br
            </p>
          </section>

          <section>
            <h2>7. Cookies e Tecnologias Semelhantes</h2>
            <p>
              Utilizamos cookies e tecnologias similares para:
            </p>
            <ul>
              <li>Manter você conectado à sua conta</li>
              <li>Lembrar suas preferências</li>
              <li>Analisar o uso da plataforma</li>
              <li>Melhorar a experiência do usuário</li>
            </ul>
            <p>
              Você pode configurar seu navegador para recusar cookies, mas isso pode afetar algumas 
              funcionalidades da plataforma.
            </p>
          </section>

          <section>
            <h2>8. Dados de Menores de Idade</h2>
            <p>
              Nossa plataforma não é destinada a menores de 18 anos. Não coletamos intencionalmente 
              informações de menores. Se tomarmos conhecimento de que coletamos dados de um menor, 
              tomaremos medidas para excluir essas informações.
            </p>
          </section>

          <section>
            <h2>9. Transferência Internacional de Dados</h2>
            <p>
              Seus dados podem ser transferidos e armazenados em servidores localizados fora do Brasil. 
              Garantimos que essas transferências são feitas em conformidade com a LGPD e com medidas 
              adequadas de proteção.
            </p>
          </section>

          <section>
            <h2>10. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você sobre 
              mudanças significativas através do e-mail cadastrado ou mediante aviso na plataforma. 
              A versão atualizada sempre indicará a data da última modificação.
            </p>
          </section>

          <section>
            <h2>11. Encarregado de Dados (DPO)</h2>
            <p>
              Para questões relacionadas à proteção de dados e exercício de seus direitos sob a LGPD, 
              você pode entrar em contato com nosso Encarregado de Dados:
            </p>
            <ul>
              <li>E-mail: contato@dtsolucoesdigital.com.br</li>
              
            </ul>
          </section>

          <section>
            <h2>12. Contato</h2>
            <p>
              Se você tiver dúvidas ou preocupações sobre esta Política de Privacidade, entre em contato:
            </p>
            <ul>
              <li>E-mail: contato@dtsolucoesdigital.com.br</li>
              
              
            </ul>
          </section>
        </article>
      </div>
      <Footer />
    </div>;
};
export default PrivacyPolicy;