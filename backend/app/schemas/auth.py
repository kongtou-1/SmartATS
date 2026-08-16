"""Pydantic contracts for this business domain."""
from datetime import datetime
from typing import List, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field



class RegisterIn(BaseModel):
    email: str
    password: str
    name: str



class LoginIn(BaseModel):
    email: str
    password: str
    # 限定登录入口所属的端：admin=管理后台，candidate=求职者端。
    # 不传时两端账号都可登录（向后兼容旧客户端）。
    scope: Optional[Literal["admin", "candidate"]] = None



class CandidateAccountOut(BaseModel):
    """C-end account (`candidate_accounts`)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str
    status: str
    account_type: Literal["candidate"] = "candidate"
    # 求职者账号没有角色列，固定返回 CANDIDATE 以兼容前端既有判断
    role: Literal["CANDIDATE"] = "CANDIDATE"
    created_at: datetime
    delete_at: Optional[datetime] = None



class AdminAccountOut(BaseModel):
    """Management-end account (`admin_accounts`)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str
    title: str = ""
    role: str
    status: str
    account_type: Literal["admin"] = "admin"
    created_at: datetime
    delete_at: Optional[datetime] = None



# /auth/me 与登录响应可能是任意一端的账号
AccountOut = Union[AdminAccountOut, CandidateAccountOut]



class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: AccountOut
