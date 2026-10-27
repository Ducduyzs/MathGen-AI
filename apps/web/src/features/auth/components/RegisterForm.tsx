"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { useAuth } from "../AuthProvider";
import { homeFor } from "../roles";

const GRADES = ["6", "7", "8", "9", "10", "11", "12"] as const;

const ROLES = [
  { role: "student", label: "Học sinh" },
  { role: "parent", label: "Phụ huynh" },
] as const;

const schema = z
  .object({
    role: z.enum(["student", "parent"]),
    full_name: z.string().trim().min(2, "Nhập họ và tên"),
    email: z.string().trim().email("Email chưa đúng định dạng"),
    password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
    grade: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === "student" && !GRADES.includes(v.grade as (typeof GRADES)[number])) {
      ctx.addIssue({ code: "custom", path: ["grade"], message: "Chọn lớp" });
    }
  });
type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const { register: signUp } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { role: "student", grade: "" } });
  const role = watch("role");
  const student = role === "student";

  const onSubmit = handleSubmit(async ({ grade, ...rest }) => {
    setFormError(null);
    try {
      const user = await signUp({ ...rest, grade: rest.role === "student" ? Number(grade) : null });
      router.replace(homeFor(user.role));
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div role="radiogroup" aria-label="Tôi là" className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
        {ROLES.map((r) => (
          <button
            key={r.role}
            type="button"
            role="radio"
            aria-checked={role === r.role}
            onClick={() => setValue("role", r.role, { shouldValidate: false })}
            className={cn(
              "h-9 rounded-lg text-sm font-medium transition-colors focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:outline-none",
              role === r.role ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div>
        <Label htmlFor="full_name">{student ? "Họ và tên" : "Họ và tên phụ huynh"}</Label>
        <Input id="full_name" autoComplete="name" aria-invalid={!!errors.full_name} {...register("full_name")} />
        <FieldError message={errors.full_name?.message} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        <FieldError message={errors.email?.message} />
      </div>
      <div className={cn("grid gap-4", student && "sm:grid-cols-[1fr_8rem]")}>
        <div>
          <Label htmlFor="password">Mật khẩu</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <FieldError message={errors.password?.message} />
        </div>
        {student && (
          <div>
            <Label htmlFor="grade">Lớp</Label>
            <Select id="grade" aria-invalid={!!errors.grade} {...register("grade")}>
              <option value="" disabled>
                Chọn
              </option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  Lớp {g}
                </option>
              ))}
            </Select>
            <FieldError message={errors.grade?.message} />
          </div>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        {student ? "Tạo tài khoản học sinh" : "Tạo tài khoản phụ huynh"}
      </Button>
      <p className="text-center text-xs text-muted">
        {student
          ? "Tài khoản giáo viên do quản trị viên cấp."
          : "Sau khi đăng ký, nhập mã liên kết con tạo ở trang Tiến độ để theo dõi việc học."}
      </p>
    </form>
  );
}
