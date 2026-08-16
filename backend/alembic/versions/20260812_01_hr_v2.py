"""HR ATS V2 schema and compatible data backfill."""
from alembic import op
import sqlalchemy as sa

revision = "20260812_01"
down_revision = None
branch_labels = None
depends_on = None


def _columns(inspector, table):
    return {c["name"] for c in inspector.get_columns(table)} if table in inspector.get_table_names() else set()


def _add_columns(table, definitions):
    bind = op.get_bind(); inspector = sa.inspect(bind); existing = _columns(inspector, table)
    with op.batch_alter_table(table) as batch:
        for name, column in definitions:
            if name not in existing: batch.add_column(column)


def upgrade():
    bind = op.get_bind()
    if "candidates" not in sa.inspect(bind).get_table_names():
        from app.services.database import Base
        from app import models  # noqa: F401
        Base.metadata.create_all(bind=bind, checkfirst=True)
        for idx, (code, name) in enumerate([("UNKNOWN", "未知"), ("CAREER_SITE", "官网"), ("REFERRAL", "内推"), ("JOB_BOARD", "招聘网站"), ("AGENCY", "猎头"), ("CAMPUS", "校园"), ("OTHER", "其他")]):
            generated = __import__("uuid").uuid4()
            channel_id = generated.hex if bind.dialect.name == "sqlite" else generated
            bind.execute(sa.text("INSERT INTO source_channels (id, code, name, enabled, sort_order) VALUES (:id, :code, :name, :enabled, :sort_order)"), {"id": channel_id, "code": code, "name": name, "enabled": True, "sort_order": idx})
        return
    _add_columns("candidates", [
        ("normalized_phone", sa.Column("normalized_phone", sa.String(64), nullable=False, server_default="")),
        ("contact_email", sa.Column("contact_email", sa.String(255), nullable=False, server_default="")),
        ("normalized_email", sa.Column("normalized_email", sa.String(255), nullable=False, server_default="")),
        ("years_experience", sa.Column("years_experience", sa.Integer(), nullable=False, server_default="0")),
        ("owner_id", sa.Column("owner_id", sa.Uuid(), nullable=True)),
        ("source_channel_id", sa.Column("source_channel_id", sa.Uuid(), nullable=True)),
    ])
    _add_columns("applications", [
        ("owner_id", sa.Column("owner_id", sa.Uuid(), nullable=True)),
        ("source_channel_id", sa.Column("source_channel_id", sa.Uuid(), nullable=True)),
        ("source_code_snapshot", sa.Column("source_code_snapshot", sa.String(64), nullable=False, server_default="UNKNOWN")),
        ("source_name_snapshot", sa.Column("source_name_snapshot", sa.String(128), nullable=False, server_default="未知")),
    ])
    _add_columns("email_logs", [("delivery_status", sa.Column("delivery_status", sa.String(32), nullable=False, server_default="SIMULATED"))])

    # Importing the application metadata here makes missing V2 tables with the same
    # definitions as fresh installations while preserving every existing table.
    from app.services.database import Base
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)

    bind.execute(sa.text("UPDATE candidates SET normalized_phone = REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+86', '') WHERE normalized_phone = ''"))
    bind.execute(sa.text("UPDATE candidates SET contact_email = COALESCE((SELECT users.email FROM users WHERE users.id = candidates.user_id), '') WHERE contact_email = ''"))
    bind.execute(sa.text("UPDATE candidates SET normalized_email = LOWER(contact_email) WHERE normalized_email = ''"))
    count = bind.execute(sa.text("SELECT COUNT(*) FROM source_channels")).scalar()
    if not count:
        for idx, (code, name) in enumerate([("UNKNOWN", "未知"), ("CAREER_SITE", "官网"), ("REFERRAL", "内推"), ("JOB_BOARD", "招聘网站"), ("AGENCY", "猎头"), ("CAMPUS", "校园"), ("OTHER", "其他")]):
            generated = __import__("uuid").uuid4()
            channel_id = generated.hex if bind.dialect.name == "sqlite" else generated
            bind.execute(sa.text("INSERT INTO source_channels (id, code, name, enabled, sort_order) VALUES (:id, :code, :name, :enabled, :sort_order)"), {"id": channel_id, "code": code, "name": name, "enabled": True, "sort_order": idx})
    unknown = bind.execute(sa.text("SELECT id FROM source_channels WHERE code = 'UNKNOWN'")).scalar()
    bind.execute(sa.text("UPDATE candidates SET source_channel_id = :unknown WHERE source_channel_id IS NULL"), {"unknown": unknown})
    with op.batch_alter_table("candidates") as batch:
        batch.alter_column("user_id", existing_type=sa.Uuid(), nullable=True)


def downgrade():
    # V2 captures business records. Downgrade is intentionally non-destructive.
    pass
