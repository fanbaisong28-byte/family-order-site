"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import {
  getRoomHistory,
  removeRoomFromHistory,
  type RoomHistoryEntry,
} from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, Clock, LogIn, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";

interface RoomCardData extends RoomHistoryEntry {
  status?: string;
  dbExists: boolean;
  created_at?: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RoomCardData | null>(null);

  const fetchRooms = async () => {
    setError("");
    setLoading(true);
    try {
      const history = getRoomHistory();
      if (history.length === 0) {
        setRooms([]);
        setLoading(false);
        return;
      }

      const ids = history.map((e) => e.id);
      const { data, error: err } = await supabase
        .from("rooms")
        .select("id, name, status, created_at")
        .in("id", ids);

      if (err) throw err;

      const dbMap = new Map(
        (data || []).map((r) => [r.id, r])
      );

      const merged: RoomCardData[] = history.map((entry) => {
        const db = dbMap.get(entry.id);
        if (db) {
          return {
            ...entry,
            name: db.name,
            status: db.status,
            created_at: db.created_at,
            dbExists: true,
          };
        }
        return { ...entry, dbExists: false };
      });

      setRooms(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    setDeletingId(id);

    try {
      await supabase.from("selections").delete().eq("room_id", id);
      await supabase.from("room_dishes").delete().eq("room_id", id);
      const { error: roomErr } = await supabase
        .from("rooms")
        .delete()
        .eq("id", id);
      if (roomErr) throw roomErr;

      removeRoomFromHistory(id);
      setRooms((prev) => prev.filter((r) => r.id !== id));
      toast.success(`已删除房间「${name}」`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "删除失败"
      );
    } finally {
      setDeletingId("");
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  const handleRemoveRecord = (roomId: string) => {
    removeRoomFromHistory(roomId);
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    toast.success("已移除记录");
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold">历史房间</h1>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-8 w-full" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" className="mt-3" onClick={fetchRooms}>
              重试
            </Button>
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Clock className="size-16 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">还没有加入过房间</p>
            <p className="text-sm text-muted-foreground/60">
              创建或加入房间后会自动出现在这里
            </p>
            <Link href="/" className="mt-4">
              <Button>去创建房间</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <Card key={room.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{room.name}</h3>
                    <p className="font-mono text-sm text-muted-foreground">
                      {room.id}
                    </p>
                  </div>
                  {room.dbExists ? (
                    <Badge
                      variant={room.status === "expired" ? "secondary" : "default"}
                    >
                      {room.status === "expired" ? "已过期" : "活跃中"}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">已删除</Badge>
                  )}
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  最后访问：{formatDate(room.joinedAt)}
                </p>

                <div className="mt-3 flex gap-2">
                  {room.dbExists ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => router.push(`/room/${room.id}`)}
                      >
                        <LogIn className="mr-1 size-3.5" />
                        进入
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={deletingId === room.id}
                        onClick={() => {
                          setPendingDelete(room);
                          setConfirmOpen(true);
                        }}
                      >
                        {deletingId === room.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleRemoveRecord(room.id)}
                    >
                      移除记录
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除房间</DialogTitle>
            <DialogDescription>
              确定删除房间「{pendingDelete?.name}」吗？此操作会清除房间内的所有点单和候选菜品记录，且不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmOpen(false);
                setPendingDelete(null);
              }}
            >
              取消
            </Button>
            <Button variant="default" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
