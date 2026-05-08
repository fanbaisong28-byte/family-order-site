"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import type { Dish, Selection } from "@/lib/types";

interface DishView {
  dish: Dish;
  quantity: number;
  orderedBy: string[];
}

export default function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = use(params);
  const [dishes, setDishes] = useState<DishView[]>([]);
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setMobile(/Android|iPhone|iPad|iPod/i.test(ua));
  }, []);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua);

  useEffect(() => {
    const fetchData = async () => {
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
        const dv = dishMap.get(s.dish_id);
        if (dv) {
          dv.quantity += s.quantity;
          dv.orderedBy.push(s.user_nickname);
        }
      }

      const withQuantity = Array.from(dishMap.values()).filter((d) => d.quantity > 0);
      setDishes(withQuantity);
      setLoading(false);

      // Preload images
      const imgs = withQuantity
        .filter((d) => d.dish.image_url)
        .map(
          (d) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = resolve;
              img.onerror = resolve;
              img.src = d.dish.image_url;
            })
        );

      Promise.allSettled(imgs).then(() => {
        setImagesReady(true);
      });
    };

    fetchData();
  }, [roomId]);

  useEffect(() => {
    if (!loading && imagesReady && !mobile) {
      const timer = setTimeout(() => window.print(), 1000);
      const afterPrint = () => {
        clearTimeout(timer);
      };
      window.addEventListener("afterprint", afterPrint);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("afterprint", afterPrint);
      };
    }
  }, [loading, imagesReady, mobile]);

  if (mobile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold">请在电脑端导出</h1>
          <p className="mt-2 text-muted-foreground">
            移动端浏览器不支持导出 PDF 菜单，请在电脑上打开此页面完成导出。
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            房间码：<span className="font-mono font-bold">{roomId}</span>
          </p>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading || !imagesReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg">正在准备打印…</p>
          <p className="mt-1 text-sm text-muted-foreground">加载菜品图片中</p>
        </div>
      </div>
    );
  }

  if (dishes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-muted-foreground">暂无已点菜品</p>
      </div>
    );
  }

  const totalQuantity = dishes.reduce((s, d) => s + d.quantity, 0);
  const totalMembers = new Set(dishes.flatMap((d) => d.orderedBy)).size;

  return (
    <>
      <style>{`
        @media screen {
          .print-only { display: none; }
          .screen-only { display: block; }
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 20mm 12mm;
          }
          .screen-only { display: none !important; }
          .no-print { display: none !important; }
          .dish-card { page-break-inside: avoid; }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          img {
            max-width: 100%;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="screen-only flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">打印对话框已打开，请选择「另存为 PDF」</p>
          <button
            className="mt-3 text-sm text-primary underline"
            onClick={() => window.print()}
          >
            未弹出？点此重试
          </button>
        </div>
      </div>

      <div className="print-only">
        {isSafari && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Safari 浏览器：请在打印对话框中勾选「打印背景」，否则菜品图片可能无法显示。
          </div>
        )}
        {dishes.map((dv, i) => (
          <div key={dv.dish.id} className="dish-card mb-3">
            <div className="flex gap-4 rounded-xl border p-4">
              <div className="h-[90px] w-[90px] shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {dv.dish.image_url ? (
                  <img
                    src={dv.dish.image_url}
                    alt={dv.dish.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">
                    暂无
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold">
                    {dv.dish.name}
                    <span className="ml-2 text-gray-600">x{dv.quantity}</span>
                  </h3>
                  {dv.dish.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                      {dv.dish.description}
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {dv.orderedBy.join(" · ")}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Summary footer */}
        <div className="mt-4 border-t pt-3 text-center text-sm text-gray-500">
          <p>
            共 {dishes.length} 道菜 · {totalQuantity} 份 · {totalMembers} 人用餐
          </p>
          <p>{today}</p>
        </div>
      </div>
    </>
  );
}
