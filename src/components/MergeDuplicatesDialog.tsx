import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Merge, Cake, Tag as TagIcon, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contact {
  id: string;
  phone_number: string;
  name: string | null;
  tags: string[];
  status: string;
  created_at: string;
  birthday: string | null;
}

interface MergeDuplicatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: Map<string, Contact[]>;
  onMerge: (selections: Map<string, string>, mergeTags: boolean, mergeBirthday: boolean) => Promise<void>;
  isMerging: boolean;
}

export const MergeDuplicatesDialog = ({
  open,
  onOpenChange,
  duplicates,
  onMerge,
  isMerging,
}: MergeDuplicatesDialogProps) => {
  // Estado para armazenar a seleção de cada grupo (phone -> contactId selecionado)
  const [selections, setSelections] = useState<Map<string, string>>(new Map());
  const [mergeTags, setMergeTags] = useState(true);
  const [mergeBirthday, setMergeBirthday] = useState(true);

  // Pré-selecionar o melhor contato de cada grupo quando o dialog abre
  useEffect(() => {
    if (open && duplicates.size > 0) {
      const initialSelections = new Map<string, string>();
      
      duplicates.forEach((contactList, phone) => {
        // Ordenar para encontrar o melhor contato
        const sorted = [...contactList].sort((a, b) => {
          // 1. Priorizar quem tem aniversário
          const hasDateA = a.birthday ? 1 : 0;
          const hasDateB = b.birthday ? 1 : 0;
          if (hasDateB !== hasDateA) return hasDateB - hasDateA;
          
          // 2. Priorizar quem tem mais tags
          const tagsA = a.tags?.length || 0;
          const tagsB = b.tags?.length || 0;
          if (tagsB !== tagsA) return tagsB - tagsA;
          
          // 3. Priorizar nome mais curto/limpo
          const nameA = a.name?.length || 999;
          const nameB = b.name?.length || 999;
          if (nameA !== nameB) return nameA - nameB;
          
          // 4. Mais antigo primeiro
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        
        initialSelections.set(phone, sorted[0].id);
      });
      
      setSelections(initialSelections);
    }
  }, [open, duplicates]);

  const handleSelectionChange = (phone: string, contactId: string) => {
    setSelections(prev => {
      const newSelections = new Map(prev);
      newSelections.set(phone, contactId);
      return newSelections;
    });
  };

  const handleMerge = async () => {
    await onMerge(selections, mergeTags, mergeBirthday);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatCreatedAt = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Mesclar Contatos Duplicados
          </DialogTitle>
          <DialogDescription>
            {duplicates.size === 0 
              ? "Nenhuma duplicata encontrada" 
              : `Encontramos ${duplicates.size} grupo(s) de contatos com o mesmo número. Selecione qual manter em cada grupo.`
            }
          </DialogDescription>
        </DialogHeader>

        {duplicates.size === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              ✅ Nenhuma duplicata encontrada!
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Todos os seus contatos têm números únicos.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Opções de merge */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <p className="text-sm font-medium">Opções de mesclagem:</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="merge-tags"
                    checked={mergeTags}
                    onCheckedChange={(checked) => setMergeTags(checked === true)}
                  />
                  <Label htmlFor="merge-tags" className="text-sm cursor-pointer">
                    Mesclar todas as tags no contato selecionado
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="merge-birthday"
                    checked={mergeBirthday}
                    onCheckedChange={(checked) => setMergeBirthday(checked === true)}
                  />
                  <Label htmlFor="merge-birthday" className="text-sm cursor-pointer">
                    Manter aniversário se existir em algum contato
                  </Label>
                </div>
              </div>
            </div>

            {/* Lista de grupos de duplicatas */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {Array.from(duplicates.entries()).map(([phone, contactList]) => (
                <div key={phone} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 border-b">
                    <p className="font-medium text-sm flex items-center gap-2">
                      📱 Telefone: {phone}
                      <Badge variant="secondary" className="text-xs">
                        {contactList.length} contatos
                      </Badge>
                    </p>
                  </div>
                  
                  <RadioGroup
                    value={selections.get(phone) || ''}
                    onValueChange={(value) => handleSelectionChange(phone, value)}
                    className="p-2"
                  >
                    {contactList.map((contact) => {
                      const isSelected = selections.get(phone) === contact.id;
                      
                      return (
                        <div
                          key={contact.id}
                          className={`flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                            isSelected 
                              ? 'bg-primary/10 border border-primary/30' 
                              : 'hover:bg-muted/50 border border-transparent'
                          }`}
                          onClick={() => handleSelectionChange(phone, contact.id)}
                        >
                          <RadioGroupItem
                            value={contact.id}
                            id={contact.id}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-medium ${isSelected ? 'text-primary' : ''}`}>
                                {contact.name || 'Sem nome'}
                              </span>
                              {isSelected && (
                                <Badge variant="default" className="text-xs">
                                  Manter
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-xs text-muted-foreground mt-1">
                              {contact.phone_number}
                            </p>
                            
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {contact.birthday && (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <Cake className="h-3 w-3" />
                                  {contact.birthday.split('-').slice(1).reverse().join('/')}
                                </Badge>
                              )}
                              {contact.tags && contact.tags.length > 0 ? (
                                contact.tags.map((tag, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    <TagIcon className="h-2.5 w-2.5 mr-1" />
                                    {tag}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">Sem tags</span>
                              )}
                            </div>
                            
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Criado em: {formatCreatedAt(contact.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMerging}>
            Cancelar
          </Button>
          {duplicates.size > 0 && (
            <Button onClick={handleMerge} disabled={isMerging}>
              {isMerging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Merge className="mr-2 h-4 w-4" />
              Mesclar {duplicates.size} Grupo(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
