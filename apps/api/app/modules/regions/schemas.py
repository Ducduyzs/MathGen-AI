from pydantic import BaseModel


class ProvinceOut(BaseModel):
    code: str
    name: str
    # Số câu thật trong ngân hàng và số trường đã biết của tỉnh
    problems: int
    schools: int


class SchoolOut(BaseModel):
    id: str
    name: str
    province_code: str
    level: str | None
    level_label: str | None
    problems: int
