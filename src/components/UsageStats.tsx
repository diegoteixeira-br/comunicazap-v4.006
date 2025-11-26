import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/sessionClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, Users, MessageSquare, CheckCircle, XCircle, Activity, AlertTriangle, BarChart3 } from 'lucide-react';

interface UsageData {
  totalMessages: number;
  successRate: number;
  totalContacts: number;
  activeCampaigns: number;
  blockRate: number;
  messagesByDay: Array<{ date: string; sent: number; failed: number }>;
  messagesByStatus: Array<{ name: string; value: number }>;
  campaignPerformance: Array<{ name: string; sent: number; failed: number }>;
  dailyHistory: Array<{ 
    date: string; 
    sent: number; 
    limit: number; 
    usage: number;
  }>;
}

export const UsageStats = ({ userId }: { userId: string }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageData>({
    totalMessages: 0,
    successRate: 0,
    totalContacts: 0,
    activeCampaigns: 0,
    blockRate: 0,
    messagesByDay: [],
    messagesByStatus: [],
    campaignPerformance: [],
    dailyHistory: []
  });

  useEffect(() => {
    fetchUsageData();
  }, [userId]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);

      // Buscar campanhas
      const { data: campaigns } = await supabase
        .from('message_campaigns')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Buscar contatos
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, status')
        .eq('user_id', userId);

      // Buscar histórico de limites diários (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: dailyLimits } = await supabase
        .from('daily_send_limits')
        .select('*')
        .eq('user_id', userId)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (!campaigns) {
        setLoading(false);
        return;
      }

      // Calcular métricas
      const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
      const totalFailed = campaigns.reduce((acc, c) => acc + (c.failed_count || 0), 0);
      const totalMessages = totalSent + totalFailed;
      const successRate = totalMessages > 0 ? (totalSent / totalMessages) * 100 : 0;
      const blockRate = totalMessages > 0 ? (totalFailed / totalMessages) * 100 : 0;

      // Agrupar mensagens por dia (últimos 30 dias)
      const messagesByDay = campaigns
        .reduce((acc: Array<{ date: string; sent: number; failed: number }>, campaign) => {
          const date = new Date(campaign.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          const existing = acc.find(item => item.date === date);
          
          if (existing) {
            existing.sent += campaign.sent_count || 0;
            existing.failed += campaign.failed_count || 0;
          } else {
            acc.push({
              date,
              sent: campaign.sent_count || 0,
              failed: campaign.failed_count || 0
            });
          }
          
          return acc;
        }, [])
        .slice(-30)
        .sort((a, b) => {
          const [dayA, monthA] = a.date.split('/');
          const [dayB, monthB] = b.date.split('/');
          return new Date(2024, parseInt(monthA) - 1, parseInt(dayA)).getTime() - 
                 new Date(2024, parseInt(monthB) - 1, parseInt(dayB)).getTime();
        });

      // Status das mensagens
      const messagesByStatus = [
        { name: 'Enviadas', value: totalSent },
        { name: 'Falhas', value: totalFailed }
      ];

      // Performance das últimas 5 campanhas
      const campaignPerformance = campaigns
        .slice(0, 5)
        .map(c => ({
          name: c.campaign_name || `Campanha ${c.created_at.split('T')[0]}`,
          sent: c.sent_count || 0,
          failed: c.failed_count || 0
        }))
        .reverse();

      // Histórico diário de limites
      const dailyHistory = (dailyLimits || []).map(limit => {
        const date = new Date(limit.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const usage = limit.limit_value > 0 ? (limit.messages_sent / limit.limit_value) * 100 : 0;
        return {
          date,
          sent: limit.messages_sent,
          limit: limit.limit_value,
          usage: Math.round(usage)
        };
      });

      setData({
        totalMessages,
        successRate,
        blockRate,
        totalContacts: contacts?.length || 0,
        activeCampaigns: campaigns.filter(c => c.status === 'running').length,
        messagesByDay,
        messagesByStatus,
        campaignPerformance,
        dailyHistory
      });
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))'];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              Total de Mensagens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalMessages.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">Todas as campanhas</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              Taxa de Sucesso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{data.successRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Mensagens entregues</p>
          </CardContent>
        </Card>

        <Card className="border-red-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Taxa de Bloqueio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{data.blockRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Mensagens com falha</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              Total de Contatos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{data.totalContacts.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">Salvos na base</p>
          </CardContent>
        </Card>

        <Card className="border-accent/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Activity className="h-4 w-4" />
              Campanhas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-accent">{data.activeCampaigns}</p>
            <p className="text-xs text-muted-foreground mt-1">Em execução agora</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
          <TabsTrigger value="daily">Histórico Diário</TabsTrigger>
          <TabsTrigger value="distribution">Distribuição</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Mensagens por Dia
              </CardTitle>
              <CardDescription>Últimos 30 dias de atividade</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.messagesByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="sent" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Enviadas"
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="failed" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2}
                    name="Falhas"
                    dot={{ fill: 'hsl(var(--destructive))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Histórico de Envios Diários
              </CardTitle>
              <CardDescription>
                Uso do limite diário nos últimos 30 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.dailyHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.dailyHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value, name) => {
                        if (name === 'usage') return [`${value}%`, 'Uso do Limite'];
                        if (name === 'sent') return [value, 'Enviadas'];
                        if (name === 'limit') return [value, 'Limite'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="sent" 
                      fill="hsl(var(--primary))" 
                      name="Mensagens Enviadas"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar 
                      dataKey="limit" 
                      fill="hsl(var(--muted))" 
                      name="Limite Diário"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">Nenhum histórico de envios disponível</p>
                  <p className="text-xs mt-1">Comece a enviar mensagens para ver suas estatísticas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Distribuição de Status
              </CardTitle>
              <CardDescription>Proporção de mensagens enviadas vs falhas</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.messagesByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.messagesByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Performance das Campanhas
              </CardTitle>
              <CardDescription>Últimas 5 campanhas realizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.campaignPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="sent" fill="hsl(var(--primary))" name="Enviadas" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="failed" fill="hsl(var(--destructive))" name="Falhas" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
