
DROP POLICY IF EXISTS "Admin insere militares" ON public.militares;
DROP POLICY IF EXISTS "Admin atualiza militares" ON public.militares;

CREATE POLICY "Avaliador insere militares" ON public.militares
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'avaliador'::app_role));

CREATE POLICY "Avaliador atualiza militares" ON public.militares
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'avaliador'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'avaliador'::app_role));
