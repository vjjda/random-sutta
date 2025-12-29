update _search_params
set
    term = 'kāyānamantarena';

select
    *
from
    view_search_results;

select
    *
from
    view_grand_lookups
where
    key = 'kāyānamantarena';

select
    *
from
    view_grand_lookups
where
    key in (
        select
            key
        from
            lookups_fts
        where
            key match 'king*'
    );