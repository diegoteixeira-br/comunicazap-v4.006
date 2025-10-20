import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Users, Shuffle } from "lucide-react";
import { supabase } from "@/integrations/supabase/sessionClient";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  name: string;
  phone: string;
}

interface ImportContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (contacts: Contact[]) => void;
}

export const ImportContactsModal = ({ open, onOpenChange, onImport }: ImportContactsModalProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [randomQuantity, setRandomQuantity] = useState("50");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchContacts();
    } else {
      // Reset state when modal closes
      setContacts([]);
      setSelectedContacts(new Set());
      setSearchQuery("");
    }
  }, [open]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-whatsapp-contacts');

      if (error) throw error;

      if (data?.contacts) {
        setContacts(data.contacts);
        toast({
          title: "Contatos carregados",
          description: `${data.contacts.length} contatos encontrados`,
        });
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        title: "Erro ao carregar contatos",
        description: "Não foi possível buscar os contatos do WhatsApp",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    
    const query = searchQuery.toLowerCase();
    return contacts.filter(
      contact => 
        contact.name.toLowerCase().includes(query) || 
        contact.phone.includes(query)
    );
  }, [contacts, searchQuery]);

  const toggleContact = (phone: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(phone)) {
      newSelected.delete(phone);
    } else {
      newSelected.add(phone);
    }
    setSelectedContacts(newSelected);
  };

  const toggleAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.phone)));
    }
  };

  const removeSelected = () => {
    if (selectedContacts.size === 0) return;
    setContacts((prev) => prev.filter((c) => !selectedContacts.has(c.phone)));
    setSelectedContacts(new Set());
    toast({ title: "Contatos removidos", description: "Contatos selecionados removidos da lista" });
  };

  const loadRandomContacts = () => {
    const quantity = parseInt(randomQuantity) || 50;
    const shuffled = [...contacts].sort(() => Math.random() - 0.5);
    const random = shuffled.slice(0, Math.min(quantity, contacts.length));
    setSelectedContacts(new Set(random.map(c => c.phone)));
    
    toast({
      title: "Contatos selecionados",
      description: `${random.length} contatos aleatórios selecionados`,
    });
  };

  const handleImport = () => {
    const selected = contacts.filter(c => selectedContacts.has(c.phone));
    onImport(selected);
    onOpenChange(false);
    toast({
      title: "Contatos importados",
      description: `${selected.length} contatos adicionados à lista`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Importar Contatos do WhatsApp
          </DialogTitle>
          <DialogDescription>
            Selecione os contatos que deseja adicionar à lista de envio
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3">Carregando contatos...</span>
          </div>
        ) : (
          <>
            {/* Seleção Rápida */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="text-sm font-medium mb-3">Seleção Rápida</h4>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Quantidade"
                  value={randomQuantity}
                  onChange={(e) => setRandomQuantity(e.target.value)}
                  className="w-20 sm:w-32"
                  min="1"
                />
                <Button
                  variant="outline"
                  onClick={loadRandomContacts}
                  className="flex-1 text-xs sm:text-sm px-2 sm:px-4"
                >
                  <Shuffle className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <span className="hidden sm:inline">Carregar {randomQuantity} Contatos Aleatórios</span>
                  <span className="sm:hidden">Carregar {randomQuantity} Contatos</span>
                </Button>
              </div>
            </div>

            {/* Busca e Controles */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                    onCheckedChange={toggleAll}
                  />
                  <Label htmlFor="select-all" className="cursor-pointer">
                    Selecionar Todos
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {selectedContacts.size} de {filteredContacts.length} selecionados
                  </span>
                  <Button variant="destructive" size="sm" onClick={removeSelected} disabled={selectedContacts.size === 0}>
                    Excluir Selecionados
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista de Contatos */}
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2">
                {filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {contacts.length === 0 
                      ? "Nenhum contato encontrado" 
                      : "Nenhum contato corresponde à busca"
                    }
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.phone}
                        className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleContact(contact.phone)}
                      >
                        <Checkbox
                          checked={selectedContacts.has(contact.phone)}
                          onCheckedChange={() => toggleContact(contact.phone)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{contact.name}</p>
                          <p className="text-sm text-muted-foreground">{contact.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button 
            onClick={handleImport}
            disabled={selectedContacts.size === 0 || loading}
            className="w-full sm:w-auto text-xs sm:text-sm"
          >
            <span className="hidden sm:inline">Carregar {selectedContacts.size} Contatos Selecionados</span>
            <span className="sm:hidden">Carregar {selectedContacts.size} Contatos</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
