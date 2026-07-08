/*
# Add disconnect finish reason

Separates tab/network disconnects from voluntary surrender in match history.
Ranking points still treat disconnect as a non-normal finish to reduce abuse.
*/

alter table public.player_match_results
drop constraint if exists player_match_results_finish_reason_check;

alter table public.player_match_results
add constraint player_match_results_finish_reason_check
check (finish_reason in ('normal', 'surrender', 'inactivity', 'disconnect'));
