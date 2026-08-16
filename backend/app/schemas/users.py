"""Pydantic contracts for this business domain."""
from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field



class UserCreateIn(BaseModel):
    email: str
    name: str
    title: Optional[str] = None
    role: str  # SUPER_ADMIN | HR | INTERVIEWER | DIRECTION_OWNER（管理端账号无 CANDIDATE 角色）
    password: str



class UserUpdateIn(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    title: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None
