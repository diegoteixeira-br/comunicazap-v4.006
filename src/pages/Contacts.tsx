import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Tag as TagIcon, 
  Trash2, 
  Edit, 
  UserX,
  UserCheck,
  X
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Contact {
  id: string;
  phone_number: string;
  name: string | null;
  tags: string[];
  status: string;
  created_at: string;
}

const Contacts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  const [newContact, setNewContact] = useState({ phone: "", name: "", tags: "" });
  const [editTags, setEditTags] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user]);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchTerm, statusFilter, tagFilter]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setContacts(data || []);
      
      // Extract all unique tags
      const tagsSet = new Set<string>();
      data?.forEach(contact => {
        contact.tags?.forEach((tag: string) => tagsSet.add(tag));
      });
      setAllTags(Array.from(tagsSet).sort());
      
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

  const filterContacts = () => {
    let filtered = contacts;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name?.toLowerCase().includes(search) || 
        c.phone_number.includes(search)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    if (tagFilter) {
      filtered = filtered.filter(c => c.tags?.includes(tagFilter));
    }

    setFilteredContacts(filtered);
  };

  const handleAddContact = async () => {
    if (!newContact.phone) {
      toast({
        title: "Erro",
        description: "O número de telefone é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      const tags = newContact.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const { error } = await supabase
        .from('contacts')
        .insert({
          user_id: user?.id,
          phone_number: newContact.phone,
          name: newContact.name || null,
          tags: tags,
          status: 'active'
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Contato adicionado com sucesso"
      });

      setShowAddDialog(false);
      setNewContact({ phone: "", name: "", tags: "" });
      fetchContacts();
    } catch (error: any) {
      console.error('Error adding contact:', error);
      toast({
        title: "Erro",
        description: error.message.includes('duplicate') 
          ? "Este contato já existe" 
          : "Não foi possível adicionar o contato",
        variant: "destructive"
      });
    }
  };

  const handleEditContact = async () => {
    if (!editingContact) return;

    try {
      const tags = editTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const { error } = await supabase
        .from('contacts')
        .update({
          name: editingContact.name,
          tags: tags
        })
        .eq('id', editingContact.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Contato atualizado com sucesso"
      });

      setShowEditDialog(false);
      setEditingContact(null);
      fetchContacts();
    } catch (error: any) {
      console.error('Error updating contact:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o contato",
        variant: "destructive"
      });
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Tem certeza que deseja excluir este contato?")) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Contato excluído com sucesso"
      });

      fetchContacts();
    } catch (error: any) {
      console.error('Error deleting contact:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o contato",
        variant: "destructive"
      });
    }
  };

  const handleBulkAddTags = async () => {
    if (selectedContacts.size === 0 || !bulkTags.trim()) return;

    try {
      const newTags = bulkTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const selectedContactsList = contacts.filter(c => selectedContacts.has(c.id));

      for (const contact of selectedContactsList) {
        const updatedTags = [...new Set([...contact.tags, ...newTags])];
        
        await supabase
          .from('contacts')
          .update({ tags: updatedTags })
          .eq('id', contact.id);
      }

      toast({
        title: "Sucesso",
        description: `Tags adicionadas a ${selectedContacts.size} contato(s)`
      });

      setShowBulkTagDialog(false);
      setBulkTags("");
      setSelectedContacts(new Set());
      fetchContacts();
    } catch (error: any) {
      console.error('Error adding bulk tags:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar as tags",
        variant: "destructive"
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return;
    if (!confirm(`Tem certeza que deseja excluir ${selectedContacts.size} contato(s)?`)) return;

    try {
      for (const contactId of Array.from(selectedContacts)) {
        await supabase
          .from('contacts')
          .delete()
          .eq('id', contactId);
      }

      toast({
        title: "Sucesso",
        description: `${selectedContacts.size} contato(s) excluído(s)`
      });

      setSelectedContacts(new Set());
      fetchContacts();
    } catch (error: any) {
      console.error('Error bulk deleting:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir os contatos",
        variant: "destructive"
      });
    }
  };

  const toggleContactSelection = (contactId: string) => {
    const newSelection = new Set(selectedContacts);
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId);
    } else {
      newSelection.add(contactId);
    }
    setSelectedContacts(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Gestão de Contatos</h1>
              <p className="text-muted-foreground mt-1">
                Gerencie seus contatos e organize por tags
              </p>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Contato
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="unsubscribed">Descadastrados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as tags</SelectItem>
                  {allTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedContacts.size > 0 && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowBulkTagDialog(true)}
                  >
                    <TagIcon className="mr-2 h-4 w-4" />
                    Adicionar Tags ({selectedContacts.size})
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contacts List */}
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </CardContent>
          </Card>
        ) : filteredContacts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">Nenhum contato encontrado</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Primeiro Contato
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{filteredContacts.length} Contatos</CardTitle>
                <Checkbox
                  checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                  onCheckedChange={toggleAllSelection}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Checkbox
                        checked={selectedContacts.has(contact.id)}
                        onCheckedChange={() => toggleContactSelection(contact.id)}
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">
                            {contact.name || contact.phone_number}
                          </span>
                          {contact.status === 'active' ? (
                            <Badge variant="default" className="gap-1">
                              <UserCheck className="h-3 w-3" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <UserX className="h-3 w-3" />
                              Descadastrado
                            </Badge>
                          )}
                        </div>
                        {contact.name && (
                          <p className="text-sm text-muted-foreground">
                            {contact.phone_number}
                          </p>
                        )}
                        {contact.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {contact.tags.map((tag, idx) => (
                              <Badge key={idx} variant="outline">
                                <TagIcon className="h-3 w-3 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingContact(contact);
                          setEditTags(contact.tags.join(', '));
                          setShowEditDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteContact(contact.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Contact Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Contato</DialogTitle>
              <DialogDescription>
                Adicione um novo contato à sua lista
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  placeholder="+5511999999999"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  placeholder="Nome do contato"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                <Input
                  id="tags"
                  placeholder="cliente, vip, campanha2024"
                  value={newContact.tags}
                  onChange={(e) => setNewContact({ ...newContact, tags: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddContact}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Contact Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Contato</DialogTitle>
              <DialogDescription>
                Atualize as informações do contato
              </DialogDescription>
            </DialogHeader>
            {editingContact && (
              <div className="space-y-4">
                <div>
                  <Label>Telefone</Label>
                  <Input value={editingContact.phone_number} disabled />
                </div>
                <div>
                  <Label htmlFor="edit-name">Nome</Label>
                  <Input
                    id="edit-name"
                    value={editingContact.name || ""}
                    onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-tags">Tags (separadas por vírgula)</Label>
                  <Input
                    id="edit-tags"
                    placeholder="cliente, vip, campanha2024"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditContact}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Add Tags Dialog */}
        <Dialog open={showBulkTagDialog} onOpenChange={setShowBulkTagDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Tags em Massa</DialogTitle>
              <DialogDescription>
                Adicione tags a {selectedContacts.size} contato(s) selecionado(s)
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="bulk-tags">Tags (separadas por vírgula)</Label>
              <Input
                id="bulk-tags"
                placeholder="nova-tag, campanha2024"
                value={bulkTags}
                onChange={(e) => setBulkTags(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkTagDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleBulkAddTags}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Contacts;
