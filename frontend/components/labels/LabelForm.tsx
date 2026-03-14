"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { validateGtin14 } from "@/lib/gs1";

type LabelFormProps = {
  onSubmit: (data: {
    di: string;
    lot: string;
    expiryDate: string;
    serial: string;
    productionDate: string;
    remarks: string;
  }) => boolean | Promise<boolean>;
  isLoading?: boolean;
};

function formatDateToYYMMDD(date: Date) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}/${mm}/${dd}`;
}

export function LabelForm({ onSubmit, isLoading = false }: LabelFormProps) {
  const today = new Date();
  const defaultProductionDate = formatDateToYYMMDD(today);
  const defaultExpiryDate = formatDateToYYMMDD(
    new Date(today.getFullYear() + 5, today.getMonth(), today.getDate())
  );
  const currentYear = new Date().getFullYear();
  const [di, setDi] = useState("09506000134352");
  const [diError, setDiError] = useState("");
  const [lot, setLot] = useState("LOT202603");
  const [expiryDate, setExpiryDate] = useState(defaultExpiryDate);
  const [serial, setSerial] = useState("");
  const [productionDate, setProductionDate] = useState(defaultProductionDate);
  const [remarks, setRemarks] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateGtin14(di)) {
      setDiError("GTIN-14 校验位错误，请检查输入");
      return;
    }
    setDiError("");
    const success = await onSubmit({
      di,
      lot,
      expiryDate,
      serial,
      productionDate,
      remarks,
    });
    if (success) {
      // Optional: reset form after successful submission
      // setDi("");
      // setLot("");
    }
  };

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">标签录入表单</h2>
        <p className="text-sm text-muted-foreground">请填写 UDI 标签信息并生成条码</p>
      </div>

      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium">DI / GTIN-14</label>
          <Input
            value={di}
            onChange={(e) => { setDi(e.target.value.trim()); setDiError(""); }}
            maxLength={14}
            placeholder="09506000134352"
            required
            aria-invalid={!!diError}
            className={diError ? "border-destructive" : ""}
          />
          {diError ? (
            <p className="text-xs text-destructive">{diError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">固定 14 位数字</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">PI(10) 批号</label>
          <Input
            value={lot}
            onChange={(e) => setLot(e.target.value.trim())}
            placeholder="LOT202603"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">PI(11) 生产日期</label>
          <DatePicker
            value={productionDate}
            onChange={setProductionDate}
            placeholder="选择生产日期"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">PI(17) 有效期</label>
          <DatePicker
            value={expiryDate}
            onChange={setExpiryDate}
            placeholder="选择有效期"
            toYear={currentYear + 20}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">PI(21) 序列号</label>
          <Input
            value={serial}
            onChange={(e) => setSerial(e.target.value.trim())}
            placeholder="SN0001"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">备注</label>
          <Input
            value={remarks}
            onChange={(e) => setRemarks(e.target.value.trim())}
            placeholder="可选的备注信息"
          />
        </div>

        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          <Link
            href="/batch"
            className="inline-flex h-9 min-w-36 items-center justify-center rounded-lg border border-input bg-background px-2.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            批量上传
          </Link>
          <Button
            type="submit"
            size="lg"
            className="min-w-36 shadow-md transition-shadow hover:shadow-lg"
            disabled={isLoading}
          >
            {isLoading ? "生成中..." : "生成"}
          </Button>
        </div>
      </form>
    </section>
  );
}
