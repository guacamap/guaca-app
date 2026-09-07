-- Task kind is how the Spotter map labels work (clock, camera, access).
-- Status remains the lifecycle. Null is allowed for historical missions.
alter table missions
  add column if not exists task_kind text
    check (task_kind is null or task_kind in ('hours', 'access', 'evidence'));
