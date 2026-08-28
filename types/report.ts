export type FoodReport = {
  id: number;
  building: string;
  room: string | null;
  food_type: string;
  quantity: "lots" | "some" | "almost_gone";
  notes: string | null;
  status: "active" | "gone" | "expired";
  created_at: string;
  expires_at: string;
};