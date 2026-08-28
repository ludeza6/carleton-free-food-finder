export type FoodReport = {
  id: number;
  building: string;
  room: string | null;
  food_type: string;
  quantity: "lots" | "some" | "almost_gone";
  notes: string | null;
  status: "active" | "gone" | "expired";

  still_here_count: number;
  gone_count: number;
  last_confirmed_at: string | null;

  created_at: string;
  expires_at: string;
};