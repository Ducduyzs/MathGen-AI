"use client";

import { useState } from "react";
import { Dices } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { ROLE_LABEL } from "@/features/auth";
import { errorMessage } from "@/lib/api/errors";
import { GRADES } from "@/lib/grades";
import { PROVINCES_SORTED } from "@/lib/regions";
import type { AdminUser, Role } from "@/types/api";
import { useCreateUser, useSetPassword, useUpdateUser } from "../api";

const ROLES: Role[] = ["teacher", "student", "parent", "admin"];

/** Mật khẩu tạm dễ đọc cho người dùng (bỏ ký tự dễ nhầm 0/O, 1/l). */
export function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function PasswordField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div>
      <Label htmlFor={id}>Mật khẩu tạm (ít nhất 8 ký tự)</Label>
      <div className="flex gap-2">
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" autoComplete="off" />
        <Button type="button" variant="outline" onClick={() => onChange(randomPassword())} title="Tạo mật khẩu ngẫu nhiên">
          <Dices className="size-4" aria-hidden />
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted">Gửi mật khẩu này cho người dùng qua kênh riêng; họ nên đổi sau khi đăng nhập.</p>
    </div>
  );
}

/** Tạo tài khoản (user = null) hoặc sửa vai trò / lớp / tỉnh / họ tên. */
export function UserDialog({ open, user, onClose }: { open: boolean; user: AdminUser | null; onClose: () => void }) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "teacher");
  const [grade, setGrade] = useState(user?.grade ? String(user.grade) : "");
  const [province, setProvince] = useState(user?.province_code ?? "");
  const [password, setPassword] = useState(() => randomPassword());
  const pending = create.isPending || update.isPending;
  const valid = fullName.trim().length >= 2 && (user || (email.includes("@") && password.length >= 8)) && (role !== "student" || grade);

  function save() {
    const common = { full_name: fullName.trim(), role, grade: role === "student" ? Number(grade) : null, province_code: province || null };
    const onError = (err: unknown) => toast.error(errorMessage(err));
    if (user) {
      update.mutate({ id: user.id, ...common }, { onSuccess: () => (toast.success("Đã lưu thay đổi"), onClose()), onError });
    } else {
      create.mutate(
        { ...common, email: email.trim(), password },
        { onSuccess: (u) => (toast.success(`Đã tạo tài khoản ${u.email}`, { description: `Mật khẩu tạm: ${password}`, duration: 15000 }), onClose()), onError },
      );
    }
  }

  return (
    <Dialog
      open={open}
      title={user ? `Sửa ${user.full_name}` : "Tạo tài khoản"}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={save} loading={pending} disabled={!valid}>
            {user ? "Lưu" : "Tạo tài khoản"}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-ink">
        <div>
          <Label htmlFor="u-name">Họ và tên</Label>
          <Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        {!user && (
          <div>
            <Label htmlFor="u-email">Email đăng nhập</Label>
            <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="u-role">Vai trò</Label>
            <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="u-grade">Lớp</Label>
            <Select id="u-grade" value={role === "student" ? grade : ""} disabled={role !== "student"} onChange={(e) => setGrade(e.target.value)}>
              <option value="">{role === "student" ? "Chọn lớp" : "—"}</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  Lớp {g}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="u-province">Tỉnh/thành</Label>
          <Select id="u-province" value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">Không chọn</option>
            {PROVINCES_SORTED.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        {!user && <PasswordField id="u-password" value={password} onChange={setPassword} />}
      </div>
    </Dialog>
  );
}

export function PasswordDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const setPw = useSetPassword();
  const [password, setPassword] = useState(() => randomPassword());
  return (
    <Dialog
      open={!!user}
      title={`Đặt lại mật khẩu cho ${user?.full_name ?? ""}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            loading={setPw.isPending}
            disabled={password.length < 8}
            onClick={() =>
              setPw.mutate(
                { id: user!.id, password },
                {
                  onSuccess: () => {
                    toast.success("Đã đặt lại mật khẩu", { description: `Mật khẩu mới: ${password}`, duration: 15000 });
                    onClose();
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                },
              )
            }
          >
            Đặt lại
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <PasswordField id="pw-new" value={password} onChange={setPassword} />
        <p className="text-sm">Mọi thiết bị đang đăng nhập của tài khoản này sẽ bị đăng xuất.</p>
      </div>
    </Dialog>
  );
}
