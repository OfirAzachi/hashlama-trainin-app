-- A distinct pace category for the simplified running flow, so its scoring
-- weight is explicit instead of borrowing another category's label. The
-- trainer never picks it — the builder sets it automatically when a running
-- training is created in "simple" mode (only a distance, no pace).
-- Its weight is set in the next migration (a new enum value can't be used in
-- the transaction that adds it).
alter type run_pace_category add value if not exists 'simple';
