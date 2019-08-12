CREATE TABLE IF NOT EXISTS unfiltered_daily_status (
    filename VARCHAR(200) PRIMARY KEY,
    tdid INT4,
    query_start_date DATETIME,
    query_end_date DATETIME,
    workflow_step_adobe INT4,
    workflow_step_rds INT4,
    date_created DATETIME,
    date_updated DATETIME,
    processing_complete_rds BOOL,
    processing_complete_adobe BOOL,
    error_rds BOOL,
    error_adobe BOOL
);