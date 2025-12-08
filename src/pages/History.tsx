import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/sessionClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, Pause, Play, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const History = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCampaigns();

      // Escutar mudanças em tempo real
      const channel = supabase
        .channel('campaigns-realtime')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'message_campaigns',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            setCampaigns(prev => prev.map(c =>
              c.id === payload.new.id ? payload.new : c
            ));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from('message_campaigns')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setCampaigns(data);
    }
    setLoading(false);
  };

  const updateCampaignStatus = async (campaignId: string, newStatus: string) => {
    const { error } = await supabase
      .from('message_campaigns')
      .update({ status: newStatus })
      .eq('id', campaignId);

    if (error) {
      toast.error('Erro ao atualizar campanha');
      console.error('Error updating campaign:', error);
      return;
    }

    const messages: Record<string, string> = {
      paused: 'Campanha pausada',
      cancelled: 'Campanha cancelada',
      in_progress: 'Campanha retomada'
    };

    toast.success(messages[newStatus] || 'Status atualizado');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: any; label: string; className?: string }> = {
      pending: { variant: 'secondary', label: 'Pendente' },
      in_progress: { variant: 'outline', label: 'Em Andamento', className: 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
      paused: { variant: 'outline', label: 'Pausada', className: 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
      cancelled: { variant: 'outline', label: 'Cancelada', className: 'border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/30' },
      completed: { variant: 'default', label: 'Concluída', className: 'bg-green-600 hover:bg-green-700' },
      failed: { variant: 'destructive', label: 'Falhou' },
    };

    const config = statusMap[status] || statusMap.pending;
    
    if (status === 'in_progress') {
      return (
        <Badge variant={config.variant} className={config.className}>
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          {config.label}
        </Badge>
      );
    }

    if (status === 'paused') {
      return (
        <Badge variant={config.variant} className={config.className}>
          <Pause className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      );
    }
    
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const getProgress = (campaign: any) => {
    const total = campaign.total_contacts || 0;
    const processed = (campaign.sent_count || 0) + (campaign.failed_count || 0);
    return total > 0 ? Math.round((processed / total) * 100) : 0;
  };

  const renderActions = (campaign: any) => {
    if (campaign.status === 'in_progress') {
      return (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateCampaignStatus(campaign.id, 'paused')}
            title="Pausar"
          >
            <Pause className="h-4 w-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateCampaignStatus(campaign.id, 'cancelled')}
            title="Cancelar"
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      );
    }

    if (campaign.status === 'paused') {
      return (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateCampaignStatus(campaign.id, 'in_progress')}
            title="Retomar"
          >
            <Play className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateCampaignStatus(campaign.id, 'cancelled')}
            title="Cancelar"
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      );
    }

    return <span className="text-muted-foreground text-xs">-</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 p-3 sm:p-4">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Voltar ao Dashboard</span>
          <span className="sm:hidden">Voltar</span>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma campanha encontrada
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-6 sm:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Campanha</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Data</TableHead>
                        <TableHead className="text-xs sm:text-sm">Total</TableHead>
                        <TableHead className="text-xs sm:text-sm">Enviados</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Falhas</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium text-xs sm:text-sm max-w-[150px] truncate">
                            {campaign.campaign_name}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm hidden sm:table-cell whitespace-nowrap">
                            {format(new Date(campaign.created_at), 'dd/MM/yy HH:mm', {
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">{campaign.total_contacts}</TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <span className="text-green-600 font-medium">{campaign.sent_count}</span>
                            {campaign.status === 'in_progress' && (
                              <div className="mt-1">
                                <Progress value={getProgress(campaign)} className="h-1.5 w-16" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-red-600 text-xs sm:text-sm hidden md:table-cell">
                            {campaign.failed_count}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">{getStatusBadge(campaign.status)}</TableCell>
                          <TableCell className="text-xs sm:text-sm">{renderActions(campaign)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default History;