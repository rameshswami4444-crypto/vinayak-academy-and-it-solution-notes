-- READ ONLY: foreign key audit for the live Supabase database.
-- This query does not modify schema or data.

select
    con.conname as constraint_name,
    src_ns.nspname as table_schema,
    src.relname as table_name,
    src_col.attname as column_name,
    ref_ns.nspname as referenced_schema,
    ref.relname as referenced_table,
    ref_col.attname as referenced_column,
    case con.confdeltype
        when 'a' then 'NO ACTION'
        when 'r' then 'RESTRICT'
        when 'c' then 'CASCADE'
        when 'n' then 'SET NULL'
        when 'd' then 'SET DEFAULT'
    end as on_delete,
    case con.confupdtype
        when 'a' then 'NO ACTION'
        when 'r' then 'RESTRICT'
        when 'c' then 'CASCADE'
        when 'n' then 'SET NULL'
        when 'd' then 'SET DEFAULT'
    end as on_update,
    pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class src on src.oid = con.conrelid
join pg_namespace src_ns on src_ns.oid = src.relnamespace
join pg_class ref on ref.oid = con.confrelid
join pg_namespace ref_ns on ref_ns.oid = ref.relnamespace
join lateral unnest(con.conkey) with ordinality src_keys(attnum, ord) on true
join lateral unnest(con.confkey) with ordinality ref_keys(attnum, ord) on ref_keys.ord = src_keys.ord
join pg_attribute src_col on src_col.attrelid = src.oid and src_col.attnum = src_keys.attnum
join pg_attribute ref_col on ref_col.attrelid = ref.oid and ref_col.attnum = ref_keys.attnum
where con.contype = 'f'
  and src_ns.nspname = 'public'
order by src.relname, con.conname, src_keys.ord;

-- Focused ERP relationship audit.
select
    con.conname as constraint_name,
    src.relname as table_name,
    src_col.attname as column_name,
    ref.relname as referenced_table,
    ref_col.attname as referenced_column,
    case con.confdeltype
        when 'a' then 'NO ACTION'
        when 'r' then 'RESTRICT'
        when 'c' then 'CASCADE'
        when 'n' then 'SET NULL'
        when 'd' then 'SET DEFAULT'
    end as on_delete,
    pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class src on src.oid = con.conrelid
join pg_namespace src_ns on src_ns.oid = src.relnamespace
join pg_class ref on ref.oid = con.confrelid
join lateral unnest(con.conkey) with ordinality src_keys(attnum, ord) on true
join lateral unnest(con.confkey) with ordinality ref_keys(attnum, ord) on ref_keys.ord = src_keys.ord
join pg_attribute src_col on src_col.attrelid = src.oid and src_col.attnum = src_keys.attnum
join pg_attribute ref_col on ref_col.attrelid = ref.oid and ref_col.attnum = ref_keys.attnum
where con.contype = 'f'
  and src_ns.nspname = 'public'
  and (
    src.relname in ('students','student_fees','emis','payments','attendance_sessions','attendance_responses','batches','courses')
    or ref.relname in ('students','student_fees','emis','payments','attendance_sessions','attendance_responses','batches','courses')
  )
order by src.relname, con.conname;
