-- Allow the existing AI-writer draft table to store one LOR draft per application.
ALTER TABLE public.personal_statements
  DROP CONSTRAINT IF EXISTS personal_statements_doc_type_check;

ALTER TABLE public.personal_statements
  ADD CONSTRAINT personal_statements_doc_type_check
  CHECK (doc_type IN ('personal_statement', 'statement_of_purpose', 'recommendation_letter'));

CREATE INDEX IF NOT EXISTS idx_personal_statements_application_doc_type
  ON public.personal_statements(application_id, doc_type, updated_at DESC);
