-- Adicionar política para admins visualizarem todas as mensagens de suporte
CREATE POLICY "Admins can view all chat messages"
  ON public.support_chat_messages
  FOR SELECT
  USING (public.is_admin());