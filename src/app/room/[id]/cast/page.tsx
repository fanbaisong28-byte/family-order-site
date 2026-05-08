"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Dish, Selection } from "@/lib/types";
import { Users, Monitor } from "lucide-react";
import { ConnectionStatus } from "@/components/ConnectionStatus";

interface DishView {
  dish: Dish;
  quantity: number;
  orderedBy: string[];
}

interface Member {
  nickname: string;
  joined_at: string;
}

export default function CastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = use(params);
  const [dishes, setDishes] = useState<DishView[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef<() => Promise<void>>(undefined);

  const fetchAll = useCallback(async () => {
    const [roomRes, rdRes, selRes] = await Promise.all([
      supabase.from("rooms").select("name").eq("id", roomId).single(),
      supabase.from("room_dishes").select("dish_id, dishes(*)").eq("room_id", roomId),
      supabase.from("selections").select("*").eq("room_id", roomId),
    ]);

    if (roomRes.data) setRoomName(roomRes.data.name);

    const dishMap = new Map<string, DishView>();
    for (const rd of rdRes.data || []) {
      const d = (rd as any).dishes as Dish;
      if (!d) continue;
      dishMap.set(d.id, { dish: d, quantity: 0, orderedBy: [] });
    }

    for (const sel of selRes.data || []) {
      const s = sel as Selection;
      if (s.quantity <= 0) continue;
      const dv = dishMap.get(s.dish_id);
      if (dv) {
        dv.quantity += s.quantity;
        dv.orderedBy.push(s.user_nickname);
      }
    }

    setDishes(Array.from(dishMap.values()));
    setLoading(false);
  }, [roomId]);

  fetchRef.current = fetchAll;

  useEffect(() => {
    setLoading(true);
    fetchAll();

    const channel = supabase
      .channel(`cast_${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_dishes", filter: `room_id=eq.${roomId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "selections", filter: `room_id=eq.${roomId}` }, () => fetchAll())
      .subscribe();

    const presenceChannel = supabase.channel(`cast_presence_${roomId}`, {
      config: { presence: { key: "cast_" + Date.now() } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState<{ nickname: string; joined_at: string }>();
        const all: Member[] = [];
        for (const key of Object.keys(state)) {
          for (const p of state[key]) all.push({ nickname: p.nickname, joined_at: p.joined_at });
        }
        setMembers(all);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [roomId, fetchAll]);

  const handleReconnect = useCallback(() => {
    fetchRef.current?.();
  }, []);

  const totalDishes = dishes.filter((d) => d.quantity > 0).length;
  const totalQuantity = dishes.reduce((s, d) => s + d.quantity, 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <ConnectionStatus onReconnect={handleReconnect} />

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-wide">{roomName || "家庭菜单"}</h1>
            <div className="mt-1 flex items-center gap-2 text-zinc-400">
              <Users className="size-5" />
              <span className="text-lg">
                {members.length > 0 ? members.map((m) => m.nickname).join("、") : "等待成员加入"}
              </span>
            </div>
          </div>
          <div className="text-right text-zinc-500">
            <Monitor className="ml-auto size-6" />
            <span className="text-sm">投屏模式</span>
          </div>
        </div>

        {/* Dishes grid */}
        {loading ? (
          <div className="mt-8 text-center text-zinc-600 text-xl">加载中…</div>
        ) : dishes.length === 0 ? (
          <div className="mt-20 text-center text-zinc-600 text-2xl">
            房间内还没有菜品
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {dishes.map((dv) => (
              <div
                key={dv.dish.id}
                className={`flex gap-4 rounded-2xl border p-4 transition-all ${
                  dv.quantity > 0
                    ? "border-zinc-700 bg-zinc-900"
                    : "border-zinc-800/50 bg-zinc-900/30 opacity-50"
                }`}
              >
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                  {dv.dish.image_url ? (
                    <img
                      src={dv.dish.image_url}
                      alt={dv.dish.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-600 text-sm">
                      暂无图片
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-2xl font-bold">{dv.dish.name}</h3>
                      {dv.quantity > 0 && (
                        <span className="text-3xl font-bold text-amber-400 tabular-nums">
                          x{dv.quantity}
                        </span>
                      )}
                    </div>
                    {dv.dish.description && (
                      <p className="mt-1 text-base text-zinc-400 line-clamp-1">
                        {dv.dish.description}
                      </p>
                    )}
                  </div>

                  {dv.orderedBy.length > 0 && (
                    <div className="flex items-center gap-1.5 text-base text-zinc-500">
                      <span className="text-sm">已点：</span>
                      {dv.orderedBy.map((n) => (
                        <span
                          key={n}
                          className="rounded-full bg-zinc-800 px-3 py-0.5 text-sm text-zinc-300"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-zinc-800 pt-4 text-center">
          <p className="text-3xl text-zinc-500">
            共 <span className="font-bold text-zinc-100">{totalDishes}</span> 道菜 ·
            <span className="font-bold text-zinc-100"> {totalQuantity} </span> 份
          </p>
        </div>
      </div>
    </div>
  );
}
