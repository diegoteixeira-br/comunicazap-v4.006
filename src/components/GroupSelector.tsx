import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Users, Search, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Group {
  id: string;
  subject: string;
  size: number;
  pictureUrl?: string;
}

interface GroupSelectorProps {
  selectedGroups: Group[];
  onGroupsChange: (groups: Group[]) => void;
}

export const GroupSelector = ({ selectedGroups, onGroupsChange }: GroupSelectorProps) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [noInstance, setNoInstance] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        toast.error('Sessão expirada', {
          description: 'Por favor, faça login novamente'
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('fetch-whatsapp-groups', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) {
        console.error('Error invoking function:', error);
        throw new Error(error.message);
      }

      // Verificar se a resposta indica sucesso = false
      if (data && data.success === false) {
        // Se o erro é de WhatsApp não conectado, marcar flag
        if (data.error && data.error.includes('não conectado')) {
          setNoInstance(true);
        }
        toast.error('Erro ao buscar grupos', {
          description: data.error || 'Erro desconhecido'
        });
        return;
      }

      if (data && data.groups && data.groups.length > 0) {
        setGroups(data.groups);
        toast.success(`${data.groups.length} grupos encontrados`);
      } else {
        toast.info('Nenhum grupo encontrado', {
          description: 'Certifique-se de que sua conta WhatsApp está em grupos'
        });
      }
    } catch (error: any) {
      console.error('Error fetching groups:', error);
      toast.error('Erro ao buscar grupos', {
        description: error.message || 'Tente novamente em alguns instantes'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGroup = (group: Group) => {
    const isSelected = selectedGroups.some(g => g.id === group.id);
    
    if (isSelected) {
      onGroupsChange(selectedGroups.filter(g => g.id !== group.id));
    } else {
      onGroupsChange([...selectedGroups, group]);
    }
  };

  const filteredGroups = groups.filter(group =>
    group.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (groups.length === 0) {
    if (noInstance) {
      return (
        <div className="text-center py-12">
          <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">WhatsApp não conectado</p>
          <p className="text-sm text-muted-foreground mb-6">
            Você precisa conectar seu WhatsApp antes de buscar grupos
          </p>
          <Button onClick={() => navigate('/connect-whatsapp')}>
            Conectar WhatsApp
          </Button>
        </div>
      );
    }
    
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Nenhum grupo encontrado</p>
        <p className="text-sm text-muted-foreground mt-2">
          Sua conta WhatsApp não está em nenhum grupo
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar grupos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedGroups.length > 0 && (
          <Badge variant="secondary">
            {selectedGroups.length} selecionado{selectedGroups.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <ScrollArea className="h-[400px] rounded-md border p-4">
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isSelected = selectedGroups.some(g => g.id === group.id);
            
            return (
              <div
                key={group.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent ${
                  isSelected ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => handleToggleGroup(group)}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleToggleGroup(group)}
                  onClick={(e) => e.stopPropagation()}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="font-medium truncate">{group.subject}</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {group.size} {group.size === 1 ? 'membro' : 'membros'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {filteredGroups.length === 0 && searchTerm && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhum grupo encontrado com "{searchTerm}"
        </p>
      )}
    </div>
  );
};
