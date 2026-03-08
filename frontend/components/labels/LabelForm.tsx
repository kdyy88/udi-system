"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";

type LabelFormProps = {
  onSubmit: (data: {
    di: string;
    lot: string;
    expiryDate: string;
    serial: string;
    productionDate: string;
    remarks: string;
  }) => Promise<boolean>;
  isLoading?: boolean;
};

export function LabelForm({ onSubmit, isLoading = false }: LabelFormProps) {
  const [di, setDi] = useState("09506000134352");
  const [lot, setLot] = useState("LOT202603");
  const [expiryDate, setExpiryDate] = useState("2028-02-29");
  const [serial, setSerial] = useState("SN0001");
  const [productionDate, setProductionDate] = useState("");
  const [remarks, setRemarks] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
    <section className="rounded-xl border p-4 sm:p-5">
      <h2 className="text-lg font-semibold">标签录入表单</h2>
      <form className="mt-4 grid gap-3 sm:gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium">DI / GTIN-14</label>
          <Input
            value={di}
            onChange={(e) => setDi(e.target.value.trim())}
            minLength={14}
            maxLength={14}
            placeholder="09506000134352"
            required
          />
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
          <label className="text-sm font-medium">PI(17) 有效期</label>
          <DatePicker value={expiryDate} onChange={setExpiryDate} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">PI(21) 序列号</label>
          <Input
            value={serial}
            onChange={(e) => setSerial(e.target.value.trim())}
            placeholder="SN0001"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">生产日期</label>
          <DatePicker value={productionDate} onChange={setProductionDate} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">备注</label>
          <Input
            value={remarks}
            onChange={(e) => setRemarks(e.target.value.trim())}
            placeholder="可选的备注信息"
          />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "生成中..." : "生成"}
          </Button>
        </div>
      </form>
    </section>
  );
}
