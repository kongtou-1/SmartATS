"""Job directions / categories: public read + HR/admin CRUD.

Categories are configurable (e.g. 研发/运营/产品/市场/职能) and may form a
one/two-level hierarchy via `parent_code` (a string reference, not a FK).
"""
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ...core.permissions import require_roles
from ...models import Job, JobCategory, AdminAccount
from ...schemas import JobCategoryInput, JobCategoryOut



def _order(q):
    return q.order_by(JobCategory.sort_order, JobCategory.code)


def _load_enriched_categories(db: Session):
    """Load all categories with computed owner names and job counts."""
    categories = _order(db.query(JobCategory)).all()
    # 含已软删账号：历史方向上的负责人名字仍需正常显示
    users = {u.id: u for u in db.query(AdminAccount).all()}
    published_jobs = (
        db.query(Job.category_code, Job.headcount)
        .filter(Job.status == "PUBLISHED")
        .all()
    )

    # Aggregate job counts per category code (direct assignments only).
    job_counts: dict[str | None, int] = {}
    job_headcounts: dict[str | None, int] = {}
    for code, headcount in published_jobs:
        job_counts[code] = job_counts.get(code, 0) + 1
        job_headcounts[code] = job_headcounts.get(code, 0) + (headcount or 0)

    # Build tree structure in memory.
    nodes = []
    node_by_code: dict[str, dict] = {}
    for cat in categories:
        node = {
            "cat": cat,
            "children": [],
            "code": cat.code,
            "parent_code": cat.parent_code,
        }
        node_by_code[cat.code] = node
        nodes.append(node)

    roots = []
    for node in nodes:
        parent_code = node["parent_code"]
        if parent_code and parent_code in node_by_code:
            node_by_code[parent_code]["children"].append(node)
        else:
            roots.append(node)

    # Sort recursively by sort_order, code.
    def sort_nodes(ns):
        ns.sort(key=lambda n: (n["cat"].sort_order, n["cat"].code))
        for child in ns:
            sort_nodes(child["children"])

    sort_nodes(roots)

    # Collect descendant codes for aggregation.
    def collect_codes(node, acc):
        acc.add(node["code"])
        for child in node["children"]:
            collect_codes(child, acc)

    def compute(node):
        codes: set[str] = set()
        collect_codes(node, codes)
        open_job_count = sum(job_counts.get(code, 0) for code in codes)
        total_headcount = sum(job_headcounts.get(code, 0) for code in codes)
        child_count = len(node["children"])
        for child in node["children"]:
            compute(child)
        return open_job_count, total_headcount, child_count

    # Compute aggregates and flatten back to ordered list.
    def flatten(ns, out):
        for node in ns:
            open_job_count, total_headcount, child_count = compute(node)
            cat = node["cat"]
            owner = users.get(cat.owner_id) if cat.owner_id else None
            out.append(
                JobCategoryOut.model_validate(cat).model_copy(
                    update={
                        "owner_name": owner.name if owner else None,
                        "owner_title": owner.title if owner else None,
                        "open_job_count": open_job_count,
                        "total_headcount": total_headcount,
                        "child_count": child_count,
                    }
                )
            )
            flatten(node["children"], out)

    ordered: list[JobCategoryOut] = []
    flatten(roots, ordered)
    return ordered


def _get_category_enriched(db: Session, code: str) -> JobCategoryOut:
    cat = db.query(JobCategory).filter(JobCategory.code == code).first()
    if cat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="方向不存在")
    all_enriched = _load_enriched_categories(db)
    for item in all_enriched:
        if item.code == code:
            return item
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="方向不存在")


def _validate_owner(db: Session, owner_id: UUID | None):
    if owner_id is None:
        return
    owner = db.get(AdminAccount, owner_id)
    if owner is None or owner.delete_at is not None or owner.role != "DIRECTION_OWNER" or owner.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="方向负责人必须是启用状态的方向负责人角色",
        )


# ---------- Public ----------
def list_job_categories(db: Session = Depends(get_db)):
    # Public view does not expose owner details.
    categories = _order(db.query(JobCategory)).all()
    return [JobCategoryOut.model_validate(c) for c in categories]


# ---------- Admin ----------
def admin_list_job_categories(_: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    return _load_enriched_categories(db)


def admin_create_job_category(
    payload: JobCategoryInput,
    _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    if db.query(JobCategory).filter(JobCategory.code == payload.code).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="方向编码已存在")
    if payload.parent_code:
        if not db.query(JobCategory).filter(JobCategory.code == payload.parent_code).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="父级方向不存在")
    _validate_owner(db, payload.owner_id)
    cat = JobCategory(
        code=payload.code,
        name=payload.name,
        parent_code=payload.parent_code,
        sort_order=payload.sort_order,
        owner_id=payload.owner_id,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return _get_category_enriched(db, cat.code)


def admin_get_job_category(
    code: str, _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)
):
    return _get_category_enriched(db, code)


def admin_update_job_category(
    code: str,
    payload: JobCategoryInput,
    _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    cat = db.query(JobCategory).filter(JobCategory.code == code).first()
    if cat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="方向不存在")
    if code != payload.code and db.query(JobCategory).filter(JobCategory.code == payload.code).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="方向编码已存在")
    if payload.parent_code and payload.parent_code == code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能将方向设为自身的父级")
    _validate_owner(db, payload.owner_id)
    cat.code = payload.code
    cat.name = payload.name
    cat.parent_code = payload.parent_code
    cat.sort_order = payload.sort_order
    cat.owner_id = payload.owner_id
    db.commit()
    db.refresh(cat)
    return _get_category_enriched(db, cat.code)


def admin_delete_job_category(
    code: str, _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)
):
    cat = db.query(JobCategory).filter(JobCategory.code == code).first()
    if cat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="方向不存在")
    if db.query(JobCategory).filter(JobCategory.parent_code == code).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该方向下还有子方向，无法删除")
    if db.query(Job).filter(Job.category_code == code).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该方向下还有岗位，无法删除")
    db.delete(cat)
    db.commit()
