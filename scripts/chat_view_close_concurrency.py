"""Deterministic session-row lock races for the patient close-view RPC."""
import time
from concurrent.futures import ThreadPoolExecutor


def run_chat_view_close_concurrency(query, open_holder, finish_holder):
    uid = '00000000-0000-0000-0000-000000000001'
    query_timeout = 15

    def bounded_query(sql, timeout=query_timeout):
        if timeout <= 0:
            raise TimeoutError('Chat close race query exceeded its deadline')
        statement_timeout_ms = max(1, int((timeout - .5) * 1000))
        bounded_sql = (f"set statement_timeout='{statement_timeout_ms}ms'; "
                       "set idle_in_transaction_session_timeout='30s';\n" + sql)
        return query(bounded_sql, timeout=timeout)

    def value(sql, timeout=query_timeout):
        return bounded_query(sql, timeout=timeout).splitlines()[2].strip()

    def wait_for(predicate, label):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            if value(f'select {predicate};', timeout=min(query_timeout, remaining)) == 't':
                return
            time.sleep(.02)
        raise RuntimeError(f'Chat close race barrier not observed: {label}')

    def create_session(number):
        sid = f'20000000-0000-0000-0000-{number:012d}'
        cid = f'10000000-0000-0000-0000-{number:012d}'
        bounded_query(f"insert into conversations(id,user_id) values('{cid}','{uid}'); "
                      f"insert into clinical_sessions(id,user_id,conversation_id) values('{sid}','{uid}','{cid}');")
        return sid

    # Admission locks the session first. The close starts only after we have
    # observed the admitted turn holding that lock; PostgreSQL must then make
    # the close wait and return turn_pending after the admission commits.
    admitted_sid = create_session(22)
    admitted_holder = 'serenia-view-close-admission-holder'
    close_waiter = 'serenia-view-close-after-admission'
    query_timeout = 15
    holder = open_holder(f"""set application_name='{admitted_holder}'; begin; set role service_role;
        select begin_chat_turn('{admitted_sid}','{uid}','close-race','Synthetic concurrent turn',false);
        reset role;""")
    try:
        wait_for(f"exists(select 1 from pg_stat_activity where application_name='{admitted_holder}' and state='idle in transaction')", 'admission lock held')
        with ThreadPoolExecutor(max_workers=2) as pool:
            closer = pool.submit(bounded_query, f"""set application_name='{close_waiter}'; set role authenticated;
                set request.jwt.claim.sub='{uid}';
                select close_session_from_chat_view('{admitted_sid}','user_request',null,null);""")
            try:
                wait_for(
                    f"exists(select 1 from pg_stat_activity waiter join pg_stat_activity holder "
                    f"on holder.pid=any(pg_blocking_pids(waiter.pid)) "
                    f"where waiter.application_name='{close_waiter}' and holder.application_name='{admitted_holder}')",
                    'close blocked by the admitted-turn transaction',
                )
            finally:
                finish_holder(holder)
            close_result = closer.result(timeout=query_timeout)
    finally:
        if holder.poll() is None:
            finish_holder(holder)
    if 'turn_pending' not in close_result:
        raise RuntimeError('Close did not observe the turn admitted before its session lock')
    if value(f"select status from clinical_sessions where id='{admitted_sid}';") != 'open' or value(f"select status from chat_turns where session_id='{admitted_sid}';") != 'generating':
        raise RuntimeError('Close changed an admitted turn while refusing the close')
    # Keep the fixture's one-open-session-per-user invariant before setting up
    # the inverse lock order for the same synthetic actor.
    bounded_query(f"set role service_role; select close_session_atomic('{admitted_sid}','{uid}','user_request');")

    # The inverse acquisition order also matters. If the close has the session
    # lock first, later admission must wait, then reject the now-closed session.
    closed_sid = create_session(23)
    close_holder = 'serenia-view-close-holder'
    begin_waiter = 'serenia-begin-after-view-close'
    holder = open_holder(f"""set application_name='{close_holder}'; begin; set role authenticated;
        set request.jwt.claim.sub='{uid}';
        select close_session_from_chat_view('{closed_sid}','user_request',null,null);
        reset role;""")
    try:
        wait_for(f"exists(select 1 from pg_stat_activity where application_name='{close_holder}' and state='idle in transaction')", 'close lock held')
        with ThreadPoolExecutor(max_workers=2) as pool:
            begin = pool.submit(bounded_query, f"""set application_name='{begin_waiter}'; set role service_role;
                select begin_chat_turn('{closed_sid}','{uid}','late-turn','Synthetic late turn',false);""")
            try:
                wait_for(
                    f"exists(select 1 from pg_stat_activity waiter join pg_stat_activity holder "
                    f"on holder.pid=any(pg_blocking_pids(waiter.pid)) "
                    f"where waiter.application_name='{begin_waiter}' and holder.application_name='{close_holder}')",
                    'admission blocked by the closing-session transaction',
                )
            finally:
                finish_holder(holder)
            try:
                begin.result(timeout=query_timeout)
            except RuntimeError as error:
                if 'Session closed' not in str(error):
                    raise
            else:
                raise RuntimeError('Turn was admitted after a committed session close')
    finally:
        if holder.poll() is None:
            finish_holder(holder)
    if value(f"select status from clinical_sessions where id='{closed_sid}';") != 'closed' or value(f"select count(*) from chat_turns where session_id='{closed_sid}';") != '0':
        raise RuntimeError('Turn appeared after the close acquired the session lock')
