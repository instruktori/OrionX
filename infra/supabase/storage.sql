-- Private PDFs are accessed only by the trusted backend. No public read policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('passport-pdfs', 'passport-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
