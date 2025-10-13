import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ClientData } from "./Upload";

const WEBHOOK_URL = "https://teste.belaformaonline.com/webhook-test/disparo";

const Results = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [sendingStatus, setSendingStatus] = useState<{ [key: number]: "idle" | "sending" | "success" | "error" }>({});

  useEffect(() => {
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
  }, [navigate]);

  const handleSend = async (client: ClientData, index: number) => {
    setSendingStatus(prev => ({ ...prev, [index]: "sending" }));

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: client["Nome do Cliente"],
          telefone: client["Telefone do Cliente"],
        }),
      });

      if (response.ok) {
        setSendingStatus(prev => ({ ...prev, [index]: "success" }));
        toast.success("Mensagem enviada!", {
          description: `Enviado para ${client["Nome do Cliente"]}`
        });
      } else {
        throw new Error("Erro na resposta do servidor");
      }
    } catch (error) {
      console.error("Erro ao enviar:", error);
      setSendingStatus(prev => ({ ...prev, [index]: "error" }));
      toast.error("Erro ao enviar", {
        description: "Não foi possível enviar a mensagem. Tente novamente."
      });
    }
  };

  const handleSendAll = async () => {
    toast.info("Enviando mensagens...", {
      description: "Processando todos os clientes"
    });

    for (let i = 0; i < clients.length; i++) {
      await handleSend(clients[i], i);
      // Small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
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

  const successCount = Object.values(sendingStatus).filter(s => s === "success").length;
  const errorCount = Object.values(sendingStatus).filter(s => s === "error").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/upload")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Clientes Carregados</h1>
              <p className="text-muted-foreground">
                {clients.length} cliente(s) encontrado(s)
              </p>
            </div>
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
        </div>

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
