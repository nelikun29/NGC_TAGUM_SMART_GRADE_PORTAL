-- Fixed-denominator grading extension
-- Quiz / Performance: grading_components.max_points is the overall denominator.
-- Exam: grading_subcomponents.max_points is the denominator for each exam period.
BEGIN;

ALTER TABLE grading_subcomponents
  ADD COLUMN IF NOT EXISTS max_points NUMERIC CHECK (max_points IS NULL OR max_points > 0);

-- Prevent activation/finalization when existing assessment maximums exceed a configured denominator.
CREATE OR REPLACE FUNCTION validate_grading_denominators_for_scheme(p_scheme_id TEXT)
RETURNS VOID AS $$
DECLARE
  r RECORD;
  configured NUMERIC;
BEGIN
  FOR r IN
    SELECT gc.id,gc.name,gc.source_type,gc.max_points
    FROM grading_components gc
    WHERE gc.scheme_id=p_scheme_id AND gc.is_active=TRUE
  LOOP
    IF r.max_points IS NOT NULL AND r.source_type='quiz' THEN
      SELECT COALESCE(SUM(q.total_items),0) INTO configured
      FROM quizzes q JOIN grading_schemes gs ON gs.class_id=q.class_id
      WHERE gs.id=p_scheme_id;
      IF configured > r.max_points THEN
        RAISE EXCEPTION 'Quiz configured maximum (%) exceeds Quiz Overall Total Score (%).', configured, r.max_points;
      END IF;
    ELSIF r.max_points IS NOT NULL AND r.source_type='performance' THEN
      SELECT COALESCE(SUM(p.max_score),0) INTO configured
      FROM performance_tasks p JOIN grading_schemes gs ON gs.class_id=p.class_id
      WHERE gs.id=p_scheme_id;
      IF configured > r.max_points THEN
        RAISE EXCEPTION 'Performance configured maximum (%) exceeds Performance Overall Total Score (%).', configured, r.max_points;
      END IF;
    END IF;
  END LOOP;

  FOR r IN
    SELECT gs2.name,gs2.source_filter,gs2.max_points,gs.class_id
    FROM grading_subcomponents gs2
    JOIN grading_components gc ON gc.id=gs2.component_id
    JOIN grading_schemes gs ON gs.id=gc.scheme_id
    WHERE gc.scheme_id=p_scheme_id AND gc.is_active=TRUE AND gs2.is_active=TRUE
      AND gc.source_type='exam' AND gs2.max_points IS NOT NULL
  LOOP
    SELECT COALESCE(SUM(e.max_score),0) INTO configured
    FROM examinations e
    WHERE e.class_id=r.class_id
      AND lower(COALESCE(e.exam_type,''))=lower(COALESCE(r.source_filter,r.name));
    IF configured > r.max_points THEN
      RAISE EXCEPTION '% configured exam maximum (%) exceeds its Overall Total Score (%).', r.name, configured, r.max_points;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_validate_grading_denominators_on_state()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.state IN ('active','finalized') THEN
    PERFORM validate_grading_denominators_for_scheme(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_grading_denominators_on_state ON grading_schemes;
CREATE TRIGGER validate_grading_denominators_on_state
BEFORE INSERT OR UPDATE OF state ON grading_schemes
FOR EACH ROW EXECUTE FUNCTION trg_validate_grading_denominators_on_state();

COMMIT;
