-- Allow users to update their own campaigns (for pause/cancel functionality)
CREATE POLICY "Users can update own campaigns" 
ON public.message_campaigns 
FOR UPDATE 
USING (auth.uid() = user_id);