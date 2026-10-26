"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/errors";
import { useAuth } from "../AuthProvider";
import { homeFor, safeNext } from "../roles";

const schema = z.object({
  email: z.string().trim().email("Email chưa đúng định dạng"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});
type Values = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: "Học sinh", email: "hs@mathgen.vn" },
  { label: "Giáo viên", email: "gv@mathgen.vn" },
  { label: "Quản trị", email: "admin@mathgen.vn" },
];

export function LoginForm() {
  const { status, user, login } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  // Đã đăng nhập mà vẫn vào /login thì chuyển đi luôn.
  useEffect(() => {
    if (status === "authenticated" && user) router.replace(next ?? homeFor(user.role));
  }, [status, user, next, router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const signedIn = await login(values.email, values.password);
      router.replace(next ?? homeFor(signedIn.role));
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        <FieldError message={errors.email?.message} />
      </div>
      <div>
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>

      {formError && (
        <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Đăng nhập
      </Button>

      {process.env.NEXT_PUBLIC_MOCK_API === "1" && (
        <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50 p-3 text-sm">
          <p className="font-medium text-brand-800">Tài khoản thử (mật khẩu 123456)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="rounded-md bg-white px-2.5 py-1 text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
                onClick={() => {
                  setValue("email", acc.email);
                  setValue("password", "123456");
                }}
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
