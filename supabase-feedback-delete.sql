/* Allow deleting feedback comments (run once in Supabase SQL Editor) */
drop policy if exists "Anyone can delete feedback" on feedback;
create policy "Anyone can delete feedback" on feedback for delete using (true);
