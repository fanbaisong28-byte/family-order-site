"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { DishGrid } from "@/components/DishGrid";
import { DishSelector } from "@/components/DishSelector";
import { QuickAddDish } from "@/components/QuickAddDish";
import { SelectionPanel } from "@/components/SelectionPanel";
import { MemberList } from "@/components/MemberList";
import { useRealtimeRoom } from "@/hooks/useRealtimeRoom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Library, Monitor, ArrowLeft, Loader2, Copy, Check } from "lucide-react";
import Link from "next/link";

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = use(params);
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [roomName, setRoomName] = useState("");
  const [validating, setValidating] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [roomExpired, setRoomExpired] = useState(false);

  useEffect(() => {
    const nick = sessionStorage.getItem(`nick_${roomId}`);
    if (!nick) {
      router.replace("/");
      return;
    }
    setNickname(nick);

    supabase
      .from("rooms")
      .select("name, status")
      .eq("id", roomId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("房间不存在");
          router.replace("/");
          return;
        }
        setRoomName(data.name);
        setRoomExpired(data.status === "expired");
        setValidating(false);
      });
  }, [roomId, router]);

  const { dishes, loading, error, updateQuantity, removeDish, totalDishes, totalQuantity, refetch } =
    useRealtimeRoom(roomId, nickname);

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 pb-20">
      <ConnectionStatus onReconnect={refetch} />

      {roomExpired && (
        <div className="mb-4 rounded-md bg-amber-100 dark:bg-amber-900/30 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-200">
          此房间已过期，仅供查看历史记录
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{roomName}</h1>
              <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                房间码：{roomId}
              </span>
              <button
                className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                onClick={async () => {
                  await navigator.clipboard.writeText(roomId);
                  setCodeCopied(true);
                  toast.success("已复制房间码");
                  setTimeout(() => setCodeCopied(false), 2000);
                }}
              >
                {codeCopied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
              </button>
            </div>
            <MemberList roomId={roomId} currentNickname={nickname} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(`/room/${roomId}/cast`, "_blank")}>
            <Monitor className="mr-1 size-4" />
            投屏
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            我是 <span className="font-medium text-foreground">{nickname}</span>
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setSelectorOpen(true)}>
          <Library className="mr-1 size-4" />
          从菜谱库选择
        </Button>
        <Button variant="outline" size="sm" onClick={() => setQuickAddOpen(true)}>
          <Plus className="mr-1 size-4" />
          临时新增
        </Button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-xl border p-3">
                <Skeleton className="h-20 w-20 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" className="mt-3" onClick={refetch}>
              重试
            </Button>
          </div>
        ) : dishes.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-muted-foreground">房间内还没有菜品</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              从菜谱库选择或临时新增一道菜开始吧
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectorOpen(true)}>
                <Library className="mr-1 size-4" />
                从菜谱库选择
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickAddOpen(true)}>
                <Plus className="mr-1 size-4" />
                临时新增
              </Button>
            </div>
          </div>
        ) : (
          <DishGrid
            dishes={dishes}
            userNickname={nickname}
            onUpdateQuantity={updateQuantity}
            onRemoveDish={removeDish}
          />
        )}
      </div>

      <SelectionPanel totalDishes={totalDishes} totalQuantity={totalQuantity} roomId={roomId} />

      <DishSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        roomId={roomId}
        existingIds={dishes.map((d) => d.id)}
        nickname={nickname}
        onAdded={refetch}
      />

      <QuickAddDish
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        roomId={roomId}
        nickname={nickname}
        onAdded={refetch}
      />
    </div>
  );
}
