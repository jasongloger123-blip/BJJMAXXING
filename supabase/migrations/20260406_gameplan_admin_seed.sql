with inserted_plan as (
  insert into public.gameplans (
    slug,
    title,
    headline,
    status,
    creator_name,
    creator_role,
    creator_initials,
    creator_profile_href,
    canvas_width,
    canvas_height,
    main_path_node_ids,
    is_fallback_default
  )
  values (
    'seed-a-plan',
    'A-Plan',
    'Long Flexible Guard Player',
    'published',
    'FGES',
    'Fight School',
    'FG',
    '/profile',
    1680,
    1180,
    array['stand-up', 'closed-guard', 'backtake', 'rear-naked-choke'],
    true
  )
  on conflict (slug) do update
  set
    title = excluded.title,
    headline = excluded.headline,
    status = excluded.status,
    creator_name = excluded.creator_name,
    creator_role = excluded.creator_role,
    creator_initials = excluded.creator_initials,
    creator_profile_href = excluded.creator_profile_href,
    canvas_width = excluded.canvas_width,
    canvas_height = excluded.canvas_height,
    main_path_node_ids = excluded.main_path_node_ids,
    is_fallback_default = excluded.is_fallback_default,
    updated_at = now()
  returning id
)
insert into public.gameplan_nodes (
  id,
  plan_id,
  title,
  stage,
  label,
  description,
  outcome,
  focus_items,
  mistake_items,
  node_state,
  expansion_paths,
  source_node_id,
  unlock_phase,
  unlock_order,
  requires_validation,
  unlock_parent_node_id,
  canvas_x,
  canvas_y,
  tier,
  lane,
  node_size,
  order_index
)
select
  seeded.id,
  inserted_plan.id,
  seeded.title,
  seeded.stage,
  seeded.label,
  seeded.description,
  seeded.outcome,
  seeded.focus_items,
  seeded.mistake_items,
  seeded.node_state,
  seeded.expansion_paths,
  seeded.source_node_id,
  seeded.unlock_phase,
  seeded.unlock_order,
  seeded.requires_validation,
  seeded.unlock_parent_node_id,
  seeded.canvas_x,
  seeded.canvas_y,
  seeded.tier,
  seeded.lane,
  seeded.node_size,
  seeded.order_index
