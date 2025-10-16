import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, MessageSquare, ArrowLeft } from "lucide-react";
import { ImportContactsModal } from "@/components/ImportContactsModal";

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
  const [showImportModal, setShowImportModal] = useState(false);

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
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
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
                Selecionar Arquivo
              </Button>
            </CardContent>
          </Card>

          {/* Importar do WhatsApp */}
          <Card 
            className="cursor-pointer hover:shadow-xl transition-all hover:scale-105 border-2 hover:border-primary/50"
            onClick={() => setShowImportModal(true)}
          >
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Importar do WhatsApp</CardTitle>
              <CardDescription className="text-base">
                Busque contatos diretamente da sua conta conectada
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
              <Button className="w-full mt-6" variant="outline">
                Buscar Contatos
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
      </div>
    </div>
  );
};

export default SelectImportMethod;
