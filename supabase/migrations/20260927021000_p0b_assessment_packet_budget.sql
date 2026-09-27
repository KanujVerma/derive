-- P0-B's supported 50-item routine can yield hundreds of distinct findings.
-- The prior 200 KB packet limit and 100 KB evaluated-input limit rejected
-- valid revision-bound results. Keep finite byte limits; no authority,
-- ownership, grants, mutation or replay behavior changes.
alter table public.personal_decision_assessments
  drop constraint personal_decision_assessments_packet_check,
  drop constraint personal_decision_assessments_input_check;
alter table public.personal_decision_assessments
  add constraint personal_decision_assessments_packet_check
    check (jsonb_typeof(packet) = 'object' and octet_length(packet::text) <= 1048576),
  add constraint personal_decision_assessments_input_check
    check (jsonb_typeof(input) = 'object' and octet_length(input::text) <= 524288);
