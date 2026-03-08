"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LabelHistoryFilterProps = {
  onSearch: (gtin: string, batchNo: string) => void;
  isLoading?: boolean;
};

export function LabelHistoryFilter({ onSearch, isLoading = false }: LabelHistoryFilterProps) {
  const [filterGtin, setFilterGtin] = useState("");
  const [filterBatchNo, setFilterBatchNo] = useState("");

  const handleSearch = () => {
    onSearch(filterGtin, filterBatchNo);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <label className="text-sm font-medium">按 GTIN 筛选</label>
        <Input
          value={filterGtin}
          maxLength={14}
          placeholder="09506000134352"
          onChange={(e) => setFilterGtin(e.target.value.trim())}
        />
      </div>
      <div className="flex-1 space-y-2">
        <label className="text-sm font-medium">按批次号筛选</label>
        <Input
          value={filterBatchNo}
          placeholder="LOT202603"
          onChange={(e) => setFilterBatchNo(e.target.value.trim())}
        />
      </div>
      <Button onClick={handleSearch} disabled={isLoading} className="w-full sm:w-auto">
        <Search />
        {isLoading ? "查询中..." : "查询历史"}
      </Button>
    </div>
  );
}
