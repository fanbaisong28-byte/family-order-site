"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DishCard } from "@/components/DishCard";
import { DishForm } from "@/components/DishForm";
import { supabase } from "@/lib/supabase";
import { CATEGORIES, type Dish } from "@/lib/types";
import { Plus, Search, Utensils } from "lucide-react";

export default function ManagePage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部");
  const [addOpen, setAddOpen] = useState(false);

  const fetchDishes = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      let q = supabase.from("dishes").select("*").order("created_at", { ascending: false });
      if (category !== "全部") q = q.eq("category", category);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error: err } = await q;
      if (err) throw err;
      setDishes(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    fetchDishes();
  }, [fetchDishes]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">菜谱管理</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 size-4" />
          添加菜品
        </Button>
      </div>

      <div className="mt-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜索菜名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={(v) => setCategory(v || "全部")}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="全部">全部</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" className="mt-3" onClick={fetchDishes}>
              重试
            </Button>
          </div>
        ) : dishes.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Utensils className="size-16 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">
              {search || category !== "全部" ? "没有匹配的菜品" : "菜谱库还是空的"}
            </p>
            <p className="text-sm text-muted-foreground/60">
              {search || category !== "全部" ? "试试其他关键词" : "点击「添加菜品」开始吧"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {dishes.map((dish) => (
              <DishCard key={dish.id} dish={dish} onUpdated={fetchDishes} />
            ))}
          </div>
        )}
      </div>

      <DishForm
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={fetchDishes}
      />
    </div>
  );
}
