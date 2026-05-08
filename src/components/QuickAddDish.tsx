"use client";

import { useState, useRef, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { compressImage, validateImageFile } from "@/lib/compress";
import { sanitizeInput } from "@/lib/utils";
import { CATEGORIES } from "@/lib/types";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  nickname: string;
  onAdded: () => void;
}

export function QuickAddDish({ open, onOpenChange, roomId, nickname, onAdded }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("家常");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateImageFile(file);
    if (error) { toast.error(error); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeInput(name, 30);
    if (!cleanName) { toast.error("请输入菜名"); return; }

    setSaving(true);
    try {
      let imageUrl = "";
      if (imageFile) {
        const compressed = await compressImage(imageFile);
        const fileName = `${crypto.randomUUID()}.webp`;
        const { error: upErr } = await supabase.storage.from("dishes").upload(fileName, compressed, { contentType: "image/webp" });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("dishes").getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }

      const { data: dishData, error: dErr } = await supabase.from("dishes").insert({
        name: cleanName,
        description: sanitizeInput(description, 200),
        category,
        image_url: imageUrl,
        created_by: nickname,
      }).select("id").single();

      if (dErr) throw dErr;

      const { error: rdErr } = await supabase.from("room_dishes").insert({
        room_id: roomId,
        dish_id: (dishData as any).id,
        added_by: nickname,
        is_temporary: true,
      });

      if (rdErr) throw rdErr;

      toast.success("菜品已添加");
      onAdded();
      onOpenChange(false);
    } catch {
      toast.error("添加失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>临时新增菜品</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="qa-image">菜品图片（可选）</Label>
            <input ref={fileRef} id="qa-image" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handleFileChange} className="hidden" />
            {imagePreview ? (
              <div className="relative mt-1.5 h-32 w-full overflow-hidden rounded-lg border">
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                <button type="button" className="absolute top-1 right-1 rounded-full bg-black/50 p-0.5 text-white" onClick={() => { setImageFile(null); setImagePreview(""); }}>
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button type="button" className="mt-1.5 flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-6" />
              </button>
            )}
          </div>
          <div>
            <Label htmlFor="qa-name">菜名 *</Label>
            <Input id="qa-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="例：番茄炒蛋" required />
          </div>
          <div>
            <Label htmlFor="qa-cat">分类</Label>
            <Select value={category} onValueChange={(v) => setCategory(v || "家常")}>
              <SelectTrigger id="qa-cat" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="qa-desc">简介（可选）</Label>
            <Textarea id="qa-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={2} placeholder="食材、口味等" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-1 size-4 animate-spin" />}添加</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
