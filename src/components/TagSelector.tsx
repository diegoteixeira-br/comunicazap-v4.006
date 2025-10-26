import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tag as TagIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export const TagSelector = ({ selectedTags, onTagsChange }: TagSelectorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [availableTags, setAvailableTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTags();
    }
  }, [user]);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('tags')
        .eq('user_id', user?.id)
        .eq('status', 'active');

      if (error) throw error;

      // Count tag occurrences
      const tagCounts: Record<string, number> = {};
      contacts?.forEach(contact => {
        contact.tags?.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      const tagsArray = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);

      setAvailableTags(tagsArray);
    } catch (error: any) {
      console.error('Error fetching tags:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as tags",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (availableTags.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TagIcon className="h-5 w-5" />
            Selecione Tags
          </CardTitle>
          <CardDescription>
            Nenhuma tag disponível. Adicione tags aos seus contatos primeiro.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TagIcon className="h-5 w-5" />
          Selecione Tags
        </CardTitle>
        <CardDescription>
          Escolha as tags dos contatos que receberão a campanha
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {availableTags.map(({ tag, count }) => (
            <div key={tag} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`tag-${tag}`}
                  checked={selectedTags.includes(tag)}
                  onCheckedChange={() => toggleTag(tag)}
                />
                <Label 
                  htmlFor={`tag-${tag}`}
                  className="cursor-pointer font-medium flex items-center gap-2"
                >
                  {tag}
                  <Badge variant="secondary" className="ml-2">
                    {count} contato{count !== 1 ? 's' : ''}
                  </Badge>
                </Label>
              </div>
            </div>
          ))}
        </div>
        
        {selectedTags.length > 0 && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm font-medium mb-2">Tags selecionadas:</p>
            <div className="flex flex-wrap gap-2">
              {selectedTags.map(tag => (
                <Badge key={tag} variant="default">
                  <TagIcon className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