from inserted_plan
cross join (
  values
    ('stand-up','Stand Up','position','Startposition','Hier beginnt dein Game Plan im Stand, bevor du in deine Guard-Verbindungen oder direkten Folgepfade gehst.','Definiert den Einstiegspunkt fuer den A-Plan und die Verbindung in deine Close Guard.',array['Ersten Kontakt im Stand lesen','Balance vor dem Uebergang halten','Verbindung in die Guard frueh vorbereiten'],array['Zu statisch im Stand bleiben','Ohne Verbindung nach unten gehen','Die Folgeposition zu spaet aufbauen'],'completed','[["closed-guard","backtake","rear-naked-choke"],["closed-guard","off-balance","backtake"],["hip-bump-sweep","kuzushi-details","backtake"],["guillotine","front-headlock","mounted-guillotine"],["backtake-from-closed-guard","triangle-path","triangle-finish"]]'::jsonb,'node-1-guard-identity','core',1,false,null,24,186,0,1,'main',0),
    ('closed-guard','Closed Guard','position','Kontrolle & Grips','Hier baust du Kontrolle, Griffkampf und Winkel auf, bevor du den Gegner wirklich kippst.','Gibt dir stabile Struktur fuer Kuzushi, Backtakes und Sweep-Druck.',array['Knie geschlossen halten','Kopfhaltung stoeren','Sauberen Zug an Arm oder Schulter holen'],array['Zu flach unter dem Gegner bleiben','Guard oeffnen ohne Grund','Keine aktive Griffkontrolle'],'completed','[["backtake","rear-naked-choke"],["off-balance","backtake"],["hip-bump-sweep","kuzushi-details","backtake"],["guillotine","front-headlock","mounted-guillotine"],["backtake-from-closed-guard","triangle-path","triangle-finish"]]'::jsonb,'node-2-guard-entry','core',2,false,null,344,186,1,1,'main',1),
    ('backtake','Back Take','position','Position sichern','Sobald der Gegner die Linie verliert, gehst du hinter die Huefte und uebernimmst den Ruecken.','Fuehrt in deine hoechstwertige Kontroll- und Submission-Position.',array['Huefte hinterlaufen','Brustkontakt halten','Seatbelt vor hektischen Hooks sichern'],array['Zu frueh nur auf die Hooks gehen','Seitlich am Ruecken haengen','Kopfposition verlieren'],'available','[["seatbelt-control"],["rear-naked-choke"],["back-crucifix"]]'::jsonb,'node-7-back-entry','core',3,false,null,664,186,2,1,'main',2),
    ('rear-naked-choke','Rear Naked Choke','submission','Submission','Klassischer Abschluss aus stabiler Rueckenkontrolle.','High-value Finish des A-Plans.',array['Kinnlinie lesen','Ellbogen nach hinten ziehen'],array['Zu viel squeeze ohne Position','Schulter nicht hinter dem Kopf'],'locked','[]'::jsonb,'node-9-rnc-finish','core',4,true,null,984,186,3,1,'main',3),
    ('off-balance','Off-Balance','pass','Gleichgewicht brechen','Du zwingst den Gegner nach vorne, zur Seite oder auf die Haende, damit sein Ruecken offen wird.','Schafft die ideale Vorarbeit fuer Backtake, Sweep oder Front-Headlock.',array['Kopf ueber die Hips ziehen','Winkel vor Kraft nutzen','Reaktion lesen und nachsetzen'],array['Nur mit Armen reissen','Zu frueh oeffnen','Gegner wieder stabil werden lassen'],'current','[["backtake","seatbelt-control","rear-naked-choke"],["wrestle-up","single-leg-finish"]]'::jsonb,'node-5-dlr-off-balance','expansion',1,false,'closed-guard',664,526,2,3,'branch',4),
    ('hip-bump-sweep','Hip Bump Sweep','pass','Alternative Position','Wenn der Gegner aufrecht bleibt, nutzt du die Reaktion fuer einen direkten Sweep.','Zweite starke Reaktion aus derselben Closed-Guard-Arbeit.',array['Hand posten erzwingen','Huefte seitlich hochbringen'],array['Zu weit weg bleiben','Keine Schulterlinie erzeugen'],'available','[["kuzushi-details","backtake"]]'::jsonb,'node-6-dlr-back-exposure','expansion',2,false,'closed-guard',344,526,1,3,'branch',5),
    ('guillotine','Guillotine','submission','Alternative Attack','Wenn der Kopf vorne bleibt, gehst du direkt in die Front-Headlock-Linie.','Erweitert dein Guard-Spiel um eine direkte Submission-Bedrohung.',array['Kopf einsammeln','Ellbogenlinie eng halten'],array['Zu hoch greifen','Kein Brustkontakt'],'available','[["front-headlock","mounted-guillotine"]]'::jsonb,'node-12-triangle-entry','expansion',3,false,'closed-guard',344,696,1,4,'branch',6),
    ('backtake-from-closed-guard','Backtake Route','pass','Direkter Winkel','Du oeffnest nur kurz, gewinnst den Winkel und nimmst direkt den Ruecken oder die Trap-Line.','Direkterer Weg zum Ruecken aus der Closed Guard.',array['Winkel zuerst','Rueckenlinie offen halten'],array['Zu gross oeffnen','Huefte nicht mitnehmen'],'available','[["triangle-path","triangle-finish"]]'::jsonb,'node-6-dlr-back-exposure','expansion',4,false,'closed-guard',664,696,2,4,'branch',7),
    ('kuzushi-details','Kuzushi Details','pass','Timing','Feinabstimmung fuer Zugrichtung, Timing und den Moment, in dem der Gegner wirklich leicht wird.','Macht dein Off-Balancing sauberer und reproduzierbarer.',array['Zugrichtung wechseln','Hand und Huefte koppeln'],array['Immer nur in eine Richtung ziehen','Timing nicht lesen'],'completed','[["backtake"]]'::jsonb,'node-3-dlr-connection','expansion',5,false,'hip-bump-sweep',664,866,2,5,'future',8),
    ('front-headlock','Front Headlock','position','Kontrolle','Wenn der Gegner nach vorne kippt, kontrollierst du Kopf und Schulter fuer den direkten Finish.','Sichert den guillotine-lastigen Zweig.',array['Kopf nach unten halten','Schulter blockieren'],array['Nur am Hals haengen','Huefte zu weit weg'],'available','[["mounted-guillotine"]]'::jsonb,'node-8-back-control','expansion',6,false,'guillotine',664,1036,2,6,'future',9),
    ('mounted-guillotine','Mounted Guillotine','submission','Submission','Kontrollierter Abschluss aus der Front-Headlock-Linie.','Direkter Finish, wenn der Kopf vorne bleibt.',array['Brust schwer machen','Wristline fixieren'],array['Zu frueh fallen','Kein Druck ueber den ganzen Koerper'],'locked','[]'::jsonb,'node-9-rnc-finish','expansion',7,false,'front-headlock',984,1036,3,6,'future',10),
    ('wrestle-up','Wrestle Up','pass','Alternative Pass','Wenn der Gegner dir zu viel Raum gibt, gehst du aus der Guard nach oben.','Bringt dich in den Takedown-Zweig statt in den Backtake.',array['Hand am Boden nutzen','Kopf ueber Knie bringen'],array['Zu spaet aufstehen','Ruecken rund lassen'],'available','[["single-leg-finish"]]'::jsonb,'node-18-top-backtake','expansion',8,false,'off-balance',984,526,3,3,'future',11),
    ('single-leg-finish','Single Leg Finish','pass','Top Entry','Finish des Wrestle-Up-Zweigs.','Top-Position als alternativer Abschluss.',array['Ecke laufen','Kopf innen halten'],array['Stehen bleiben','Kein Winkel beim Finish'],'available','[]'::jsonb,'node-19-top-rnc','expansion',9,false,'wrestle-up',1304,526,4,3,'future',12),
    ('seatbelt-control','Seatbelt Control','position','Kontrolle','Sichert den Ruecken vor dem eigentlichen Finish.','Macht den Finish-Druck belastbar.',array['Brustkontakt','Handlinie sichern'],array['Haken vor Seatbelt','Zu flach am Ruecken'],'completed','[]'::jsonb,'node-8-back-control','expansion',10,false,'backtake',984,356,3,2,'future',13),
    ('back-crucifix','Back Crucifix','submission','Alternative Finish','Wechsel auf eine kontrollierte Arm-Isolation vom Ruecken.','Alternative Endroute, wenn der Choke blockiert wird.',array['Arm einklemmen','Huefte dicht halten'],array['Zu locker am Oberkoerper','Winkel verlieren'],'locked','[]'::jsonb,'node-19-top-rnc','expansion',11,false,'seatbelt-control',1304,356,4,2,'future',14),
    ('triangle-path','Triangle Path','submission','Alternative Finish','Wenn der Ruecken nicht frei wird, klappst du auf die Triangle-Linie um.','Haelt den Gegner zwischen Backtake und Submission gefangen.',array['Knie ueber Schulter bringen','Winkel halten'],array['Flach bleiben','Zu spaet das Bein schwingen'],'locked','[["triangle-finish"]]'::jsonb,'node-12-triangle-entry','expansion',12,false,'backtake-from-closed-guard',984,696,3,4,'future',15),
    ('triangle-finish','Triangle Finish','submission','Submission','Sauberer Abschluss, wenn der Rueckenweg blockiert wird.','Dritte vernuenftige Endroute aus derselben Guard-Struktur.',array['Winkel schliessen','Knie zusammenziehen'],array['Zu frontal bleiben','Kein Zug am Kopf'],'locked','[]'::jsonb,'node-12-triangle-entry','expansion',13,false,'triangle-path',1304,696,4,4,'future',16)
) as seeded(id, title, stage, label, description, outcome, focus_items, mistake_items, node_state, expansion_paths, source_node_id, unlock_phase, unlock_order, requires_validation, unlock_parent_node_id, canvas_x, canvas_y, tier, lane, node_size, order_index)
on conflict (id) do update
set
  plan_id = excluded.plan_id,
  title = excluded.title,
  stage = excluded.stage,
  label = excluded.label,
  description = excluded.description,
  outcome = excluded.outcome,
  focus_items = excluded.focus_items,
  mistake_items = excluded.mistake_items,
  node_state = excluded.node_state,
  expansion_paths = excluded.expansion_paths,
  source_node_id = excluded.source_node_id,
  unlock_phase = excluded.unlock_phase,
  unlock_order = excluded.unlock_order,
  requires_validation = excluded.requires_validation,
  unlock_parent_node_id = excluded.unlock_parent_node_id,
  canvas_x = excluded.canvas_x,
  canvas_y = excluded.canvas_y,
  tier = excluded.tier,
  lane = excluded.lane,
  node_size = excluded.node_size,
  order_index = excluded.order_index;

with seeded_plan as (
  select id
  from public.gameplans
  where slug = 'seed-a-plan'
)
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
) as edge(from_node_id, to_node_id, order_index)
on conflict (plan_id, from_node_id, to_node_id) do update
set order_index = excluded.order_index;
