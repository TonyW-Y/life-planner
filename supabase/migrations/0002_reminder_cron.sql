-- Call send-reminders every minute using Supabase's free pg_cron + pg_net.
-- Before running this, store two secrets in the Vault (SQL editor):
--   select vault.create_secret('https://YOUR-PROJECT.supabase.co', 'project_url');
--   select vault.create_secret('YOUR-SERVICE-ROLE-KEY', 'service_role_key');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-reminders') where exists (select 1 from cron.job where jobname = 'send-reminders');
select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
