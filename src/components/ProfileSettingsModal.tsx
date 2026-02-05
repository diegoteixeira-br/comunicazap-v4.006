import { useState, useRef, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/sessionClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Camera, Trash2, Loader2, User as UserIcon, Lock, Save, FileText } from 'lucide-react';
import { formatDocument, getDocumentTypeName, validateDocument, cleanDocument } from '@/lib/document';

interface ProfileSettingsModalProps {
  open: boolean;
  onClose: () => void;
  user: User;
  profile: { full_name: string | null; avatar_url: string | null; document?: string | null } | null;
  onProfileUpdate: () => void;
}

export const ProfileSettingsModal = ({
  open,
  onClose,
  user,
  profile,
  onProfileUpdate,
}: ProfileSettingsModalProps) => {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [document, setDocument] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasExistingDocument = !!profile?.document;

  // Update fullName when profile changes
  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile?.full_name]);

  // Handle document input with mask
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDocument(e.target.value);
    setDocument(formatted);
    setDocumentError('');
  };

  // Check if document already exists
  const checkDocumentExists = async (doc: string): Promise<boolean> => {
    const clean = cleanDocument(doc);
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('document', clean)
      .neq('id', user.id)
      .maybeSingle();
    return !!data;
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user.email?.charAt(0).toUpperCase() || 'U';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 2MB.',
        variant: 'destructive',
      });
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return;

    setUploadingAvatar(true);
    try {
      // Delete old avatar if exists
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      // Upload new avatar
      const fileExt = avatarFile.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast({
        title: 'Foto atualizada',
        description: 'Sua foto de perfil foi atualizada com sucesso.',
      });

      setAvatarFile(null);
      setAvatarPreview(null);
      onProfileUpdate();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Erro ao enviar foto',
        description: error.message || 'Não foi possível atualizar sua foto.',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    if (!profile?.avatar_url) return;

    setRemovingAvatar(true);
    try {
      // Extract file path from URL
      const urlParts = profile.avatar_url.split('/');
      const filePath = `${user.id}/${urlParts[urlParts.length - 1]}`;

      // Delete from storage
      await supabase.storage.from('avatars').remove([filePath]);

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Foto removida',
        description: 'Sua foto de perfil foi removida.',
      });

      onProfileUpdate();
    } catch (error: any) {
      console.error('Remove error:', error);
      toast({
        title: 'Erro ao remover foto',
        description: error.message || 'Não foi possível remover sua foto.',
        variant: 'destructive',
      });
    } finally {
      setRemovingAvatar(false);
    }
  };

  const saveProfile = async () => {
    if (!fullName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor, preencha seu nome.',
        variant: 'destructive',
      });
      return;
    }

    // Validate document if user doesn't have one yet and is providing one
    if (!hasExistingDocument && document) {
      const clean = cleanDocument(document);
      if (clean.length > 0 && !validateDocument(clean)) {
        setDocumentError('CPF ou CNPJ inválido');
        return;
      }

      // Check if document already exists
      if (clean.length === 11 || clean.length === 14) {
        const exists = await checkDocumentExists(document);
        if (exists) {
          setDocumentError('Este CPF/CNPJ já está vinculado a outra conta');
          toast({
            title: 'Documento já cadastrado',
            description: 'Este CPF/CNPJ já está vinculado a outra conta.',
            variant: 'destructive',
          });
          return;
        }
      }
    }

    setSavingProfile(true);
    try {
      const updateData: { full_name: string; document?: string } = { 
        full_name: fullName.trim() 
      };
      
      // Only update document if user doesn't have one and is providing one
      if (!hasExistingDocument && document) {
        const clean = cleanDocument(document);
        if (clean.length === 11 || clean.length === 14) {
          updateData.document = clean;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram salvas com sucesso.',
      });

      onProfileUpdate();
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar suas informações.',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'A confirmação de senha não corresponde.',
        variant: 'destructive',
      });
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Senha alterada',
        description: 'Sua senha foi atualizada com sucesso.',
      });

      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Password error:', error);
      toast({
        title: 'Erro ao alterar senha',
        description: error.message || 'Não foi possível alterar sua senha.',
        variant: 'destructive',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const formattedDocument = profile?.document ? formatDocument(profile.document) : null;
  const documentTypeName = profile?.document ? getDocumentTypeName(profile.document) : null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Configurações do Perfil
          </DialogTitle>
          <DialogDescription>
            Gerencie suas informações pessoais e segurança
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarImage src={avatarPreview || profile?.avatar_url || undefined} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {getInitials()}
              </AvatarFallback>
            </Avatar>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />

            <div className="flex gap-2">
              {avatarFile ? (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={uploadAvatar}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar foto
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {profile?.avatar_url ? 'Trocar foto' : 'Adicionar foto'}
                  </Button>
                  {profile?.avatar_url && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={removeAvatar}
                      disabled={removingAvatar}
                    >
                      {removingAvatar ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Personal Info Section */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Informações Pessoais
            </h3>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                O email não pode ser alterado
              </p>
            </div>

            {hasExistingDocument ? (
              <div className="space-y-2">
                <Label htmlFor="document" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {documentTypeName}
                </Label>
                <Input
                  id="document"
                  value={formattedDocument || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  O documento não pode ser alterado por segurança
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="document" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  CPF ou CNPJ
                </Label>
                <Input
                  id="document"
                  value={document}
                  onChange={handleDocumentChange}
                  placeholder="000.000.000-00"
                  maxLength={18}
                  className={documentError ? 'border-destructive' : ''}
                />
                {documentError ? (
                  <p className="text-xs text-destructive">{documentError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Informe seu CPF ou CNPJ para continuar usando a plataforma
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={saveProfile}
              disabled={savingProfile}
              className="w-full"
            >
              {savingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar alterações
            </Button>
          </div>

          <Separator />

          {/* Security Section */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Segurança
            </h3>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>

            <Button
              onClick={changePassword}
              disabled={savingPassword || !newPassword || !confirmPassword}
              variant="secondary"
              className="w-full"
            >
              {savingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Alterar senha
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
