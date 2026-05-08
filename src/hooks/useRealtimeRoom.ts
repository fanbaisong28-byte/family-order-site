"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Dish, Selection, RoomDish } from "@/lib/types";

export interface DishWithSelection extends Dish {
  selected_quantity: number;
  selected_note: string;
  ordered_by: string[];
}

export function useRealtimeRoom(roomId: string, userNickname: string) {
  const [dishes, setDishes] = useState<DishWithSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchDishes = useCallback(async () => {
    const [rdRes, selRes] = await Promise.all([
      supabase
        .from("room_dishes")
        .select("dish_id, dishes(*)")
        .eq("room_id", roomId),
      supabase
        .from("selections")
        .select("*")
        .eq("room_id", roomId),
    ]);

    if (rdRes.error) {
      setError(rdRes.error.message);
      setLoading(false);
      return;
    }

    const dishMap = new Map<string, DishWithSelection>();

    for (const rd of rdRes.data || []) {
      const d = (rd as any).dishes as Dish;
      if (!d) continue;
      dishMap.set(d.id, {
        ...d,
        selected_quantity: 0,
        selected_note: "",
        ordered_by: [],
      });
    }

    for (const sel of selRes.data || []) {
      const s = sel as Selection;
      if (s.quantity <= 0) continue;
      const existing = dishMap.get(s.dish_id);
      if (!existing) continue;
      existing.ordered_by.push(s.user_nickname);
      if (s.user_nickname === userNickname) {
        existing.selected_quantity = s.quantity;
        existing.selected_note = s.note;
      }
    }

    setDishes(Array.from(dishMap.values()));
    setLoading(false);
  }, [roomId, userNickname]);

  useEffect(() => {
    fetchDishes();

    const channel = supabase
      .channel(`room_${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_dishes", filter: `room_id=eq.${roomId}` },
        () => fetchDishes()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "selections", filter: `room_id=eq.${roomId}` },
        () => fetchDishes()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchDishes]);

  const updateQuantity = useCallback(
    async (dishId: string, delta: number) => {
      const current = dishes.find((d) => d.id === dishId);
      if (!current) return;

      const newQty = Math.max(0, current.selected_quantity + delta);

      setDishes((prev) =>
        prev.map((d) =>
          d.id === dishId ? { ...d, selected_quantity: newQty } : d
        )
      );

      try {
        if (newQty === 0) {
          await supabase
            .from("selections")
            .delete()
            .eq("room_id", roomId)
            .eq("dish_id", dishId)
            .eq("user_nickname", userNickname);
        } else {
          await supabase.from("selections").upsert(
            {
              room_id: roomId,
              dish_id: dishId,
              user_nickname: userNickname,
              quantity: newQty,
            },
            { onConflict: "room_id, dish_id, user_nickname" }
          );
        }
      } catch {
        // revert on error (realtime will correct)
      }
    },
    [roomId, userNickname, dishes]
  );

  const removeDish = useCallback(
    async (dishId: string) => {
      const { error } = await supabase
        .from("room_dishes")
        .delete()
        .eq("room_id", roomId)
        .eq("dish_id", dishId);
      if (error) throw error;
    },
    [roomId]
  );

  const totalDishes = dishes.filter((d) => d.selected_quantity > 0).length;
  const totalQuantity = dishes.reduce((sum, d) => sum + d.selected_quantity, 0);

  return { dishes, loading, error, updateQuantity, removeDish, totalDishes, totalQuantity, refetch: fetchDishes };
}
