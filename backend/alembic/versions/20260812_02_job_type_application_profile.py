"""Job types, structured candidate profile and application snapshot."""
from alembic import op
import sqlalchemy as sa

revision = "20260812_02"
down_revision = "20260812_01"
branch_labels = None
depends_on = None


def _columns(table):
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table)}


def _add_columns(table, definitions):
    existing = _columns(table)
    with op.batch_alter_table(table) as batch:
        for name, column in definitions:
            if name not in existing:
                batch.add_column(column)


def upgrade():
    _add_columns("jobs", [
        ("job_type", sa.Column("job_type", sa.String(32), nullable=False, server_default="SOCIAL")),
    ])
    _add_columns("candidates", [
        ("identity_type", sa.Column("identity_type", sa.String(32), nullable=False, server_default="")),
        ("identity_number_encrypted", sa.Column("identity_number_encrypted", sa.Text(), nullable=False, server_default="")),
        ("identity_number_last4", sa.Column("identity_number_last4", sa.String(4), nullable=False, server_default="")),
        ("preferred_locations", sa.Column("preferred_locations", sa.JSON(), nullable=False, server_default="[]")),
        ("education", sa.Column("education", sa.JSON(), nullable=False, server_default="[]")),
        ("internships", sa.Column("internships", sa.JSON(), nullable=False, server_default="[]")),
        ("work_experiences", sa.Column("work_experiences", sa.JSON(), nullable=False, server_default="[]")),
        ("projects", sa.Column("projects", sa.JSON(), nullable=False, server_default="[]")),
        ("languages", sa.Column("languages", sa.JSON(), nullable=False, server_default="[]")),
        ("certificates", sa.Column("certificates", sa.JSON(), nullable=False, server_default="[]")),
        ("self_evaluation", sa.Column("self_evaluation", sa.Text(), nullable=False, server_default="")),
        ("profile_version", sa.Column("profile_version", sa.Integer(), nullable=False, server_default="0")),
        ("profile_saved_at", sa.Column("profile_saved_at", sa.DateTime(timezone=True), nullable=True)),
    ])
    _add_columns("applications", [
        ("candidate_profile_snapshot", sa.Column("candidate_profile_snapshot", sa.JSON(), nullable=True)),
        ("job_type_snapshot", sa.Column("job_type_snapshot", sa.String(32), nullable=True)),
    ])
    bind = op.get_bind()
    bind.execute(sa.text("UPDATE jobs SET job_type = 'SOCIAL' WHERE job_type IS NULL OR job_type = ''"))
    indexes = {index["name"] for index in sa.inspect(bind).get_indexes("jobs")}
    if "ix_jobs_job_type" not in indexes:
        with op.batch_alter_table("jobs") as batch:
            batch.create_index("ix_jobs_job_type", ["job_type"], unique=False)


def downgrade():
    # Candidate profiles and historical application snapshots are business data;
    # downgrade intentionally preserves them.
    pass
