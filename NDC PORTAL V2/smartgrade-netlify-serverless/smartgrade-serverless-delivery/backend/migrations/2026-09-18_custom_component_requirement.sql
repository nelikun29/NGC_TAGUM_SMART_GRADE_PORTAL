-- Add explicit requirement rule for grading components.
-- Existing components remain required by default.
BEGIN;
ALTER TABLE grading_components
  ADD COLUMN IF NOT EXISTS requirement TEXT NOT NULL DEFAULT 'required';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grading_components_requirement_check'
  ) THEN
    ALTER TABLE grading_components
      ADD CONSTRAINT grading_components_requirement_check
      CHECK (requirement IN ('required','optional'));
  END IF;
END $$;

-- Optional components are non-contributing placeholders until activated by
-- assigning them a positive weight and changing them to Required.
UPDATE grading_components
SET requirement='required'
WHERE requirement IS NULL OR requirement NOT IN ('required','optional');
COMMIT;
