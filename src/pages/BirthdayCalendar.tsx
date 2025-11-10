import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronLeft, ChevronRight, Cake, Calendar as CalendarIcon, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Contact {
  id: string;
  name: string | null;
  phone_number: string;
  birthday: string | null;
}

const BirthdayCalendar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, phone_number, birthday')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .not('birthday', 'is', null);

      if (error) throw error;

      setContacts(data || []);
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os contatos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getBirthdaysForDay = (day: Date) => {
    const dayMonth = day.getMonth() + 1; // 1-12
    const dayDate = day.getDate();
    
    return contacts.filter(contact => {
      if (!contact.birthday) return false;
      const [, month, dayStr] = contact.birthday.split('-');
      return parseInt(month) === dayMonth && parseInt(dayStr) === dayDate;
    });
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Calculate starting day offset (0 = Sunday, 6 = Saturday)
  const startDayOffset = getDay(monthStart);

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const handleSendMessages = (day: Date) => {
    const birthdaysToday = getBirthdaysForDay(day);
    if (birthdaysToday.length === 0) {
      toast({
        title: "Nenhum aniversariante",
        description: "Não há aniversariantes neste dia",
        variant: "destructive"
      });
      return;
    }
    setSelectedDay(day);
    setMessage("Feliz aniversário, {nome}! 🎉🎂 Desejamos um dia incrível e cheio de alegria!");
    setShowMessageDialog(true);
  };

  const sendBirthdayMessages = async () => {
    if (!selectedDay) return;
    
    const birthdaysToday = getBirthdaysForDay(selectedDay);
    
    if (birthdaysToday.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum aniversariante encontrado",
        variant: "destructive"
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, digite uma mensagem",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSending(true);
      
      const clients = birthdaysToday.map(contact => ({
        "Nome do Cliente": contact.name || contact.phone_number,
        "Telefone do Cliente": contact.phone_number
      }));

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Sessão não encontrada");
      }

      const response = await supabase.functions.invoke('send-messages', {
        body: {
          clients,
          message,
          campaignName: `Aniversários - ${format(selectedDay, "dd/MM/yyyy")}`
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Sucesso!",
        description: `Mensagens enviadas para ${birthdaysToday.length} aniversariante(s)`,
      });

      setShowMessageDialog(false);
      setSelectedDay(null);
      setMessage("");
      
    } catch (error: any) {
      console.error('Error sending messages:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível enviar as mensagens",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const totalBirthdaysThisMonth = contacts.filter(contact => {
    if (!contact.birthday) return false;
    const [, month] = contact.birthday.split('-');
    return parseInt(month) === currentMonth.getMonth() + 1;
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/contacts")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar aos Contatos
          </Button>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Cake className="h-8 w-8 text-primary" />
                Calendário de Aniversários
              </h1>
              <p className="text-muted-foreground mt-1">
                Visualize todos os aniversários dos seus contatos
              </p>
            </div>
            <Button onClick={goToToday} variant="outline">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Ir para Hoje
            </Button>
          </div>
        </div>

        {/* Month Stats */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={previousMonth}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center min-w-[200px]">
                  <h2 className="text-2xl font-bold">
                    {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                  </h2>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={nextMonth}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <Badge variant="secondary" className="text-lg px-4 py-2">
                <Cake className="mr-2 h-5 w-5" />
                {totalBirthdaysThisMonth} aniversário(s) neste mês
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Calendar */}
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Calendário Mensal</CardTitle>
              <CardDescription>
                Clique em um dia para ver os aniversariantes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {/* Week day headers */}
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center font-semibold text-sm p-2 text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}

                {/* Empty cells for days before month starts */}
                {Array.from({ length: startDayOffset }).map((_, index) => (
                  <div key={`empty-${index}`} className="p-2" />
                ))}

                {/* Calendar days */}
                {daysInMonth.map((day) => {
                  const birthdaysToday = getBirthdaysForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const hasBirthdays = birthdaysToday.length > 0;

                  return (
                    <div
                      key={day.toISOString()}
                      className={`
                        min-h-[120px] p-2 border rounded-lg transition-all
                        ${isToday ? 'border-primary border-2 bg-primary/5' : 'border-border'}
                        ${hasBirthdays ? 'bg-secondary/30 hover:bg-secondary/50' : 'hover:bg-accent'}
                        cursor-pointer relative
                      `}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-sm font-medium ${isToday ? 'text-primary font-bold' : ''}`}>
                          {format(day, 'd')}
                        </span>
                        {hasBirthdays && (
                          <Badge variant="default" className="text-xs h-5">
                            <Cake className="h-3 w-3 mr-1" />
                            {birthdaysToday.length}
                          </Badge>
                        )}
                      </div>
                      
                      {hasBirthdays && (
                        <>
                          <div className="space-y-1 mt-2 mb-2">
                            {birthdaysToday.slice(0, 2).map((contact) => (
                              <div
                                key={contact.id}
                                className="text-xs p-1 bg-background/50 rounded truncate"
                                title={contact.name || contact.phone_number}
                              >
                                🎂 {contact.name || contact.phone_number.slice(-4)}
                              </div>
                            ))}
                            {birthdaysToday.length > 2 && (
                              <div className="text-xs text-muted-foreground text-center">
                                +{birthdaysToday.length - 2} mais
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs h-7"
                            onClick={() => handleSendMessages(day)}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Enviar
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Birthday List for Current Month */}
        {!loading && contacts.filter(c => {
          if (!c.birthday) return false;
          const [, month] = c.birthday.split('-');
          return parseInt(month) === currentMonth.getMonth() + 1;
        }).length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Aniversariantes de {format(currentMonth, "MMMM", { locale: ptBR })}</CardTitle>
              <CardDescription>
                Lista completa de todos os aniversariantes do mês
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {contacts
                  .filter(c => {
                    if (!c.birthday) return false;
                    const [, month] = c.birthday.split('-');
                    return parseInt(month) === currentMonth.getMonth() + 1;
                  })
                  .sort((a, b) => {
                    const [, , dayA] = a.birthday!.split('-');
                    const [, , dayB] = b.birthday!.split('-');
                    return parseInt(dayA) - parseInt(dayB);
                  })
                  .map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                          <Cake className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {contact.name || contact.phone_number}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {contact.phone_number}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-sm">
                        {contact.birthday!.split('-').slice(1).reverse().join('/')}
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Send Message Dialog */}
        <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Enviar Mensagens de Aniversário</DialogTitle>
              <DialogDescription>
                {selectedDay && (
                  <>
                    Enviar para {getBirthdaysForDay(selectedDay).length} aniversariante(s) do dia{" "}
                    {format(selectedDay, "dd/MM/yyyy")}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  placeholder="Digite sua mensagem de aniversário..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use <span className="font-mono bg-muted px-1 rounded">&#123;nome&#125;</span> para personalizar com o nome do contato
                </p>
              </div>

              {selectedDay && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm font-medium mb-2">Aniversariantes:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {getBirthdaysForDay(selectedDay).map((contact) => (
                      <div key={contact.id} className="text-sm flex items-center gap-2">
                        <Cake className="h-3 w-3 text-primary" />
                        {contact.name || contact.phone_number}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowMessageDialog(false)}
                disabled={isSending}
              >
                Cancelar
              </Button>
              <Button
                onClick={sendBirthdayMessages}
                disabled={isSending || !message.trim()}
              >
                {isSending ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Mensagens
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default BirthdayCalendar;
