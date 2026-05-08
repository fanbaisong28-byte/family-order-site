"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Users } from "lucide-react";

interface Props {
  roomId: string;
  currentNickname: string;
}

interface Member {
  nickname: string;
  joined_at: string;
}

export function MemberList({ roomId, currentNickname }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const warnedRef = useRef(false);

  useEffect(() => {
    const channel = supabase.channel(`presence_${roomId}`, {
      config: { presence: { key: currentNickname } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ nickname: string; joined_at: string }>();
        const all: Member[] = [];
        for (const key of Object.keys(state)) {
          for (const p of state[key]) {
            all.push({ nickname: p.nickname, joined_at: p.joined_at });
          }
        }
        setMembers(all);

        // Detect duplicate nickname: same nickname, different presence key
        const nicknameKeys = new Map<string, string[]>();
        for (const key of Object.keys(state)) {
          for (const p of state[key]) {
            if (!nicknameKeys.has(p.nickname)) nicknameKeys.set(p.nickname, []);
            nicknameKeys.get(p.nickname)!.push(key);
          }
        }
        const dupKeys = nicknameKeys.get(currentNickname);
        if (dupKeys && dupKeys.length > 1 && !warnedRef.current) {
          warnedRef.current = true;
          toast.warning("该昵称已在线，是否换一个？", {
            duration: 5000,
          });
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ nickname: currentNickname, joined_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentNickname]);

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Users className="size-3.5" />
      {members.length === 0 ? (
        <span>仅你在线</span>
      ) : (
        <span>
          {members.map((m) => m.nickname).join("、")}
          <span className="ml-1 opacity-60">({members.length}人在线)</span>
        </span>
      )}
    </div>
  );
}
