from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: str
    grade: int | None


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    # Đăng ký công khai chỉ tạo tài khoản học sinh hoặc phụ huynh; giáo viên do quản trị viên cấp
    role: Literal["student", "parent"] = "student"
    grade: int | None = Field(default=None, ge=6, le=12)

    @model_validator(mode="after")
    def _grade_for_student(self):
        if self.role == "student" and self.grade is None:
            raise ValueError("grade required")
        if self.role == "parent":
            self.grade = None
        return self


class SessionOut(BaseModel):
    access_token: str
    user: UserOut


class AccessOut(BaseModel):
    access_token: str
