-- Up Migration

ALTER TABLE echoroom.moderation_decisions
  DROP CONSTRAINT IF EXISTS moderation_decisions_decision_check;

ALTER TABLE echoroom.moderation_decisions
  ADD CONSTRAINT moderation_decisions_decision_check
  CHECK (decision IN ('hide', 'unhide', 'verify', 'unverify', 'dismiss'));


-- Down Migration

ALTER TABLE echoroom.moderation_decisions
  DROP CONSTRAINT IF EXISTS moderation_decisions_decision_check;

ALTER TABLE echoroom.moderation_decisions
  ADD CONSTRAINT moderation_decisions_decision_check
  CHECK (decision IN ('hide', 'unhide', 'verify', 'unverify'));