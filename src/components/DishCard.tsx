"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import type { Dish } from "@/lib/types";
import { DishForm } from "./DishForm";

interface Props {
  dish: Dish;
  onUpdated: () => void;
}

export function DishCard({ dish, onUpdated }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`确定删除「${dish.name}」吗？`)) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("dishes").delete().eq("id", dish.id);
      if (error) throw error;
      toast.success("已删除");
      onUpdated();
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="group overflow-hidden">
        <div className="aspect-[4/3] bg-muted relative">
          {dish.image_url ? (
            <img
              src={dish.image_url}
              alt={dish.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              暂无图片
            </div>
          )}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon-sm"
              variant="secondary"
              className="size-8 bg-white/90 hover:bg-white"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="secondary"
              className="size-8 bg-white/90 hover:bg-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5 text-destructive" />}
            </Button>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-medium truncate">{dish.name}</h3>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {dish.category}
            </Badge>
          </div>
          {dish.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {dish.description}
            </p>
          )}
        </div>
      </Card>
      <DishForm
        open={editOpen}
        onOpenChange={setEditOpen}
        dish={dish}
        onSaved={onUpdated}
      />
    </>
  );
}
