"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/errors";
import { useAuth } from "../AuthProvider";
import { homeFor } from "../roles";

const GRADES = ["6", "7", "8", "9", "10", "11", "12"] as const;

const schema = z.object({
  full_name: z.string().trim().min(2, "Nhập họ và tên"),
  email: z.string().trim().email("Email chưa đúng định dạng"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  grade: z.enum(GRADES, { errorMap: () => ({ message: "Chọn lớp" }) }),
});
type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const { register: signUp } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ grade, ...rest }) => {
    setFormError(null);
    try {
      const user = await signUp({ ...rest, grade: Number(grade) });
      router.replace(homeFor(user.role));
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="full_name">Họ và tên</Label>
        <Input id="full_name" autoComplete="name" aria-invalid={!!errors.full_name} {...register("full_name")} />
        <FieldError message={errors.full_name?.message} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div>
          <Label htmlFor="password">Mật khẩu</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <FieldError message={errors.password?.message} />
        </div>
        <div>
          <Label htmlFor="grade">Lớp</Label>
          <Select id="grade" defaultValue="" aria-invalid={!!errors.grade} {...register("grade")}>
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
      </div>

      {formError && (
        <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Tạo tài khoản học sinh
      </Button>
      <p className="text-center text-xs text-muted">Tài khoản giáo viên do quản trị viên cấp.</p>
    </form>
  );
}
