const db = require("./db")
const table = "github_events"


interface InsertEvent {
    repo_id: number,
    event: string,
    payload: string,
    delivery_id: string,
    source_type: string
}

const insert_github_event = async (data: InsertEvent) => {
    try {
        const query = db(table).insert({
            repository_id: data.repo_id,
            event_type: data.event,
            payload: data.payload,
            delivery_id: data.delivery_id,
            source_type: data.source_type
        })

        return await query
    } catch (error) {
        throw error
    }
}

const check_delivery = async (delivery_id: string, source: string) => {
    try {
        const query = db.select(["*"]).from(table).where({
            "delivery_id": delivery_id,
            "source_type": source
        }).first()

        return await query
    } catch (error) {
        throw error
    }
}

const pipeline_stats = async () => {
    try {
        let query = db.raw(`
                with cte as (
                    select DISTINCT on (payload -> 'workflow_run' ->> 'id')
                        (payload -> 'workflow_run' ->> 'id'):: BIGINT as run_id
                    from github_events
                    where event_type = 'workflow_run'
                    order by (payload -> 'workflow_run' ->> 'id'), (payload -> 'workflow_run' ->> 'created_at') DESC
                )
                select count(*) as total_builds from cte
            `)

        let query_2 = db.raw(`
                    with cte as (
                        select DISTINCT on (payload -> 'workflow_run' ->> 'id')
                            (payload -> 'workflow_run' ->> 'id')::BIGINT as run_id
                        from github_events
                        where event_type = 'workflow_run'
                        and (payload -> 'workflow_run' ->> 'conclusion') != 'success'
                    )
                    SELECT count(*) as failed_builds from cte
                `)

        const result = await query
        const result_2 = await query_2

        return {
            total_builds: result.rows[0].total_builds,
            failed_builds: result_2.rows[0].failed_builds,
        }
    } catch (error) {
        throw error
    }
}

const build_info_query = async () => {
    try {
        const query = db.raw(`
            SELECT DISTINCT on (payload -> 'workflow_run' ->> 'id')
                (payload -> 'workflow_run' ->> 'id'):: bigint as id,
                (payload -> 'workflow_run' ->> 'run_number'):: int as run_id,
                (payload -> 'repository' ->> 'name') as repo_name,
                (payload -> 'workflow_run' ->> 'updated_at') as created_at,
                CASE 
                    WHEN (payload -> 'workflow_run' ->> 'status') = 'queued' THEN 'running'
                    WHEN (payload -> 'workflow_run' ->> 'status') = 'in_progress' THEN 'running'
                    WHEN (payload -> 'workflow_run' ->> 'status') = 'completed' AND (payload -> 'workflow_run' ->> 'conclusion') = 'failure' THEN 'failed'
                    WHEN (payload -> 'workflow_run' ->> 'status') = 'completed' AND (payload -> 'workflow_run' ->> 'conclusion') = 'success' THEN 'success'
                    WHEN (payload -> 'workflow_run' ->> 'status') = 'completed' AND (payload -> 'workflow_run' ->> 'conclusion') = 'cancelled' THEN 'cancelled'
                    ELSE 'default'
                END as status
            FROM github_events
            where event_type = 'workflow_run'
            order by (payload -> 'workflow_run' ->> 'id'), (payload -> 'workflow_run' ->> 'updated_at') DESC 
        `)
        const result = await query
        return result.rows
    } catch (error) {
        throw error
    }
}

const branch_build_info_query = async () => {
    try {
        const query = db.raw(`
                SELECT DISTINCT on (payload -> 'workflow_run' ->> 'id')
                    (payload -> 'workflow_run' ->> 'id'):: bigint as id,
                    (payload -> 'workflow_run' ->> 'run_number') as run_number,
                    EXTRACT(EPOCH from (
                        (payload -> 'workflow_run' ->> 'updated_at'):: TIMESTAMP - (payload -> 'workflow_run' ->> 'run_started_at'):: TIMESTAMP
                    )) as duration,
                    (payload -> 'workflow' ->> 'name') as pipeline,
                    CASE 
                        When (payload -> 'workflow_run' ->> 'conclusion') = 'failure' THEN 'failed'
                        WHEN (payload -> 'workflow_run' ->> 'conclusion') = 'success' THEN 'success'
                        WHEN (payload -> 'workflow_run' ->> 'conclusion') = 'cancelled' THEN 'cancelled'
                        else 'default'
                    END as state,
                    (payload -> 'workflow_run' ->> 'status') as status
                from github_events
                where event_type = 'workflow_run' and (payload -> 'workflow_run' ->> 'head_branch') = 'main'
                order by (payload -> 'workflow_run' ->> 'id'), (payload -> 'workflow_run' ->> 'updated_at') desc
            `)
        const result = await query
        return result.rows
    } catch (error) {
        throw error
    }
}

const build_duration_by_date = async () => {
    try {
        const query = db.raw(`
                select DISTINCT on (payload -> 'workflow_run' ->> 'id')
                    to_char((payload -> 'workflow_run' ->> 'run_started_at')::TIMESTAMP, 'Mon DD') as date,
                    EXTRACT(EPOCH from ((payload -> 'workflow_run' ->> 'updated_at')::TIMESTAMP - (payload -> 'workflow_run' ->> 'run_started_at'):: TIMESTAMP)) as duration
                from github_events
                where event_type = 'workflow_run' and (payload -> 'workflow_run' ->> 'head_branch') = 'main'
                order by (payload -> 'workflow_run' ->> 'id'), (payload -> 'workflow_run' ->> 'updated_at') desc
            `)

        const result = await query
        return result.rows
    } catch (error) {
        throw error
    }
}





export {
    insert_github_event,
    check_delivery,
    pipeline_stats,
    build_info_query,
    branch_build_info_query,
    build_duration_by_date
}