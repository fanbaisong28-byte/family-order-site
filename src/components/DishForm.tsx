"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { compressImage, validateImageFile } from "@/lib/compress";
import { sanitizeInput } from "@/lib/utils";
import { CATEGORIES, type Dish } from "@/lib/types";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dish?: Dish | null;
  onSaved: () => void;
}

export function DishForm({ open, onOpenChange, dish, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("家常");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editing = !!dish;

  useEffect(() => {
    if (open) {
      if (dish) {
        setName(dish.name);
        setDescription(dish.description);
        setCategory(dish.category);
        setImageFile(null);
        setImagePreview(dish.image_url || "");
      } else {
        setName("");
        setDescription("");
        setCategory("家常");
        setImageFile(null);
        setImagePreview("");
      }
    }
  }, [open, dish]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string> => {
    if (!imageFile) return dish?.image_url || "";

    const compressed = await compressImage(imageFile);
    const ext = "webp";
    const fileName = `${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("dishes")
      .upload(fileName, compressed, { contentType: "image/webp", upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from("dishes").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const cleanName = sanitizeInput(name, 30);
    if (!cleanName) {
      toast.error("请输入菜名");
      return;
    }

    setSaving(true);
    try {
      const imageUrl = await uploadImage();
      const payload = {
        name: cleanName,
        description: sanitizeInput(description, 200),
        category,
        image_url: imageUrl,
      };

      if (editing) {
        const { error } = await supabase.from("dishes").update(payload).eq("id", dish.id);
        if (error) throw error;
        toast.success("菜品已更新");
      } else {
        const { error } = await supabase.from("dishes").insert({
          ...payload,
          created_by: "管理员",
        });
        if (error) throw error;
        toast.success("菜品已添加");
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑菜品" : "添加菜品"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="dish-image">菜品图片</Label>
            <input
              ref={fileRef}
              id="dish-image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleFileChange}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative mt-1.5 h-40 w-full overflow-hidden rounded-lg border">
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute top-1 right-1 rounded-full bg-black/50 p-0.5 text-white"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview("");
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="mt-1.5 flex h-40 w-full items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary"
                onClick={() => fileRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-1">
                  <ImagePlus className="size-8" />
                  <span className="text-xs">点击上传图片</span>
                </div>
              </button>
            )}
          </div>

          <div>
            <Label htmlFor="dish-name">菜名 *</Label>
            <Input
              id="dish-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="例：宫保鸡丁"
              required
            />
          </div>

          <div>
            <Label htmlFor="dish-category">分类</Label>
            <Select value={category} onValueChange={(v) => setCategory(v || "家常")}>
              <SelectTrigger id="dish-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="dish-desc">简介</Label>
            <Textarea
              id="dish-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="食材、口味、特色等（可选）"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
              {editing ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
