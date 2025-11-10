import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronLeft, ChevronRight, Cake, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

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
    return contacts.filter(contact => {
      if (!contact.birthday) return false;
      const birthday = new Date(contact.birthday);
      return birthday.getMonth() === day.getMonth() && 
             birthday.getDate() === day.getDate();
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

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const totalBirthdaysThisMonth = contacts.filter(contact => {
    if (!contact.birthday) return false;
    const birthday = new Date(contact.birthday);
    return birthday.getMonth() === currentMonth.getMonth();
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
                        min-h-[100px] p-2 border rounded-lg transition-all
                        ${isToday ? 'border-primary border-2 bg-primary/5' : 'border-border'}
                        ${hasBirthdays ? 'bg-secondary/30 hover:bg-secondary/50' : 'hover:bg-accent'}
                        cursor-pointer
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
                        <div className="space-y-1 mt-2">
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
          const birthday = new Date(c.birthday);
          return birthday.getMonth() === currentMonth.getMonth();
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
                    const birthday = new Date(c.birthday);
                    return birthday.getMonth() === currentMonth.getMonth();
                  })
                  .sort((a, b) => {
                    const dateA = new Date(a.birthday!);
                    const dateB = new Date(b.birthday!);
                    return dateA.getDate() - dateB.getDate();
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
                        {format(new Date(contact.birthday!), "dd/MM")}
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BirthdayCalendar;
