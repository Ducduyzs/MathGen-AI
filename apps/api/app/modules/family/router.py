from fastapi import APIRouter

from app.core.deps import Db, Parent, Student
from app.modules.family import service
from app.modules.family.schemas import ChildReport, ChildSummary, LinkCodeOut, LinkIn, ParentOut

router = APIRouter(tags=["family"])


@router.post("/me/parent-code", response_model=LinkCodeOut)
async def create_code(db: Db, user: Student):
    return await service.create_code(db, user)


@router.get("/me/parents", response_model=list[ParentOut])
async def my_parents(db: Db, user: Student):
    return await service.my_parents(db, user)


@router.delete("/me/parents/{parent_id}", status_code=204)
async def remove_parent(parent_id: str, db: Db, user: Student):
    await service.remove_parent(db, user, parent_id)


@router.post("/children/link", response_model=ChildSummary)
async def link_child(body: LinkIn, db: Db, user: Parent):
    return await service.link(db, user, body.code)


@router.get("/children", response_model=list[ChildSummary])
async def list_children(db: Db, user: Parent):
    return await service.children(db, user)


@router.get("/children/{child_id}", response_model=ChildReport, response_model_exclude_none=True)
async def child_report(child_id: str, db: Db, user: Parent):
    return await service.child_report(db, user, child_id)


@router.delete("/children/{child_id}", status_code=204)
async def remove_child(child_id: str, db: Db, user: Parent):
    await service.remove_child(db, user, child_id)
