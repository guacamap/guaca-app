-- Guaca says hello first when a traveller opens the conversation.
alter table guaca_messages drop constraint guaca_messages_trigger_check;
alter table guaca_messages add constraint guaca_messages_trigger_check
  check (trigger in ('welcome','rain_replan','storm','morning_plan','evening_checkin','stop_verified','stop_rejected','next_stop'));
