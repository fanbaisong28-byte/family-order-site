"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { CATEGORIES, type Dish } from "@/lib/types";
import { Search, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  existingIds: string[];
  nickname: string;
  onAdded: () => void;
}

export function DishSelector({ open, onOpenChange, roomId, existingIds, nickname, onAdded }: Props) {
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setSearch("");
      setCategory("全部");
      supabase
        .from("dishes")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (!error) setAllDishes(data || []);
          setLoading(false);
        });
    }
  }, [open]);

  const filtered = allDishes.filter(
    (d) =>
      !existingIds.includes(d.id) &&
      (category === "全部" || d.category === category) &&
      (!search.trim() || d.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    try {
      const rows = Array.from(selected).map((dishId) => ({
        room_id: roomId,
        dish_id: dishId,
        added_by: nickname,
        is_temporary: false,
      }));

      const { error } = await supabase.from("room_dishes").insert(rows);
      if (error) throw error;
      toast.success(`已添加 ${rows.length} 道菜`);
      onAdded();
      onOpenChange(false);
    } catch {
      toast.error("添加失败");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>从菜谱库选择</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="搜索菜名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {["全部", ...CATEGORIES].map((c) => (
            <Badge
              key={c}
              variant={category === c ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => setCategory(c)}
            >
              {c}
            </Badge>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              没有可选的菜品
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((d) => {
                const isSel = selected.has(d.id);
                return (
                  <button
                    key={d.id}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                      isSel ? "border-primary bg-primary/5" : "hover:border-foreground/20"
                    }`}
                    onClick={() => toggle(d.id)}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border">
                      {isSel && <Check className="size-4 text-primary" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.category}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleAdd} disabled={selected.size === 0 || adding}>
            {adding ? "添加中..." : `添加 ${selected.size ? `(${selected.size})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
