with seeded_plan as (
  select id
  from public.gameplans
  where slug = 'seed-a-plan'
)
update public.gameplans
set main_path_node_ids = array['rear-naked-choke', 'backtake', 'closed-guard', 'stand-up'],
    updated_at = now()
where id in (select id from seeded_plan);

update public.gameplan_nodes
set title = 'De La Riva',
    label = 'Entry Position',
    description = 'Hier baust du deine De-La-Riva-Position auf, bevor du den Winkel fuer den Backtake oeffnest.',
    outcome = 'Gibt dir den klaren Einstieg in deinen Rueckenangriff.',
    focus_items = array['Hook und Distanz sauber setzen','Winkel fuer die Rotation vorbereiten','Balance des Gegners frueh lesen'],
    mistake_items = array['Zu flach vor dem Gegner bleiben','Hook ohne Kontrolle setzen','Winkel zu spaet aufbauen'],
    source_node_id = 'node-3-dlr-connection',
    unlock_phase = 'core',
    unlock_order = 3,
    requires_validation = false,
    unlock_parent_node_id = null,
    tier = 1,
    lane = 1,
    canvas_x = 344,
    canvas_y = 186
where id = 'closed-guard';

update public.gameplan_nodes
set source_node_id = 'node-1-guard-identity',
    unlock_phase = 'core',
    unlock_order = 4,
    requires_validation = true,
    unlock_parent_node_id = null,
    tier = 0,
    lane = 1,
    canvas_x = 24,
    canvas_y = 186
where id = 'stand-up';

update public.gameplan_nodes
set source_node_id = 'node-7-back-entry',
    unlock_phase = 'core',
    unlock_order = 2,
    requires_validation = false,
    unlock_parent_node_id = null,
    tier = 2,
    lane = 1,
    canvas_x = 664,
    canvas_y = 186
where id = 'backtake';

update public.gameplan_nodes
set source_node_id = 'node-9-rnc-finish',
    unlock_phase = 'core',
    unlock_order = 1,
    requires_validation = false,
    unlock_parent_node_id = null,
    tier = 3,
    lane = 1,
    canvas_x = 984,
    canvas_y = 186
where id = 'rear-naked-choke';

update public.gameplan_nodes
set unlock_phase = 'expansion',
    unlock_parent_node_id = 'closed-guard'
where id in ('off-balance', 'hip-bump-sweep', 'guillotine', 'backtake-from-closed-guard');

update public.gameplan_nodes
set unlock_phase = 'expansion',
    unlock_parent_node_id = 'backtake'
where id = 'seatbelt-control';

update public.gameplan_nodes
set unlock_phase = 'expansion',
    unlock_parent_node_id = 'seatbelt-control'
where id = 'back-crucifix';

update public.gameplan_nodes
set unlock_phase = 'expansion',
    unlock_parent_node_id = 'off-balance'
where id = 'wrestle-up';

update public.gameplan_nodes
set unlock_phase = 'expansion',
    unlock_parent_node_id = 'wrestle-up'
where id = 'single-leg-finish';

update public.gameplan_nodes
set unlock_phase = 'expansion',
    unlock_parent_node_id = 'guillotine'
where id = 'front-headlock';

update public.gameplan_nodes
set unlock_phase = 'expansion',
    unlock_parent_node_id = 'front-headlock'
where id = 'mounted-guillotine';

update public.gameplan_nodes
set unlock_phase = 'expansion',
    unlock_parent_node_id = 'backtake-from-closed-guard'
where id = 'triangle-path';

update public.gameplan_nodes
set unlock_phase = 'expansion',
    unlock_parent_node_id = 'triangle-path'
where id = 'triangle-finish';

delete from public.gameplan_edges
where plan_id in (select id from seeded_plan);

insert into public.gameplan_edges (plan_id, from_node_id, to_node_id, label, order_index)
select seeded_plan.id, edge.from_node_id, edge.to_node_id, null, edge.order_index
from seeded_plan
cross join (
  values
    ('stand-up','closed-guard',0),
    ('closed-guard','backtake',1),
    ('backtake','rear-naked-choke',2),
    ('closed-guard','off-balance',3),
    ('closed-guard','hip-bump-sweep',4),
    ('closed-guard','guillotine',5),
    ('closed-guard','backtake-from-closed-guard',6),
    ('hip-bump-sweep','kuzushi-details',7),
    ('guillotine','front-headlock',8),
    ('front-headlock','mounted-guillotine',9),
    ('off-balance','wrestle-up',10),
    ('wrestle-up','single-leg-finish',11),
    ('backtake','seatbelt-control',12),
    ('seatbelt-control','back-crucifix',13),
    ('backtake-from-closed-guard','triangle-path',14),
    ('triangle-path','triangle-finish',15)
) as edge(from_node_id, to_node_id, order_index);
