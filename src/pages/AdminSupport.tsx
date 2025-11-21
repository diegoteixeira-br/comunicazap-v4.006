import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Shield, MessageCircle, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string;
  };
}

interface ConversationGroup {
  userId: string;
  userEmail: string;
  userName: string;
  messages: ChatMessage[];
  lastMessageAt: string;
}

export default function AdminSupport() {
  const [conversations, setConversations] = useState<ConversationGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
    loadAllConversations();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      navigate('/dashboard');
    }
  };

  const loadAllConversations = async () => {
    try {
      setIsLoading(true);
      
      // Primeiro, buscar todas as mensagens
      const { data: messages, error: messagesError } = await supabase
        .from('support_chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (messagesError) throw messagesError;
      if (!messages) return;

      // Buscar perfis únicos
      const uniqueUserIds = [...new Set(messages.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', uniqueUserIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Agrupar mensagens por usuário
      const grouped = messages.reduce((acc, msg) => {
        const userId = msg.user_id;
        const profile = profileMap.get(userId);
        
        if (!acc[userId]) {
          acc[userId] = {
            userId,
            userEmail: profile?.email || 'Sem email',
            userName: profile?.full_name || 'Sem nome',
            messages: [],
            lastMessageAt: msg.created_at
          };
        }
        acc[userId].messages.push({
          ...msg,
          role: msg.role as 'user' | 'assistant'
        });
        return acc;
      }, {} as Record<string, ConversationGroup>);

      const conversationList = Object.values(grouped || {}).sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      setConversations(conversationList);
      if (conversationList.length > 0) {
        setSelectedConversation(conversationList[0].userId);
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedConv = conversations.find(c => c.userId === selectedConversation);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Painel Administrativo</h1>
            <p className="text-muted-foreground">Conversas de Suporte</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : conversations.length === 0 ? (
          <Card className="p-12 text-center">
            <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma conversa ainda</h3>
            <p className="text-muted-foreground">
              As conversas de suporte aparecerão aqui quando os usuários começarem a usar o chat.
            </p>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Lista de conversas */}
            <Card className="lg:col-span-1">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Usuários ({conversations.length})</h2>
              </div>
              <ScrollArea className="h-[600px]">
                <div className="p-2">
                  {conversations.map((conv) => (
                    <button
                      key={conv.userId}
                      onClick={() => setSelectedConversation(conv.userId)}
                      className={`w-full p-4 rounded-lg mb-2 text-left transition-colors ${
                        selectedConversation === conv.userId
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <User className="h-5 w-5 mt-1 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{conv.userName}</p>
                          <p className="text-sm opacity-80 truncate">{conv.userEmail}</p>
                          <div className="flex items-center gap-1 mt-1 text-xs opacity-70">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {format(new Date(conv.lastMessageAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-xs mt-1 opacity-70">
                            {conv.messages.length} mensagens
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>

            {/* Conversa selecionada */}
            <Card className="lg:col-span-2">
              {selectedConv ? (
                <>
                  <div className="p-4 border-b">
                    <h2 className="font-semibold">{selectedConv.userName}</h2>
                    <p className="text-sm text-muted-foreground">{selectedConv.userEmail}</p>
                  </div>
                  <ScrollArea className="h-[600px] p-4">
                    <div className="space-y-4">
                      {selectedConv.messages
                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                        .map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                msg.role === 'user'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-foreground'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              <p className="text-xs opacity-70 mt-1">
                                {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="h-[600px] flex items-center justify-center text-muted-foreground">
                  Selecione uma conversa para visualizar
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
