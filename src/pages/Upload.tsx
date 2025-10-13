import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload as UploadIcon, FileSpreadsheet, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import Papa from "papaparse";

export interface ClientData {
  "Nome do Cliente": string;
  "Telefone do Cliente": string;
}

const Upload = () => {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = async (file: File) => {
    setIsProcessing(true);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (!fileExtension || !['xlsx', 'xls', 'csv'].includes(fileExtension)) {
        toast.error("Formato inválido", {
          description: "Por favor, envie apenas arquivos .xlsx, .xls ou .csv"
        });
        setIsProcessing(false);
        return;
      }

      let clients: ClientData[] = [];

      if (fileExtension === 'csv') {
        const text = await file.text();
        Papa.parse(text, {
          header: true,
          complete: (results) => {
            clients = results.data as ClientData[];
            validateAndNavigate(clients);
          },
          error: () => {
            toast.error("Erro ao processar CSV");
            setIsProcessing(false);
          }
        });
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        clients = XLSX.utils.sheet_to_json(worksheet) as ClientData[];
        validateAndNavigate(clients);
      }
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo", {
        description: "Verifique se o arquivo está no formato correto"
      });
      setIsProcessing(false);
    }
  };

  const validateAndNavigate = (clients: ClientData[]) => {
    if (!clients || clients.length === 0) {
      toast.error("Planilha vazia", {
        description: "A planilha não contém dados válidos"
      });
      setIsProcessing(false);
      return;
    }

    const invalidClients = clients.filter(
      client => !client["Nome do Cliente"] || !client["Telefone do Cliente"]
    );

    if (invalidClients.length > 0) {
      toast.error("Dados inválidos", {
        description: "Certifique-se de que todas as linhas possuem 'Nome do Cliente' e 'Telefone do Cliente'"
      });
      setIsProcessing(false);
      return;
    }

    toast.success("Planilha processada com sucesso!", {
      description: `${clients.length} cliente(s) encontrado(s)`
    });

    // Store in sessionStorage to pass to results page
    sessionStorage.setItem("clientData", JSON.stringify(clients));
    navigate("/results");
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-4">Upload de Planilha</h1>
          <p className="text-muted-foreground text-lg">
            Envie sua planilha com os dados dos clientes para começar
          </p>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Selecione sua planilha
            </CardTitle>
            <CardDescription>
              Formatos aceitos: .xlsx, .xls ou .csv
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
                isDragging
                  ? "border-primary bg-primary/5 scale-105"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <input
                type="file"
                id="file-input"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
                disabled={isProcessing}
              />
              <label
                htmlFor="file-input"
                className="cursor-pointer flex flex-col items-center gap-4"
              >
                <UploadIcon className={`h-16 w-16 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-lg font-medium mb-2">
                    {isProcessing ? "Processando..." : "Arraste e solte seu arquivo aqui"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ou clique para selecionar
                  </p>
                </div>
                {!isProcessing && (
                  <Button variant="outline" size="lg" type="button">
                    Selecionar Arquivo
                  </Button>
                )}
              </label>
            </div>

            <div className="mt-8 p-4 bg-muted/50 rounded-lg">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium mb-2">Formato da planilha:</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Sua planilha deve conter as seguintes colunas:
                  </p>
                  <div className="bg-background p-3 rounded font-mono text-sm">
                    <div className="mb-1">• <span className="text-primary">Nome do Cliente</span></div>
                    <div>• <span className="text-primary">Telefone do Cliente</span></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Exemplo: Nome completo na primeira coluna, telefone com DDD na segunda
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
          >
            Voltar para início
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Upload;
