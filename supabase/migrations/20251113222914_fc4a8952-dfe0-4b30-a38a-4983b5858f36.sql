-- Link import_jobs to migration_jobs
ALTER TABLE import_jobs 
ADD COLUMN migration_job_id UUID REFERENCES migration_jobs(id) ON DELETE SET NULL;