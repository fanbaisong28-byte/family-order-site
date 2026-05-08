"use client";

import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  totalDishes: number;
  totalQuantity: number;
  roomId: string;
}

export function SelectionPanel({ totalDishes, totalQuantity, roomId }: Props) {
  const router = useRouter();

  const handleExport = () => {
    window.open(`/room/${roomId}/print`, "_blank");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="text-sm">
          <span className="text-muted-foreground">已选 </span>
          <span className="font-semibold">{totalDishes} 道菜</span>
          <span className="text-muted-foreground"> · 共 </span>
          <span className="font-semibold">{totalQuantity} 份</span>
        </div>
        <Button onClick={handleExport} disabled={totalQuantity === 0}>
          <FileDown className="mr-1.5 size-4" />
          导出菜单
        </Button>
      </div>
    </div>
  );
}
