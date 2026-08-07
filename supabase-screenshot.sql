/* Add screenshot support to feedback (run once in Supabase SQL Editor) */
alter table feedback
  add column if not exists screenshot_data text;

comment on column feedback.screenshot_data is 'Optional JPEG data URL of referenced UI';
