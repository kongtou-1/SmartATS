"""Small repository foundation for domain-specific persistence adapters."""
from __future__ import annotations

from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy.orm import Session


ModelT = TypeVar("ModelT")


class Repository(Generic[ModelT]):
    """Common persistence operations without committing the transaction.

    Repositories deliberately never call ``commit``. A business service may
    combine several repositories and then commit or roll back the use case as
    one transaction.
    """

    def __init__(self, db: Session, model: type[ModelT]):
        self.db = db
        self.model = model

    def get(self, entity_id: UUID) -> ModelT | None:
        return self.db.get(self.model, entity_id)

    def add(self, entity: ModelT) -> ModelT:
        self.db.add(entity)
        return entity

    def delete(self, entity: ModelT) -> None:
        self.db.delete(entity)

    def flush(self) -> None:
        self.db.flush()
