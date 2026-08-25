-- How many of a run's plans the deterministic fast path answered without
-- the model. Those are constant across models; the rest is the model.
alter table ai_benchmarks add column fast_path int not null default 0;
