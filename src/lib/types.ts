export interface Dish {
  id: string;
  name: string;
  description: string;
  image_url: string;
  category: string;
  created_by: string;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  password_hash: string | null;
  status: "active" | "expired";
  created_at: string;
}

export interface RoomDish {
  id: string;
  room_id: string;
  dish_id: string;
  is_temporary: boolean;
  added_by: string;
  added_at: string;
}

export interface Selection {
  id: string;
  room_id: string;
  dish_id: string;
  user_nickname: string;
  quantity: number;
  note: string;
  updated_at: string;
}

export const CATEGORIES = [
  "家常",
  "凉菜",
  "热菜",
  "汤羹",
  "主食",
  "甜点",
  "海鲜",
  "素菜",
  "荤菜",
  "其他",
] as const;
