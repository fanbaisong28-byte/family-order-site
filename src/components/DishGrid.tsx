"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { DishWithSelection } from "@/hooks/useRealtimeRoom";
import { toast } from "sonner";
import { Minus, Plus, Users, X, Loader2 } from "lucide-react";

interface Props {
  dishes: DishWithSelection[];
  userNickname: string;
  onUpdateQuantity: (dishId: string, delta: number) => void;
  onRemoveDish: (dishId: string) => Promise<void>;
}

interface CoDinerWarning {
  dishId: string;
  dishName: string;
  coDiners: string[];
}

export function DishGrid({ dishes, userNickname, onUpdateQuantity, onRemoveDish }: Props) {
  const [coDinerWarning, setCoDinerWarning] = useState<CoDinerWarning | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleMinus = (dish: DishWithSelection) => {
    if (dish.selected_quantity <= 0) return;

    const coDiners = dish.ordered_by.filter((n) => n !== userNickname);
    if (dish.selected_quantity === 1 && coDiners.length > 0) {
      setCoDinerWarning({
        dishId: dish.id,
        dishName: dish.name,
        coDiners,
      });
    } else {
      onUpdateQuantity(dish.id, -1);
    }
  };

  const confirmDelete = () => {
    if (coDinerWarning) {
      onUpdateQuantity(coDinerWarning.dishId, -1);
      setCoDinerWarning(null);
    }
  };

  const handleRemove = async (dishId: string) => {
    setRemovingId(dishId);
    try {
      await onRemoveDish(dishId);
      toast.success("已从房间移除");
    } catch {
      toast.error("移除失败");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dishes.map((dish) => {
          const coDiners = dish.ordered_by.filter((n) => n !== userNickname);
          const hasSelections = dish.ordered_by.length > 0;

          return (
            <div
              key={dish.id}
              className="relative flex gap-3 overflow-hidden rounded-xl border bg-card p-3 group"
            >
              {/* Remove button */}
              <button
                className="absolute top-2 right-2 size-6 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive/10 disabled:opacity-30"
                disabled={hasSelections || removingId === dish.id}
                title={
                  hasSelections
                    ? `已有${dish.ordered_by.join("、")}点单，无法移除`
                    : "从房间移除这道菜"
                }
                onClick={() => handleRemove(dish.id)}
              >
                {removingId === dish.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <X className="size-3 text-destructive" />
                )}
              </button>

              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {dish.image_url ? (
                  <img
                    src={dish.image_url}
                    alt={dish.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    暂无
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm truncate">{dish.name}</span>
                    <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5">
                      {dish.category}
                    </Badge>
                  </div>
                  {dish.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {dish.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      className="size-7 rounded-md"
                      onClick={() => handleMinus(dish)}
                      disabled={dish.selected_quantity === 0}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium tabular-nums">
                      {dish.selected_quantity}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      className="size-7 rounded-md"
                      onClick={() => onUpdateQuantity(dish.id, 1)}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>

                  {coDiners.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground" title={coDiners.join("、")}>
                      <Users className="size-3" />
                      {coDiners.join("、")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!coDinerWarning} onOpenChange={() => setCoDinerWarning(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>取消自己的点单</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            这道菜也是{" "}
            <span className="font-medium text-foreground">
              {coDinerWarning?.coDiners.join("、")}
            </span>{" "}
            点的，确定取消自己的吗？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoDinerWarning(null)}>
              保留
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              确认取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
