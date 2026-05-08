"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { generateRoomCode, sanitizeInput, hashPassword, validateRoomCode, saveRoomToHistory } from "@/lib/utils";
import { toast } from "sonner";
import { Home, LogIn, Utensils, Copy, Check, Clock } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");

  // Create form
  const [roomName, setRoomName] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // Join form
  const [roomCode, setRoomCode] = useState("");
  const [joinNickname, setJoinNickname] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joining, setJoining] = useState(false);

  // Show generated code after creation
  const [generatedCode, setGeneratedCode] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    const name = sanitizeInput(roomName, 20);
    const nick = sanitizeInput(nickname, 15);
    if (!name || !nick) {
      toast.error("请填写房间名和昵称");
      return;
    }

    setCreating(true);
    try {
      const code = generateRoomCode();
      const pwHash = password ? await hashPassword(password) : null;

      const { error } = await supabase.from("rooms").insert({
        id: code,
        name,
        password_hash: pwHash,
      });
      if (error) throw error;

      sessionStorage.setItem(`nick_${code}`, nick);
      saveRoomToHistory({ id: code, name, joinedAt: new Date().toISOString() });
      setGeneratedCode(code);
    } catch {
      toast.error("创建房间失败");
    } finally {
      setCreating(false);
    }
  };

  const enterRoom = () => {
    router.push(`/room/${generatedCode}`);
  };

  const handleJoin = async () => {
    const code = sanitizeInput(roomCode, 20).toUpperCase();
    const nick = sanitizeInput(joinNickname, 15);
    if (!code || !nick) {
      toast.error("请填写房间码和昵称");
      return;
    }
    if (!validateRoomCode(code)) {
      toast.error("房间码格式不正确");
      return;
    }

    setJoining(true);
    try {
      const { data: room, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", code)
        .single();

      if (error || !room) {
        toast.error("房间不存在");
        setJoining(false);
        return;
      }

      if (room.password_hash) {
        const inputHash = await hashPassword(joinPassword);
        if (inputHash !== room.password_hash) {
          toast.error("密码错误");
          setJoining(false);
          return;
        }
      }

      sessionStorage.setItem(`nick_${code}`, nick);
      saveRoomToHistory({ id: code, name: room.name, joinedAt: new Date().toISOString() });
      router.push(`/room/${code}`);
    } catch {
      toast.error("加入房间失败");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">家庭点菜</h1>
        <p className="mt-2 text-muted-foreground">周末聚餐，一起点菜</p>
      </div>

      <div className="mb-6 flex w-full rounded-lg bg-muted p-1">
        <button
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === "create" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => { setTab("create"); setGeneratedCode(""); }}
        >
          <Home className="mr-1 inline size-4" />
          创建房间
        </button>
        <button
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === "join" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setTab("join")}
        >
          <LogIn className="mr-1 inline size-4" />
          加入房间
        </button>
      </div>

      {generatedCode ? (
        <Card className="w-full p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">房间创建成功！房间码：</p>
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-3xl font-mono font-bold tracking-widest">{generatedCode}</span>
            <button
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              onClick={async () => {
                await navigator.clipboard.writeText(generatedCode);
                setCopied(true);
                toast.success("已复制房间码");
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="size-5 text-green-500" /> : <Copy className="size-5" />}
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            将此房间码分享给家人，即可加入同一房间
          </p>
          <Button onClick={enterRoom} className="w-full">
            进入房间
          </Button>
        </Card>
      ) : tab === "create" ? (
        <Card className="w-full p-6">
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="room-name">房间名</Label>
              <Input
                id="room-name"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="例：周末聚餐"
                maxLength={20}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <Label htmlFor="nickname">你的昵称</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="例：爸爸"
                maxLength={15}
              />
            </div>
            <div>
              <Label htmlFor="password">房间密码（可选）</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="留空则不设密码"
              />
            </div>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "创建中..." : "创建房间"}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="w-full p-6">
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="room-code">房间码</Label>
              <Input
                id="room-code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="输入 6 位房间码"
                maxLength={20}
                className="uppercase"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>
            <div>
              <Label htmlFor="join-nickname">你的昵称</Label>
              <Input
                id="join-nickname"
                value={joinNickname}
                onChange={(e) => setJoinNickname(e.target.value)}
                placeholder="例：妈妈"
                maxLength={15}
              />
            </div>
            <div>
              <Label htmlFor="join-password">房间密码（如有）</Label>
              <Input
                id="join-password"
                type="password"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                placeholder="无密码则留空"
              />
            </div>
            <Button onClick={handleJoin} disabled={joining}>
              {joining ? "加入中..." : "加入房间"}
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-6 flex gap-4">
        <Link href="/manage" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <Utensils className="size-3.5" />
          菜谱管理
        </Link>
        <Link href="/history" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <Clock className="size-3.5" />
          历史房间
        </Link>
      </div>
    </div>
  );
}
